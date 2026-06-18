// Wraps the app in the standard Solana wallet adapter (Phantom, Solflare, and any
// wallet-standard wallet) and syncs the connected address into the wallet store.
// No third-party account/SDK, no MAU cap — wallet connect + signing are free.
import { useEffect } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet as useSolWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
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
  // No explicit adapters: Phantom, Solflare, Backpack etc. now register
  // themselves as wallet-standard wallets and are auto-detected. Passing the
  // legacy adapters too caused a duplicate-Phantom conflict (sign would fail
  // with no popup), which the console explicitly warned about.
  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <WalletSync />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
