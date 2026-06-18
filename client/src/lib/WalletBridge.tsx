// Wraps the app in the standard Solana wallet adapter (Phantom, Solflare, and any
// wallet-standard wallet) and syncs the connected address into the wallet store.
// No third-party account/SDK, no MAU cap — wallet connect + signing are free.
import { useEffect, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet as useSolWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { SOLANA_RPC, useWallet } from "./web3";
import "@solana/wallet-adapter-react-ui/styles.css";

// Push the connected wallet's address into our own wallet store (which drives
// rewards). We set on connect; explicit Disconnect buttons clear it.
function WalletSync() {
  const { publicKey, connected } = useSolWallet();
  const setAddress = useWallet((s) => s.setAddress);
  useEffect(() => {
    if (connected && publicKey) setAddress(publicKey.toBase58());
  }, [connected, publicKey, setAddress]);
  return null;
}

export default function WalletBridge({ children }: { children: React.ReactNode }) {
  // Phantom + Solflare are listed explicitly; other wallet-standard wallets
  // (Backpack, etc.) are auto-detected and also appear in the modal.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletSync />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
