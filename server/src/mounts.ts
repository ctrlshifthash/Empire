// ─────────────────────────────────────────────────────────────────────────────
// Mounts & Pets (beta). Rare cNFT-style collectibles dropped when you win a raid.
// You own them, equip one beside your hero, and (later) resell them. Ownership is
// tracked here; assetId stays null until on-chain minting goes live. Gated by the
// `mounts` beta flag — no drops happen while locked.
// ─────────────────────────────────────────────────────────────────────────────
import { MOUNTS, mountType, MOUNT_DROP_CHANCE } from "../../shared/gamedata.ts";
import type { MountInstance, OwnedMount } from "../../shared/types.ts";
import { state, scheduleSave } from "./store.ts";
import { isLocked } from "./features.ts";
import { now, uid } from "./util.ts";

export const mountsLocked = (): boolean => isLocked("mounts");

export function mintMount(empireId: string, typeId: string): MountInstance | null {
  const def = mountType(typeId);
  if (!def) return null;
  const serial = (state.mountMintCounts[typeId] ?? 0) + 1;
  state.mountMintCounts[typeId] = serial;
  const inst: MountInstance = { id: uid("mount_"), typeId, ownerId: empireId, serial, assetId: null, mintedAt: now() };
  state.mountInstances[inst.id] = inst;
  scheduleSave(0);
  return inst;
}

export function ownedMounts(empireId: string): OwnedMount[] {
  const e = state.empires[empireId];
  const eq = e?.equippedMount;
  return Object.values(state.mountInstances)
    .filter((m) => m.ownerId === empireId)
    .sort((a, b) => a.mintedAt - b.mintedAt)
    .map((m) => {
      const def = mountType(m.typeId);
      return {
        instanceId: m.id,
        typeId: m.typeId,
        name: def?.name ?? m.typeId,
        icon: def?.icon ?? "🐎",
        rarity: def?.rarity ?? "common",
        serial: m.serial,
        equipped: eq === m.id,
        onChain: !!m.assetId,
      };
    });
}

// Equip / unequip a mount as the beside-hero companion (toggle).
export function equipMount(empireId: string, instanceId: string): { ok: boolean; error?: string } {
  const e = state.empires[empireId];
  const inst = state.mountInstances[instanceId];
  if (!e || !inst || inst.ownerId !== empireId) return { ok: false, error: "You don't own that mount." };
  e.equippedMount = e.equippedMount === instanceId ? undefined : instanceId;
  scheduleSave(0);
  return { ok: true };
}

export function equippedMountIcon(e: { equippedMount?: string }): string | undefined {
  if (!e.equippedMount) return undefined;
  const inst = state.mountInstances[e.equippedMount];
  const def = inst ? mountType(inst.typeId) : undefined;
  return def?.icon;
}

// Rare drop on a raid win. Returns the dropped mount, or null (locked / no drop).
export function maybeDropMount(empireId: string): { typeId: string; name: string; icon: string } | null {
  if (isLocked("mounts")) return null;
  if (Math.random() > MOUNT_DROP_CHANCE) return null;
  const total = MOUNTS.reduce((s, m) => s + m.dropWeight, 0);
  let r = Math.random() * total;
  let pick = MOUNTS[0];
  for (const m of MOUNTS) {
    r -= m.dropWeight;
    if (r <= 0) {
      pick = m;
      break;
    }
  }
  const inst = mintMount(empireId, pick.id);
  if (!inst) return null;
  const e = state.empires[empireId];
  if (e) {
    e.log.unshift({ id: uid("log_"), at: now(), kind: "system", text: `🐎 A wild ${pick.name} joined your stable!` });
    if (e.log.length > 60) e.log.length = 60;
  }
  return { typeId: pick.id, name: pick.name, icon: pick.icon };
}
