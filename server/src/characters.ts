// ─────────────────────────────────────────────────────────────────────────────
// Character cNFTs. Players buy a character (coins or $RUMBLE), wear it as their
// hub avatar, own it, and can resell it. Each owned character maps 1:1 to a real
// compressed NFT (the `assetId`), minted on-chain once the Bubblegum tree + art
// are live; until then ownership is tracked here and the assetId is null (beta).
// ─────────────────────────────────────────────────────────────────────────────
import { CHARACTERS, characterType } from "../../shared/gamedata.ts";
import type { CharacterInstance, OwnedCharacter } from "../../shared/types.ts";
import { state, scheduleSave, pushActivity } from "./store.ts";
import { rumbleUsdPrice } from "./price.ts";
import { amountsFromUsd, rumbleDecimals, verifyRumblePayment } from "./exchange.ts";
import { treasuryPubkey, tokenMint } from "./rewards.ts";
import { recomputePower } from "./engine.ts";
import { now, uid } from "./util.ts";

const RESERVE_MS = 3 * 60 * 1000; // a buyer's price quote is held for 3 minutes
// Backend-only economics (not shown anywhere in the UI/docs): every character
// sale sends 75% of the $RUMBLE to the treasury and burns 25%.
const CHARACTER_BURN_PCT = 25;

export interface CharResult {
  ok: boolean;
  error?: string;
  members?: string[];
}

// Characters are LIVE + buyable by default. Set CHARACTERS_LOCKED=1 on Railway to
// hide them behind a preview again (e.g. while finishing art / on-chain minting).
const CHARACTERS_LOCKED = (process.env.CHARACTERS_LOCKED ?? "0") !== "0";
export const charactersLocked = (): boolean => CHARACTERS_LOCKED;

export function characterCatalog() {
  return CHARACTERS.map((c) => {
    const minted = state.characterMintCounts[c.id] ?? 0;
    return { ...c, minted, remaining: Math.max(0, c.maxSupply - minted) };
  });
}

// Mint a character instance to an empire (assetId set when the on-chain cNFT mints).
export function mintCharacter(empireId: string, typeId: string, assetId: string | null = null): CharacterInstance | null {
  const def = characterType(typeId);
  if (!def) return null;
  const minted = state.characterMintCounts[typeId] ?? 0;
  if (minted >= def.maxSupply) return null; // sold out forever
  const serial = minted + 1;
  state.characterMintCounts[typeId] = serial;
  const inst: CharacterInstance = { id: uid("char_"), typeId, ownerId: empireId, serial, assetId, mintedAt: now() };
  state.characterInstances[inst.id] = inst;
  scheduleSave(0);
  return inst;
}

export function ownedCharacters(empireId: string): OwnedCharacter[] {
  const e = state.empires[empireId];
  const eq = e?.equippedCharacter;
  const listed = (id: string) => Object.values(state.listings).some((l) => l.instanceId === id && l.status === "active");
  return Object.values(state.characterInstances)
    .filter((c) => c.ownerId === empireId)
    .sort((a, b) => a.serial - b.serial)
    .map((c) => {
      const def = characterType(c.typeId);
      return {
        instanceId: c.id,
        typeId: c.typeId,
        name: def?.name ?? c.typeId,
        icon: def?.icon ?? "🙂",
        color: def?.color ?? "#888888",
        hat: def?.hat ?? null,
        cape: def?.cape ?? false,
        rarity: def?.rarity ?? "common",
        serial: c.serial,
        equipped: eq === c.id,
        listed: listed(c.id),
        onChain: !!c.assetId,
      };
    });
}

// ── Buy a character with $RUMBLE (USD-priced, paid to the treasury, verified
// on-chain) ──────────────────────────────────────────────────────────────────
// Mirrors the relic bazaar flow: the buyer pays the treasury in $RUMBLE at the
// live rate and burns a share, in one tx they sign. We lock the $RUMBLE amount
// at reserve so the price can't move mid-buy, verify on-chain, then mint. No custody.
export async function reserveCharacterBuy(typeId: string, buyer: string): Promise<{
  ok: boolean;
  error?: string;
  payment?: { mint: string; seller: string; sellerBase: string; burnBase: string; decimals: number; rumbleAmount: number };
}> {
  if (CHARACTERS_LOCKED) return { ok: false, error: "Character sales are paused right now — check back soon." };
  const def = characterType(typeId);
  if (!def) return { ok: false, error: "Unknown character." };
  const treasury = treasuryPubkey();
  if (!treasury) return { ok: false, error: "Character sales aren't configured yet." };
  const minted = state.characterMintCounts[typeId] ?? 0;
  // count other buyers' live reservations so the last few can't be oversold
  const heldByOthers = Object.entries(state.characterReservations)
    .filter(([b, r]) => b !== buyer && r.typeId === typeId && r.until > now()).length;
  if (minted + heldByOthers >= def.maxSupply) return { ok: false, error: "Sold out — all minted or reserved. Try again shortly." };
  const rumbleUsd = await rumbleUsdPrice();
  if (!rumbleUsd) return { ok: false, error: "$RUMBLE price unavailable — try again in a moment." };
  const dec = await rumbleDecimals();
  const { sellerBase, burnBase, rumbleAmount } = amountsFromUsd(def.priceUsd, rumbleUsd, dec, CHARACTER_BURN_PCT);
  state.characterReservations[buyer] = { typeId, treasuryBase: sellerBase.toString(), burnBase: burnBase.toString(), until: now() + RESERVE_MS };
  scheduleSave();
  return {
    ok: true,
    payment: { mint: tokenMint(), seller: treasury, sellerBase: sellerBase.toString(), burnBase: burnBase.toString(), decimals: dec, rumbleAmount },
  };
}

export async function buyCharacterRumble(typeId: string, buyer: string, signature: string): Promise<CharResult & { empireId?: string }> {
  if (state.characterBuySignatures[signature]) return { ok: false, error: "This payment was already used." };
  const buyerUser = Object.values(state.users).find((u) => u.externalId === buyer);
  const empire = buyerUser ? state.empires[buyerUser.empireId] : undefined;
  if (!empire) return { ok: false, error: "Open the game signed in with this wallet to receive the character." };
  const def = characterType(typeId);
  if (!def) return { ok: false, error: "Unknown character." };
  const r = state.characterReservations[buyer];
  if (!r || r.typeId !== typeId || r.until < now()) return { ok: false, error: "Your price quote expired — reopen and buy again." };
  const treasury = treasuryPubkey();
  if (!treasury) return { ok: false, error: "Character sales aren't configured." };
  if ((state.characterMintCounts[typeId] ?? 0) >= def.maxSupply) return { ok: false, error: "Sold out — all minted." };

  const paid = await verifyRumblePayment(signature, buyer, treasury, BigInt(r.treasuryBase), BigInt(r.burnBase));
  if (!paid) return { ok: false, error: "Payment not confirmed — if you were charged, wait a few seconds and retry." };

  const inst = mintCharacter(empire.id, typeId);
  if (!inst) return { ok: false, error: "Sold out — all minted." };
  state.characterBuySignatures[signature] = { typeId, buyer, at: now() };
  delete state.characterReservations[buyer];
  empire.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Bought the ${def.name} character #${inst.serial} for $${def.priceUsd} in $RUMBLE.` });
  if (empire.log.length > 60) empire.log.length = 60;
  pushActivity("character", "bought", `${empire.name} bought ${def.name} #${inst.serial} for $${def.priceUsd.toFixed(2)} in $RUMBLE`, undefined, { refType: typeId, serial: inst.serial, priceUsd: def.priceUsd, fromWallet: treasury, toWallet: buyer, signature });
  scheduleSave(0);
  return { ok: true, empireId: empire.id, members: [empire.id] };
}

// Power granted by the equipped character (0 if none) — folded into recomputePower.
export function equippedCharacterPower(e: { equippedCharacter?: string }): number {
  if (!e.equippedCharacter) return 0;
  const inst = state.characterInstances[e.equippedCharacter];
  const def = inst ? characterType(inst.typeId) : undefined;
  return def?.power ?? 0;
}

// Equip / unequip a character as the hub-avatar skin (toggle).
export function equipCharacter(empireId: string, instanceId: string): CharResult {
  const e = state.empires[empireId];
  const inst = state.characterInstances[instanceId];
  if (!e || !inst || inst.ownerId !== empireId) return { ok: false, error: "You don't own that character." };
  e.equippedCharacter = e.equippedCharacter === instanceId ? undefined : instanceId;
  recomputePower(e); // the character's power boost lifts rank → SOL share
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

// The equipped character's look for the hub avatar (or undefined).
export function equippedCharacterStyle(
  e: { equippedCharacter?: string },
): { id: string; icon: string; color: string; hat: "crown" | "helmet" | "hood" | "cap" | null; cape: boolean } | undefined {
  if (!e.equippedCharacter) return undefined;
  const inst = state.characterInstances[e.equippedCharacter];
  const def = inst ? characterType(inst.typeId) : undefined;
  return def ? { id: def.id, icon: def.icon, color: def.color, hat: def.hat, cape: def.cape } : undefined;
}

// ── Free character grants (whitelist) ────────────────────────────────────────
// Wallet -> character typeId. A whitelisted wallet can claim that character once,
// for free, from the shop. Seed one-offs here; add more without a deploy via the
// CHARACTER_FREEBIES env ("wallet:typeId,wallet:typeId"). Claims are tracked in
// state so each grant is strictly one-time.
const FREE_GRANTS: Record<string, string> = {
  GsKTK3tmf82Pi1Rmdz61RWuEEjU4dG3G5bm5mesLUfBe: "mert",
};
for (const pair of (process.env.CHARACTER_FREEBIES || "").split(",")) {
  const [w, t] = pair.split(":").map((s) => s.trim());
  if (w && t) FREE_GRANTS[w] = t;
}

// The free character this wallet can still claim (typeId), or null.
export function characterFreebieFor(wallet: string): string | null {
  const typeId = FREE_GRANTS[wallet];
  if (!typeId || state.characterFreebieClaims[wallet]) return null;
  return typeId;
}

// Claim the whitelisted free character — mints it to the wallet's empire, once.
export function claimCharacterFreebie(wallet: string): CharResult & { name?: string } {
  const typeId = characterFreebieFor(wallet);
  if (!typeId) return { ok: false, error: "No free character available for this wallet." };
  const user = Object.values(state.users).find((u) => u.externalId === wallet);
  const empire = user ? state.empires[user.empireId] : undefined;
  if (!empire) return { ok: false, error: "Open the game signed in with this wallet to claim your free character." };
  const def = characterType(typeId);
  if (!def) return { ok: false, error: "Unknown character." };
  if ((state.characterMintCounts[typeId] ?? 0) >= def.maxSupply) return { ok: false, error: "Sold out — none left to grant." };
  const inst = mintCharacter(empire.id, typeId);
  if (!inst) return { ok: false, error: "Mint failed — try again." };
  state.characterFreebieClaims[wallet] = typeId;
  empire.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `🎁 Claimed a free ${def.name} character #${inst.serial}!` });
  if (empire.log.length > 60) empire.log.length = 60;
  scheduleSave(0);
  return { ok: true, name: def.name, members: [empire.id] };
}
