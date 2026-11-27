# Operator (admin) access

The operator area is `/admin`. Access is a Firebase Authentication custom claim `admin: true`. It can only be set
with the Admin SDK from a trusted machine. The browser cannot grant it, and Security Rules check it on every write.

## Real project

1. Console → **Authentication → Users → Add user** (email and a strong password).
2. On your machine, with a service-account key stored outside the repository:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\keys\hybridcart-admin.json"; $env:GCLOUD_PROJECT="YOUR_PROJECT_ID"; npm run set-admin -- operator@your-domain.example
```

3. Sign in at `/admin` (sign out and in again if already signed in, so the token refreshes).

Remove access with the same command plus `--remove`.

For judges, put the operator test login in the Devpost testing instructions only, never in the repository.

## Emulator

With `npm run emulators` running, choose any test email and password:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"; npm run set-admin -- operator@example.test --create "choose-a-test-password"
```

These accounts exist only in the running emulator and disappear when it stops.

## Keeping shopper and operator side by side

Signing in as operator replaces the guest shopper session **in the same browser origin**. Use a private window for
the operator, or locally use `http://localhost:5173` for the shopper and `http://127.0.0.1:5173/admin` for the operator.

## What an operator can do

Move orders (placed → packed → shipped → delivered, or cancel with restock), change stock, approve or decline
returns and record a simulated refund, reply to support messages, and publish or reject reviews (with an optional
AI suggestion; the person decides).
