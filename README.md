# Welfare AI — local run

This is the exact app you've been previewing in this chat (`WelfareApp.jsx`), wrapped in the
minimum needed to run it on your own machine — where the camera actually works, because it's
no longer inside Claude's sandboxed preview.

## Run it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** — must be `localhost`, not a raw IP, for the camera to work
(browsers require a "secure context": `https://` or `localhost`).

## What to test

1. Log in (any of the demo role buttons on the login screen).
2. Go to **Camera check** → click **🎥 Allow Camera Access**.
3. Your browser's real permission prompt appears — click **Allow**.
4. You should see your actual webcam feed and a "🟢 Camera Active" badge.

This will behave differently than inside claude.ai specifically because this is no longer
running in an iframe — the app detects that (`window.self !== window.top`) and skips the
simulated fallback entirely on a real top-level page like this one.

## Everything else

All the other pages — Screening, Risk Insights (Mission Context, Explainable AI, Forecast,
Recommendations), Silent SOS, Consultations, Analytics, Reports, Admin views, Privacy Center —
work exactly as they did in the chat preview, since nothing about them depended on the sandbox.

I haven't been able to run `npm install` or start this dev server myself (no network access in
the environment I write code in) — if anything doesn't start cleanly, tell me the exact error
and I'll fix it against real output.
