# Demo script and submission checklist

On-device AI works on the team laptop. Test every step again before recording and show only what really happens.

## Video (3:00 maximum)

Prepare: hosted site, saved preferences ("wears glasses", "long flights", "up to ₹10,000"), empty AI activity,
operator signed in on a private window, one delivered order.

| Time | Show | Say |
|---|---|---|
| 0:00–0:30 | Home, then a spec explanation with its green stamp | Who it is for, the problem, and that Firebase AI Logic runs it on the device or in the cloud |
| 0:30–1:15 | Search → product → Fit check → Compare | The preferences stay in the browser; open the stamp |
| 1:15–1:40 | Add to cart → checkout (sample address) → order page | Prices and stock come from the store, never from AI |
| 1:40–2:05 | Wi-Fi off → Fit check and Order help answer | Same features, no network |
| 2:05–2:35 | Wi-Fi on → Ask about a product → consent sheet → Send → blue stamp | You see what is sent before it goes |
| 2:35–2:50 | AI activity table | Every request, where it ran, what was sent |
| 2:50–3:00 | Operator marks shipped; shopper refreshes | Close on the value proposition |

To show the consent sheet on a machine with the model, use "Ask about a product": conversations are cloud-only.
No third-party logos or trademarks in frame.

## Devpost description (draft, edit to match what you verify)

HybridCart is a web store for people choosing technical products who do not want to hand over personal details to
get advice. Firebase AI Logic runs fit checks and order questions with `ONLY_ON_DEVICE`, product explanations on
the device first, and multi-turn questions in the cloud with `ONLY_IN_CLOUD` after the shopper sees what will be
sent. Each answer is stamped from `response.inferenceSource`, and a local ledger records it. The store is complete:
catalogue, comparison, stock-safe ordering, status tracking, returns, support, moderated reviews and an operator area.

## Submission checklist

- [ ] Every team member confirms eligibility; all added on Devpost
- [ ] On-device and cloud paths verified on a real machine
- [ ] Firebase project configured, App Check enforced, rules deployed, catalogue seeded
- [ ] Hosted URL works from a fresh browser profile
- [ ] Code reviewed, committed and pushed to `main`; repository public
- [ ] GitHub "About" shows Apache-2.0
- [ ] No `.env.local`, debug token or service-account file in the repository
- [ ] Platform selected: Web (Chrome)
- [ ] Text description, public YouTube video (≤ 3:00), testing instructions with sample address and operator login
- [ ] Disclosure: built during the submission period with an AI coding assistant
- [ ] Submitted well before **1 Dec 2026, 3:30 AM IST**
