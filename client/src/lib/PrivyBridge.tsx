// Wraps the app in Privy ONLY when VITE_PRIVY_APP_ID is configured, and syncs
// the connected wallet address into the wallet store. Without an App ID it's a
// no-op pass-through (the app still runs; wallet connect falls back to manual).
import { useEffect } from "react";
import { PrivyProvider, usePrivy, type User } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { PRIVY_APP_ID, SOLANA_RPC, privyConfigured, useWallet } from "./web3";

// Registering Solana connectors is what lets Privy DETECT an installed Phantom
// (or Solflare, Backpack…) instead of bouncing the user to a download page.
const solanaConnectors = toSolanaWalletConnectors();

// Pull a stable identity + display label out of a Privy user. Prefers a real
// Solana wallet address (so rewards work), then email, then the Privy DID.
export function privyIdentity(user: User | null | undefined): { identity: string; label?: string } | null {
  if (!user) return null;
  const wallets = (user.linkedAccounts ?? []).filter(
    (a) => (a as { type?: string }).type === "wallet",
  ) as Array<{ address?: string; chainType?: string }>;
  const solana = wallets.find((w) => w.chainType === "solana" || (w.address && !w.address.startsWith("0x")));
  if (solana?.address) return { identity: solana.address, label: undefined };
  const email = (user.email as { address?: string } | undefined)?.address;
  if (email) return { identity: email, label: email.split("@")[0] };
  if (user.id) return { identity: user.id };
  return null;
}

// The connected Solana wallet address only (or null) — used for rewards.
export function privyWalletAddress(user: User | null | undefined): string | null {
  const id = privyIdentity(user);
  if (id && !id.identity.includes("@") && !id.identity.startsWith("did:")) return id.identity;
  return null;
}

function WalletSync() {
  const { authenticated, user } = usePrivy();
  const setAddress = useWallet((s) => s.setAddress);
  useEffect(() => {
    const addr = authenticated ? privyWalletAddress(user) : null;
    if (addr) setAddress(addr);
  }, [authenticated, user, setAddress]);
  return null;
}

export default function PrivyBridge({ children }: { children: React.ReactNode }) {
  if (!privyConfigured) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={
        {
          appearance: { theme: "dark", accentColor: "#e8c75a", walletChainType: "solana-only" },
          loginMethods: ["wallet", "email"],
          embeddedWallets: { createOnLogin: "off" },
          externalWallets: { solana: { connectors: solanaConnectors } },
          solanaClusters: [{ name: "mainnet-beta", rpcUrl: SOLANA_RPC }],
        } as never
      }
    >
      <WalletSync />
      {children}
    </PrivyProvider>
  );
}
