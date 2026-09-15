# Ignition

Static site + client-side "desk" app for **ignitiondesk.biz** — a pre-flight
and 30-day trade-credit sprint product for brand-new U.S. LLCs. This
implements the Ignition Revenue Kit: a free preview tier, a $29 Pre-flight
Kit, and a $149 Sprint Pass with a scoped, evidence-based guarantee.

No build step. No framework. Plain HTML/CSS/JS so it deploys anywhere
(Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3+CloudFront, or a plain
nginx box).

## What's here

```
index.html                          Homepage: hero, sprint stages, guarantee, pricing
setup.html                          The interactive pre-flight desk (screens A–D)
terms.html                          Full terms + the 30-Day Trade-Credit Guarantee (§3)
ein-is-free.html                    SEO page — free EIN vs. paid mills
free-duns-number.html               SEO page — free D-U-N-S request vs. resellers
uline-quill-grainger-new-llc.html   SEO page — honest vendor-by-vendor breakdown
assets/styles.css                   Design system (dark, flame-accent)
assets/app.js                       Shared nav/footer behavior
assets/desk.js                      Desk state machine (localStorage, paywall gates)
emails/01–07                        The 7-email onboarding sequence, plain text
```

## Product tiers (what the code enforces)

The desk (`setup.html` + `assets/desk.js`) tracks a `tier` in
`localStorage`: `preview` → `preflight` ($29) → `sprint` ($149). Each tier
unlocks more of the same page rather than a different page, matching the
kit's "tease, don't teach" rule:

- **Preview ($0):** NAP checker, OA preview (first page + signature block,
  watermarked), EIN/bank orientation links, scam warnings.
- **Pre-flight Kit ($29):** full operating agreement, locked NAP block,
  export/print.
- **Sprint Pass ($149):** vendor packets, dated 30-day checklist, the
  30-day clock control, the guarantee.

Anything gated behind a tier is wrapped by `data-gate="preflight"` or
`data-gate="sprint"` in the HTML; `desk.js` replaces that element's content
with a paywall card (`renderGate`) until the stored tier is high enough.
**Never put vendor field-maps, order amounts, or SKU suggestions in HTML
that isn't behind a `sprint` gate** — that's the method being sold.

## Backend: Stripe Checkout + email (serverless functions)

The `/api` directory is a set of Vercel-style Node.js serverless functions
that make the paywall real, not just a `localStorage` flag:

```
api/create-checkout-session.js   POST — starts a real Stripe Checkout Session
api/confirm-checkout.js          GET  — server-side verifies payment before unlocking
api/stripe-webhook.js            POST — Stripe webhook; sends the unlock email
api/subscribe.js                 POST — sends Email 1 when the setup form's email is submitted
api/_lib/resend.js               Minimal Resend client (plain fetch, no SDK)
api/_lib/templates.js            Transactional email copy + {{merge}} tags
```

**Why this design:** `desk.js` no longer decides what's unlocked — it asks
the server. Clicking a Sprint/Pre-flight button calls
`create-checkout-session`, which redirects to real Stripe Checkout.
Stripe redirects back to `setup.html?session_id=...`, and `desk.js` calls
`confirm-checkout`, which re-checks the session with Stripe's API
(`payment_status === "paid"`) before setting the tier. A user can still
edit `localStorage` in devtools, but that no longer requires trusting the
client — the real unlock is `confirm-checkout`'s server-side check, and
`stripe-webhook` is the durable backstop if the browser never gets back to
the redirect.

If these functions aren't deployed (e.g. previewing with
`python3 -m http.server`), the fetch calls fail and `desk.js` falls back
to a local `confirm()` simulation — that's for demoing the funnel only,
never for production.

### 1. Create Stripe products

- `preflight_kit` — $29 one-time.
- `sprint_pass` — $149 one-time.

Copy each **Price ID** (`price_...`, not the Product ID).

### 2. Deploy on Vercel (or any platform that runs Node serverless functions
   the same way — Netlify Functions and Cloudflare Pages Functions need the
   handler signature adapted)

```bash
npm install
vercel --prod
```

### 3. Set environment variables (Vercel dashboard → Settings → Environment Variables)

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` / `sk_test_...` |
| `STRIPE_PRICE_PREFLIGHT` | Price ID for the $29 product |
| `STRIPE_PRICE_SPRINT` | Price ID for the $149 product |
| `STRIPE_WEBHOOK_SECRET` | From the Stripe Dashboard webhook endpoint, or `stripe listen` in dev |
| `SITE_URL` | e.g. `https://ignitiondesk.biz` (used to build Checkout redirect URLs) |
| `RESEND_API_KEY` | From resend.com — omit to log emails instead of sending (safe default in dev) |
| `RESEND_FROM` | e.g. `Ignition <help@ignitiondesk.biz>` (must be a verified Resend sending domain) |

### 4. Point a Stripe webhook at your deployment

Dashboard → Developers → Webhooks → Add endpoint:
`https://ignitiondesk.biz/api/stripe-webhook`, event: `checkout.session.completed`.
Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

For local testing: `stripe listen --forward-to localhost:3000/api/stripe-webhook`.

### 5. The required guarantee checkbox

`create-checkout-session.js` sets `consent_collection.terms_of_service =
"required"` on the Sprint Pass session, with `custom_text` quoting the
exact guarantee-scope sentence from the kit. Stripe renders this as a
required checkbox on the Checkout page itself — no extra frontend work
needed.

### What's still manual

Emails 2–7 of the nurture sequence are **not** auto-scheduled by these
functions — sending a "wait 18 hours, then day 2, day 3…" sequence
reliably needs either a database + cron (Vercel Cron can call a
`/api/cron/*` route, but you'd need to persist signup timestamps
somewhere — KV, Postgres, etc.) or, more simply, importing the
`emails/01`–`07` text into your ESP's own drip/automation feature (Resend
Broadcasts, Loops, Customer.io) and letting it handle timing. `subscribe.js`
only fires Email 1 immediately; treat wiring the rest as the next
milestone once Sprint 001 (kit §6) is running.

## Email sequence

`emails/01` through `emails/07` are the seven onboarding emails in plain
text — `api/subscribe.js` sends Email 1 immediately from the same copy
(see "Backend" above for wiring the rest). Stop the sequence for anyone
who buys the Sprint Pass and move them to a separate "clock" sequence
(day-4 DUNS reminder, day-14 vendor reminder, day-20 review prompt, day-30
audit) — not included here; build it after the first paid customer, per
the kit's sequencing.

## Guarantee — operational notes

The full, paste-ready guarantee lives in `terms.html#guarantee`. Two things
that matter operationally, not just legally:

- **Proof Pack required.** No refund or day-20 review without it (§3.5).
  Build the day-20 template as a canned response in your support inbox —
  see the kit's "Day-20 template" for the exact four-line format.
- **Refund SLA:** decide within 3 business days of a complete Proof Pack,
  pay back within 10. Slow refunds are what turn into chargebacks.

## Deploying

The pages themselves (`index.html`, `setup.html`, etc.) are plain static
files and will serve from any static host. **The paywall backend
(`/api/*`) needs a platform that runs Node.js serverless functions** —
this repo's handler signature (`module.exports = async (req, res) => {}`,
`req.query`, `res.status().json()`) is Vercel's convention:

```bash
npm install
vercel --prod
```

If you deploy the static files elsewhere (Netlify, Cloudflare Pages, GitHub
Pages, S3) instead, the `/api` calls will 404 and `desk.js` automatically
falls back to the local `confirm()` simulation described above — fine for
a design preview, not for taking real payments. To run the backend on
Netlify or Cloudflare Pages, port the functions in `/api` to that
platform's handler signature (Netlify Functions' `(event, context)`, or a
Cloudflare Pages Function's `onRequestPost({ request, env })`) — the
Stripe/Resend logic inside each file doesn't need to change.

Point `ignitiondesk.biz` DNS at whichever host you choose.

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## First-dollar checklist (from the kit, §8)

1. Homepage hero + sprint cards + pricing — done in `index.html`.
2. Terms §3 guarantee — done in `terms.html`.
3. Setup page copy — done in `setup.html`.
4. Create Stripe products $29 and $149, deploy `/api`, set env vars — see
   "Backend" above.
5. Emails 1–7 are ready; Email 1 fires automatically via `/api/subscribe` —
   see "Email sequence" above.
6. Vendor field maps hidden behind Sprint gate — enforced by `desk.js`.
7. Post the Day-1 Reddit thread (kit §5) once the desk is live.
8. Run Sprint 001 on a real entity, keep dated proof, publish the redacted
   ledger (kit §6) once you have it.
