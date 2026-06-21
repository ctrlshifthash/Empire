// Client side of the $RUMBLE character catalog buy. The server quotes the exact
// $RUMBLE amount (USD-priced, at the live token rate); we build the payment tx,
// the wallet signs, and the server verifies on-chain before minting the character.
import { SERVER_URL } from "./config";
import type { ExPayment } from "./exchange";

export async function reserveCharacter(typeId: string, address: string): Promise<{ ok: boolean; error?: string; payment?: ExPayment }> {
  try {
    return await fetch(`${SERVER_URL}/api/characters/${encodeURIComponent(typeId)}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).then((x) => x.json());
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export async function postBuyCharacter(typeId: string, address: string, signature: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await fetch(`${SERVER_URL}/api/characters/${encodeURIComponent(typeId)}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature }),
    }).then((x) => x.json());
  } catch {
    return { ok: false, error: "Network error." };
  }
}
