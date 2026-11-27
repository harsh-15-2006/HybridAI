# Known limitations

## What has and has not been verified (27 November 2026)

Seen working with a real Firebase project:

- Cloud AI: a specification explanation stamped "Made by Gemini in the cloud".
- On-device AI (Chrome 157, "Gemma 4 for Built-in AI" flag, RTX 2050 laptop): a comparison and a Fit check,
  each stamped "Made on this device".
- App Check with a debug token.

Still to verify:

- On-device answers with the network off, Order help, review summary, smart search and review screening.
- Ordering, the operator area and the review index on the real project (tested on emulators only).
- Production App Check (reCAPTCHA Enterprise), Remote Config, Hosting and the Content-Security-Policy.
- No accessibility audit or screen-reader pass; colour contrast was not re-measured.

## Security and data

- Orders are placed by the browser and constrained by Security Rules. Rules check price, total, shipping, ownership
  and each stock decrease, but there is **no rate limit**: someone can create many anonymous orders (no money is
  taken) and exhaust demo stock. A production store should place orders on a trusted server. Cloud Functions would
  likely need the paid Blaze plan; confirm before enabling anything.
- An order holds at most 5 different products, 5 of each, because rules cannot loop.
- Operators can read all orders, including addresses. Use made-up details.
- Published reviews are public; pending and rejected ones are visible only to their author and operators.
- App Check verifies the app, not the person, and is not anonymisation.
- The check for contact details in typed questions is a simple pattern match.
- `npm audit` reports 4 high-severity advisories through `@grpc/grpc-js`, a dependency of `@firebase/firestore`.
  No matching string was found in the built web bundle. The suggested "fix" downgrades Firebase and was not applied.

## AI

- The price check rejects rupee amounts that were not in the prompt, and any dollar amount. It cannot catch other invented facts; the
  store's own figures stay visible beside every answer.
- Photo Match (F5) is not implemented.
- Cloud input size is limited by field length caps, not token counting.

## Product

- Guest orders live with the browser's anonymous account; clearing site data loses access. Account linking is not built.
- Signing in as operator replaces the guest session on the same origin.
- No courier, real payment, real refund, email, cart sync or product editor.
- On first load with an unreachable backend the catalogue shows "Loading" for up to 15 seconds before falling back.
- Cart and preferences are not synchronised between open tabs.
- Phones get the full store; on-device AI needs desktop Chrome.
- The offline app shell was checked on a production build without a Firebase project (bundled catalogue).
  The Firestore-backed offline fallback was not separately tested.
- Browser back/forward to a lazy page that was never cached will not open offline.
