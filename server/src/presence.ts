// Tracks which (human) empires currently have a live socket connection.
export const onlineEmpires = new Set<string>();

export function isOnline(empireId: string): boolean {
  return onlineEmpires.has(empireId);
}
