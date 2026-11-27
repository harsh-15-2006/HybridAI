# Setup and deployment

Console menu names can move; follow the linked official guides if a label differs.
Steps 1 to 3 have been run against a real project. Hosting (step 5) has not been run yet.

## 1. Firebase project (console)

1. Create a project at https://console.firebase.google.com (Analytics not needed). Stay on the free Spark plan.
2. **Project settings → Your apps → Web**: register an app and copy its config into `.env.local`.
3. **AI Services → AI Logic → Get started**: choose the **Gemini Developer API**.
4. **Security → App Check**
   - Apps: register the web app with **reCAPTCHA Enterprise** and copy the site key to `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`. Add your hosting domain to the key's allowed domains. Do **not** add `localhost`.
   - APIs: confirm **Firebase AI Logic** is enforced.
5. **Authentication → Sign-in method**: enable **Anonymous** and **Email/Password**.
6. **Firestore Database**: create it in production mode.
7. Optional **Remote Config** keys: `cloud_model`, `feature_f7_enabled`, `max_reviews_digest`, `max_compare_items`, `default_privacy_setting` (`ask` or `device`).

reCAPTCHA Enterprise has its own quota and billing terms. Check them before enabling; do not accept a billing
prompt unless you intend to.

## 2. Local development against the project

```
copy .env.example .env.local
```

Fill in the values, set `VITE_APPCHECK_DEBUG=true`, then `npm run dev`. Open the browser console, copy the printed
App Check debug token, and register it under **App Check → Apps → Manage debug tokens**. Never commit it.

## 3. Rules, indexes and data

```
firebase login
firebase deploy --only firestore --project YOUR_PROJECT_ID
```

Seeding needs a service-account key (**Project settings → Service accounts**). Save it **outside the repository**.

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\keys\hybridcart-admin.json"; $env:GCLOUD_PROJECT="YOUR_PROJECT_ID"; npm run seed -- --yes
```

Seeding overwrites the demo products and resets their stock.

## 4. Operator account

See [ADMIN_SETUP.md](ADMIN_SETUP.md).

## 5. Deploy to Hosting

Build with production values in `.env.local` (leave `VITE_APPCHECK_DEBUG` empty and `VITE_USE_EMULATORS=false`):

```
npm run build
firebase deploy --only hosting --project YOUR_PROJECT_ID
```

Then on the live URL check: no Content-Security-Policy errors in the console (`firebase.json` sets one that has not
been tested on a live site), App Check requests succeed, a conversation answers with a blue "cloud" stamp, and an
order can be placed with the sample address.

## On-device AI

Needed on the machine that records the demo:

1. Chrome desktop 139 or later, updated.
2. **At least 22 GB free on the drive holding the Chrome profile.**
3. `chrome://flags` → search **Gemma 4 for Built-in AI** → Enabled. The hackathon FAQ gives this as the way to get
   **Gemini Nano 4**, the model the rules name. Also enable
   `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` (Firebase's guide), then restart Chrome.
   With only the second flag, a test profile requested a `nano_v3` model.
4. In DevTools on the app's page run `await LanguageModel.availability()`.
5. Click **Set up private AI** in the app (this must be a real click), wait for the download.
6. `chrome://on-device-internals` shows the model state.

If drive C: is too full, a separate Chrome profile on another drive should satisfy the storage rule (untested):

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\hc-chrome-profile" http://localhost:5173
```

If the download stays at 0%, check the free space on the drive holding Windows temporary files (about 9 GB is
needed). To send them elsewhere for this Chrome only, close it and start it from PowerShell:

```powershell
$env:TEMP="D:\hc-temp"; $env:TMP="D:\hc-temp"; & "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\hc-chrome-profile" http://localhost:5173
```

## Testing the hybrid features

| Check | How | Expect |
|---|---|---|
| Local explanation | Product page → Explain → Explain this value with AI | Green stamp, `ON_DEVICE` |
| Fit check | Save preferences on **You**, then Check my fit | Green stamp; ledger shows nothing sent |
| Consent | Use a browser without the model, setting "Ask me each time" | Sheet lists the fields; "Keep on device" sends nothing (DevTools → Network) |
| Cloud | Ask about this product → Send to cloud | Blue stamp, `IN_CLOUD` |
| Offline | With the model ready, turn Wi-Fi off, run Fit check and Order help | Both still answer |
| Device only | Set it on **You** | Conversations disabled; no cloud requests |
