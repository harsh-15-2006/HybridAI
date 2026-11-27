# Technical research

**Access date:** 26 November 2026. Pages were downloaded and read as text; long pages were searched for the
relevant sections rather than read end to end. SDK behaviour was read from the installed package
(`node_modules/@firebase/ai`, firebase **13.4.0**).

Three kinds of statement are kept apart below: **Official** (rules or vendor documentation),
**SDK** (read in installed type declarations or code) and **Our decision**.

## Official requirements (hackathon)

Sources: [rules](https://firebasehybridaihackathon.devpost.com/rules),
[FAQ](https://firebasehybridaihackathon.devpost.com/details/faqs).

- Gen AI app built with Firebase AI Logic; all AI inference through it.
- Platform: Web (Chrome), Android or iOS. One platform is allowed.
- App Check required; debug tokens accepted.
- Public GitHub/GitLab repository with an open-source licence visible in About; AI Logic imported and called at runtime.
- Public YouTube video, at most 3 minutes, English or English subtitles, showing the app on its platform.
- Text description: use of Firebase AI Logic, features, value proposition.
- No production keys, live secrets, confidential data or PII in repo, form or instructions.
- Submission closes **30 November 2026, 2:00 PM PT** (1 December, 3:30 AM IST). Later commits are not evaluated.
- Judging: Technological Implementation, Design, Potential Impact, Quality of the Idea (equal weight).

## Verified capabilities

### Hybrid inference on the web
Sources: [get started](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started),
[configuration](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options),
[structured output](https://firebase.google.com/docs/ai-logic/hybrid/web/generate-structured-output).

- Official: SDK 12.5.0+, Chrome desktop 139+; flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`.
- Official: modes `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, `ONLY_IN_CLOUD`; `response.inferenceSource` is `ON_DEVICE` or `IN_CLOUD`.
- Official: on-device is single-turn only; text, or text with JPEG/PNG; JSON and enum output supported.
- Official: structured output uses `responseConstraint` (in `onDeviceParams.promptOptions`) on device and `responseMimeType` + `responseSchema` (in `inCloudParams.generationConfig`) in the cloud.
- Official: call `initializeDeviceModel()` after a user interaction. `ONLY_ON_DEVICE` waits for a download; `PREFER_*` falls back to the cloud meanwhile.
- Official: default cloud model `gemini-3.5-flash-lite` (SDK 13+). Not supported for hybrid: Live API, server prompt templates, `countTokens`.

Imports used: `getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode`, `InferenceSource`, `Schema` from `firebase/ai`.

### What the installed SDK actually does (SDK)

| Finding | Consequence in this app |
|---|---|
| The on-device adapter sends only `contents` and `promptOptions`; `systemInstruction` reaches the cloud only | Instructions are part of the prompt text |
| For `ONLY_ON_DEVICE` with a downloadable model, `isAvailable` returns true and a session `create()` follows, which can start or wait on a download | `run.ts` checks `LanguageModel.availability()` first and runs on device only when it reports `available` |
| `PREFER_ON_DEVICE` chooses on device only when availability is `available`; it does not fall back if the on-device call itself throws | Failures are reported, not silently re-sent |
| Creating a new on-device session destroys the previous one | On-device calls are queued one at a time |
| `TextPart` has a required `type: 'text'` in 13.4.0 types | Chat history parts set it |

### Chrome Prompt API
Source: [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) (updated 21 October 2026).
Official: Windows 10/11, macOS 13+, Linux or ChromeOS (Chromebook Plus); not Android or iOS; at least 22 GB free on
the volume holding the Chrome profile; GPU with more than 4 GB VRAM **or** 16 GB RAM and 4+ cores; unmetered network
for the first download; downloading needs user activation; Chrome states no data is sent to Google or third parties
when using the model.

### Models and App Check
Sources: [models](https://firebase.google.com/docs/ai-logic/models), [App Check](https://firebase.google.com/docs/ai-logic/app-check).
Official: `gemini-3.5-flash-lite` is listed as stable (released 21 July 2026), billing not required.
`gemini-4-hydrogen` is also listed as billing not required. App Check was automatically enforced for AI Logic on
2 November 2026; web production provider reCAPTCHA Enterprise; debug provider for local development.

### Firestore, rules, auth
Sources: [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions),
[rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions),
[custom claims](https://firebase.google.com/docs/auth/admin/custom-claims).

- Official: transactions may be retried, must not change application state inside the function, and fail offline.
- Official: rules can use `getAfter()` to check related writes in one commit.
- Official: rules allow 10 document access calls for single-document requests and 20 for transactions and batched writes, with the 10 limit applying to each operation.
- Official: custom claims are set from a privileged server environment with the Admin SDK and reach the client with the next ID token.

## Our decisions

- **Stack:** React 19, Vite 8, TypeScript 6.0 (typescript-eslint did not yet accept 7), React Router 8, Zod 4, idb, Fontsource fonts. The repository was empty, so there was nothing to migrate.
- **Model:** `gemini-3.5-flash-lite`, overridable with Remote Config key `cloud_model`.
- **Routing:** see `src/ai/policy.ts`. In "Ask me each time" no preferred mode is used.
- **Output checks:** Zod schemas, one retry, and rejection of any rupee amount not present in the prompt (and of any dollar amount).
- **Order placement:** client transaction guarded by rules; at most 5 lines per order so the rules stay within access-call limits (10 calls for a five-line order document, 16 for the whole commit, counted from the rules).
- **Money:** Indian rupees stored as integer paise, in fields named `...Cents`.
- **Region of free tier and quotas:** not researched; see limitations.

## Corrections to the specification

| architecture.md said | Finding |
|---|---|
| On-device structured output parameters unverified (C4) | `onDeviceParams.promptOptions.responseConstraint`, per official hybrid structured-output page and SDK |
| Availability check unverified (§7.3) | `LanguageModel.availability()` with the same options the SDK uses |
| SDK method names unverified | `generateContent`, `generateContentStream`, `startChat().sendMessageStream` |
| Rules syntax unverified | Written and tested against the emulator |
| Font licences unverified (§4.4) | Both packages ship the SIL OFL 1.1 |
| `products.price` | Stored as `priceCents`; `specs` is an ordered list |

## Verification status (27 November 2026)

- On-device inference ran in Chrome 157 on an RTX 2050 laptop (4 GB). `chrome://on-device-internals` reported
  the device as capable and chose `gemma4_gpu_low_tier_model`. A comparison and a Fit check returned valid
  structured output stamped on-device.
- The model download stalled at 0% until Chrome's temporary folder had enough free space: the component updater
  logged `required_bytes: 8539875442` against about 4.9 GB available. Launching Chrome with `TEMP` and `TMP`
  on a larger drive fixed it.
- Cloud inference ran through Firebase AI Logic with App Check (debug token).

## Not verified

- Free-tier rate limits, Cloud Functions billing and reCAPTCHA Enterprise pricing were not researched.
- Firebase Agent Skills were not used in this build session.
