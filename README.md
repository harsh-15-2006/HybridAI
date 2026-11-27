# HybridCart AI

<img src="public/brand/logo.png" alt="HybridCart logo: a shopping cart carrying the letter H" width="96">

**Advice that knows you, without your details leaving your device.**

HybridCart is a demonstration electronics store built for #BuildHybridAI 2026. It uses Firebase AI Logic to run
AI on the shopper's own computer with Chrome's on-device model, and in the cloud with Gemini only where the
app's privacy policy allows it. Every answer carries a stamp showing where it was made.

Platform: **Web (Chrome desktop)**. All brands, products and sample reviews are fictional. Payment is simulated.

## The problem

Good advice on technical products needs personal context: budget, comfort needs, room size, order details.
Sending that to a cloud model is a price many shoppers will not pay. HybridCart keeps personal context on the
device and still gives a complete store: browse, compare, buy, track, return and get help.

## How Firebase AI Logic is used at runtime

| Where | What it does |
|---|---|
| [`src/ai/models.ts`](src/ai/models.ts) | The only module importing `firebase/ai`: `getAI`, `getGenerativeModel` with `InferenceMode`, `generateContent`, `generateContentStream`, `startChat`, `initializeDeviceModel`, `response.inferenceSource` |
| [`src/ai/policy.ts`](src/ai/policy.ts) | Decides the permitted path from the feature's data and the privacy setting |
| [`src/ai/run.ts`](src/ai/run.ts) | Availability check, consent, privacy guard, validation, ledger |
| [`src/ai/prompts.ts`](src/ai/prompts.ts) | One prompt builder per feature, each declaring the fields it sends |

| Feature | Data | Mode |
|---|---|---|
| Spec explainer (F1) | Public | On device first; cloud by setting or consent |
| Fit check (F2) | **Preferences** | `ONLY_ON_DEVICE`, always |
| Comparison (F3) | Public, or **preferences** | With preferences: `ONLY_ON_DEVICE` |
| Review summary (F4) | Written text | On device; cloud only with consent |
| Smart search (F6) | Shopper's words | On device; cloud only with consent |
| Ask anything (F7) | Question and public specs | `ONLY_IN_CLOUD`, multi-turn |
| Order help (F8) | **Order** | `ONLY_ON_DEVICE`, always |
| Review screening (F9) | Review text | On device; cloud only with consent; a person decides |

Photo match (F5) is **not implemented**.

Privacy settings: **Device only** (never cloud), **Ask me each time** (default: try `ONLY_ON_DEVICE`, then show
what would be sent and use a separate `ONLY_IN_CLOUD` request only after "Send to cloud"), and **Cloud for product
questions** (`PREFER_ON_DEVICE` for public catalogue facts only).

## Requirements

- Node.js 22.22 or later (React Router 8 requires it)
- For emulator mode: Firebase CLI and Java 21
- For on-device AI: Chrome desktop 139 or later with the Prompt API available, about 22 GB free on the drive holding
  the Chrome profile, and more than 4 GB VRAM or 16 GB RAM with 4+ cores. See
  [setup](docs/SETUP_AND_DEPLOYMENT.md#on-device-ai).

## Run it without a Firebase project (emulators)

```
npm install
npm run emulators          # terminal 1
npm run seed:emulator      # terminal 2, once per emulator start
npm run dev:emulator       # terminal 2
```

Open http://localhost:5173. The store, orders and operator area work. Cloud AI is off in this mode; on-device AI
works if your Chrome supports it. Operator account: see [admin setup](docs/ADMIN_SETUP.md).

## Run it against your Firebase project

Copy `.env.example` to `.env.local`, fill it in, then `npm run dev`. Full steps, including AI Logic, App Check,
seeding and deployment: [docs/SETUP_AND_DEPLOYMENT.md](docs/SETUP_AND_DEPLOYMENT.md).

## Checks

```
npm run typecheck
npm run lint
npm test                   # routing, consent, prompts, validators, store logic
npm run test:rules         # Security Rules and order transactions in the Firestore emulator
npm run build
```

## What is real and what is demonstration only

| Real | Demonstration only |
|---|---|
| Orders, stock transaction, order status, returns, support tickets, review moderation (in Firestore) | Payment and refunds (nothing is charged) |
| Security Rules, admin custom claim | Courier tracking (an operator sets status) |
| AI routing, consent, validation, activity ledger | Catalogue, brands, prices, sample reviews, illustrations |

## Documentation

- [Technical research](docs/TECHNICAL_RESEARCH.md)
- [Setup and deployment](docs/SETUP_AND_DEPLOYMENT.md)
- [Admin setup](docs/ADMIN_SETUP.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Demo script and submission checklist](docs/DEMO_SCRIPT.md)
- [Product specification](architecture.md)

## Pre-existing work and tools

The code in this repository was written during the submission period, starting from an empty repository.
It was produced with an AI coding assistant (Claude Code). The team's specification and logo were inputs.
No code from earlier projects is included.

## Licences

Code: [Apache-2.0](LICENSE). Fonts: Familjen Grotesk and Atkinson Hyperlegible Next, bundled through Fontsource
under the SIL Open Font License 1.1. Product illustrations are generated by `scripts/make-art.ts`.
