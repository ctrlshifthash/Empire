// Wraps the app in Privy ONLY when VITE_PRIVY_APP_ID is configured, and syncs
// the connected wallet address into the wallet store. Without an App ID it's a
// no-op pass-through (the app still runs; wallet connect falls back to manual).
import { useEffect } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { PRIVY_APP_ID, SOLANA_RPC, privyConfigured, useWallet } from "./web3";

function WalletSync() {
  const { authenticated, user } = usePrivy();
  const setAddress = useWallet((s) => s.setAddress);
  useEffect(() => {
    // prefer a Solana wallet address (base58, not 0x-prefixed)
    const wallets = (user?.linkedAccounts ?? []).filter(
      (a) => (a as { type?: string }).type === "wallet",
    ) as Array<{ address?: string; chainType?: string }>;
    const solana = wallets.find((w) => w.chainType === "solana" || (w.address && !w.address.startsWith("0x")));
    const addr = solana?.address ?? (user?.wallet?.address as string | undefined);
    if (authenticated && addr && !addr.startsWith("0x")) setAddress(addr);
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
          embeddedWallets: { createOnLogin: "off" },
          solanaClusters: [{ name: "mainnet-beta", rpcUrl: SOLANA_RPC }],
        } as never
      }
    >
      <WalletSync />
      {children}
    </PrivyProvider>
  );
}
