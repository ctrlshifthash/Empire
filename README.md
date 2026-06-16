<div align="center">

<img src="client/public/favicon.svg" width="96" alt="Realm Rumble" />

# ⚔️ Realm Rumble

### Build an empire. Raid real rivals. Earn real Solana.

An **always-on, on-chain medieval strategy game** where your realm keeps producing, marching and fighting **24/7 — even while you sleep.** Raise armies, raid other real players, climb the ranks, and earn a daily share of a real **SOL** reward pool just for holding the token.

<br/>

[![Play Now](https://img.shields.io/badge/▶_Play_Now-playrealmrumble.com-e8c75a?style=for-the-badge&logoColor=white)](https://playrealmrumble.com)
[![Follow on X](https://img.shields.io/badge/Follow-@playRealmRumble-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/playRealmRumble)

<br/>

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-9945FF?style=for-the-badge&logo=solana&logoColor=white)
![Privy](https://img.shields.io/badge/Auth-Privy-6A5BFF?style=for-the-badge&logoColor=white)

</div>

---

## 🏰 What is Realm Rumble?

Realm Rumble is a persistent, browser-based real-time strategy game played on **one shared world map**. Unlike a match that ends, the world is **always running** — your buildings produce resources and your armies march around the clock, whether you're online or not.

It's also **token-gated with real rewards.** Hold the game token and a slice of a **daily 1 SOL pool** accrues to your wallet, claimable as real Solana. Don't hold the token? Play the full game for free in **demo mode** with worthless in-game coins.

> **One settlement. Four ages. A living world of rivals — and real SOL on the line.**

---

## ✨ Features

| | |
|---|---|
| 🌍 **Always-on world** | Economy and armies run 24/7; log off and your realm keeps growing. |
| 🏗️ **Build & fortify** | Lumber camps, farms, mines, barracks — then barricade with walls, towers & gates. |
| ⚔️ **Raid & spectate live** | March on rivals and watch the battle play out **live** in the isometric world as buildings are razed. |
| 🤝 **Real-player PvP** | Every ruler shares one map. Scout rival empires, spectate their base, and invade them. |
| 🎖️ **Ranks, heroes & gear** | Climb the renown ladder for permanent harvest bonuses; kit out your hero in the shop. |
| 🏛️ **Four ages of history** | Advance Dark → Feudal → Castle → Imperial, unlocking stronger buildings and units. |
| 💰 **Real SOL rewards** | A daily 1 SOL pool, split pro-rata by holdings, with a bigger multiplier for bigger holders. |
| 🎮 **Free demo mode** | No wallet? Jump straight in with worthless in-game coins and learn the ropes. |

---

## 🎮 How It Works

### The core loop

```
Gather  →  Build  →  Advance Ages  →  Train  →  Raid  →  Climb the Ranks
```

1. **Gather** — raise economy buildings that produce wood, food, gold and stone every second.
2. **Build & fortify** — spend resources on buildings, then wall off your territory.
3. **Advance** — research through four ages to unlock archers, knights and mightier structures.
4. **Train** — field spearmen, archers and knights, and gear them in the shop.
5. **Raid** — march on rival empires for loot and **spectate the battle live**.
6. **Climb** — earn renown ranks (and harvest multipliers) and complete quests for coins.

### Sign in your way

| Method | What you get |
|---|---|
| 🔗 **Solana wallet** | Empire tied to your address; holdings unlock real SOL rewards. |
| ✉️ **Email** | A full empire now; connect a wallet later from the dashboard. |
| 🎮 **Demo mode** | One click, no wallet, worthless coins — perfect for learning. |

No passwords — the same wallet or email always returns to the same empire.

---

## 💰 Token Rewards — the on-chain economy

A single pool of **1 SOL per day** is shared among **all** token holders. Your slice is **pro-rata** to your share of supply, then boosted by your **holder tier**:

```
your daily SOL  =  (your tokens ÷ total supply)  ×  1 SOL  ×  tier multiplier
```

> 🔒 **Hard-capped.** The treasury emits **at most 1 SOL per day total** across everyone. The multiplier only sets how fast you accrue (your claim priority) — never extra SOL on top of the pool.

### Holder tiers

| Tier | Supply share | Multiplier |
|---|---|---|
| 🥉 **Bronze** | any holder | `1.00×` |
| 🥈 **Silver** | ≥ 0.1% | `1.25×` |
| 🥇 **Gold** | ≥ 0.5% | `1.50×` |
| 🔷 **Sapphire** | ≥ 2% | `2.00×` |
| 💎 **Diamond** | ≥ 5% | `3.00×` |

- Holdings are read **live on-chain** (SPL-token balance vs. circulating supply).
- Rewards **accrue continuously** from the moment you're first seen holding — no need to be online.
- **First claim any time, then once every 6 hours.** Payouts are **real SOL on Solana mainnet**, sent straight from the treasury to your wallet.

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS · Zustand · React Router · HTML5 Canvas (custom isometric renderer) |
| **Realtime** | Socket.IO — live world snapshots & actions |
| **Backend** | Node.js · Express · `tsx` (runtime TypeScript) · JSON persistence |
| **Web3** | Solana Web3.js · SPL-Token · Privy (wallet + email auth) |
| **Tooling** | npm workspaces monorepo · shared types package |

---

## 📁 Project Structure

```
realm-rumble/
├── client/        # React + Vite front-end (isometric game, dashboard, site)
│   ├── src/
│   │   ├── world/     # isometric engine + renderer + character sprites
│   │   ├── game/      # in-game panels (hero, army, shop, rewards, spectate…)
│   │   ├── pages/     # landing, play, empires, dashboard, docs, guide
│   │   └── lib/       # store (Zustand), api, web3, Privy bridge
│   └── public/        # sprites, tiles, favicon
├── server/        # Node + Express + Socket.IO game server
│   └── src/           # engine, AI, combat, auth, rewards (Solana payouts)
└── shared/        # types + game data shared by client & server
```

---

## 🚀 Getting Started (local dev)

**Prerequisites:** Node.js 18+

```bash
# install
npm install

# run client (5173) + server (4000) together
npm run dev
```

Then open **http://localhost:5173**.

### Environment

Rewards are **off by default** — the game runs fully in demo mode until configured. To enable token rewards, set these (see `server/.env.example` and `client/.env.example`):

| Where | Variable | Purpose |
|---|---|---|
| `server/.env` | `TOKEN_MINT` | SPL token mint address |
| | `SOLANA_RPC` | Solana RPC endpoint |
| | `DAILY_SOL_POOL` | total SOL distributed per day (e.g. `1`) |
| | `TREASURY_SECRET_KEY` | payout wallet key (base58 or JSON array) |
| | `PRIVY_APP_SECRET` | Privy app secret |
| `client/.env` | `VITE_PRIVY_APP_ID` | Privy app id |
| | `VITE_SOLANA_RPC` | **public** RPC (baked into the browser bundle) |

> ⚠️ Never put a private RPC key in any `VITE_*` variable — those are compiled into the public client bundle.

---

## ☁️ Deployment

Realm Rumble deploys as a **single service** — the server builds and serves the client from the same origin.

- **Build:** `npm install --include=dev && npm run build`
- **Start:** `npm run start`
- Listens on `process.env.PORT`; serves `client/dist` + the API + Socket.IO.
- Mount a persistent volume at `server/data` so the world survives redeploys.

---

## 🔗 Links

[![Website](https://img.shields.io/badge/Website-playrealmrumble.com-e8c75a?style=for-the-badge&logo=googlechrome&logoColor=white)](https://playrealmrumble.com)
[![X](https://img.shields.io/badge/X-@playRealmRumble-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/playRealmRumble)

---

<div align="center">

© 2026 Realm Rumble — **Built for strategists.** ⚔️

</div>
