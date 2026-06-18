// Browser polyfills for the Node globals that @solana/web3.js + @solana/spl-token
// reach for at runtime when building transactions (Buffer, global). Without these
// the browser throws "Buffer is not defined" the moment a payment transaction is
// constructed. Imported FIRST in main.tsx so they exist before any wallet code runs.
import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: unknown; global?: unknown };
if (!g.Buffer) g.Buffer = Buffer;
if (!g.global) g.global = globalThis;
