// Tracks which (human) empires currently have a live socket connection.
export const onlineEmpires = new Set<string>();

// VIP/seeded empires that should always appear online regardless of socket state.
const permanentOnline = new Set<string>();

export function setAlwaysOnline(empireId: string): void {
  permanentOnline.add(empireId);
}

export function isOnline(empireId: string): boolean {
  return onlineEmpires.has(empireId) || permanentOnline.has(empireId);
}

export function allOnlineIds(): Set<string> {
  return new Set([...onlineEmpires, ...permanentOnline]);
}

export function onlineCount(): number {
  return allOnlineIds().size;
}
