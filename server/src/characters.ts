// ─────────────────────────────────────────────────────────────────────────────
// Character cNFTs. Players buy a character (coins or $RUMBLE), wear it as their
// hub avatar, own it, and can resell it. Each owned character maps 1:1 to a real
// compressed NFT (the `assetId`), minted on-chain once the Bubblegum tree + art
// are live; until then ownership is tracked here and the assetId is null (beta).
// ─────────────────────────────────────────────────────────────────────────────
import { CHARACTERS, characterType } from "../../shared/gamedata.ts";
import type { CharacterInstance, OwnedCharacter } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { now, uid } from "./util.ts";

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
        onChain: !!c.assetId,
      };
    });
}

// Buy a character with in-game coins (instant).
export function buyCharacterCoins(empireId: string, typeId: string): CharResult {
  if (CHARACTERS_LOCKED) return { ok: false, error: "Character sales are paused right now — check back soon." };
  const e = state.empires[empireId];
  if (!e) return { ok: false, error: "No empire." };
  const def = characterType(typeId);
  if (!def) return { ok: false, error: "Unknown character." };
  if ((state.characterMintCounts[typeId] ?? 0) >= def.maxSupply) return { ok: false, error: "Sold out — all minted." };
  if ((e.coins ?? 0) < def.priceCoins) return { ok: false, error: `Costs ${def.priceCoins.toLocaleString()} coins.` };
  e.coins -= def.priceCoins;
  const inst = mintCharacter(empireId, typeId);
  if (!inst) {
    e.coins += def.priceCoins;
    return { ok: false, error: "Mint failed — try again." };
  }
  e.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `Unlocked the ${def.name} character #${inst.serial}.` });
  if (e.log.length > 60) e.log.length = 60;
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

// Equip / unequip a character as the hub-avatar skin (toggle).
export function equipCharacter(empireId: string, instanceId: string): CharResult {
  const e = state.empires[empireId];
  const inst = state.characterInstances[instanceId];
  if (!e || !inst || inst.ownerId !== empireId) return { ok: false, error: "You don't own that character." };
  e.equippedCharacter = e.equippedCharacter === instanceId ? undefined : instanceId;
  scheduleSave(0);
  return { ok: true, members: [empireId] };
}

// The equipped character's look for the hub avatar (or undefined).
export function equippedCharacterStyle(
  e: { equippedCharacter?: string },
): { icon: string; color: string; hat: "crown" | "helmet" | "hood" | "cap" | null; cape: boolean } | undefined {
  if (!e.equippedCharacter) return undefined;
  const inst = state.characterInstances[e.equippedCharacter];
  const def = inst ? characterType(inst.typeId) : undefined;
  return def ? { icon: def.icon, color: def.color, hat: def.hat, cape: def.cape } : undefined;
}
