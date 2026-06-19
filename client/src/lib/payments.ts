import { ComputeBudgetProgram, type Connection, type TransactionSignature } from "@solana/web3.js";

// Priority fee + compute budget. A bare SPL tx with no fee gets dropped on a busy
// network — that's the "Phantom: confirming… then nothing" symptom. Prepending
// these makes the tx actually land. Cost is tiny (~0.00001 SOL).
export function priorityFeeIxs() {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150_000 }),
  ];
}

// Wait until the network confirms the signature before we ask the server to
// verify — so the server isn't checking a tx that hasn't landed yet. Resolves
// true (confirmed), false (failed/timed out).
export async function confirmSignature(conn: Connection, signature: TransactionSignature, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await conn.getSignatureStatus(signature, { searchTransactionHistory: false }).catch(() => null);
    const s = st?.value;
    if (s?.err) return false;
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return true;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return false; // let the server's own retry loop be the backstop
}
