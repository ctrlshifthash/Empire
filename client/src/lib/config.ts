// In dev the client (5173) talks to the server (4000) cross-origin.
// In production the server serves the built client from the same origin.
export const SERVER_URL: string = import.meta.env.DEV
  ? "http://localhost:4000"
  : "";

export const API_BASE = SERVER_URL;
