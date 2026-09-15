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

## Stripe setup (required before taking real money)

1. Create two Products in Stripe:
   - `preflight_kit` — $29 one-time.
   - `sprint_pass` — $149 one-time. Add a required checkbox at checkout
     (Stripe Checkout custom fields, or a pre-checkout confirmation step)
     quoting: *"I understand the 30-day guarantee is a refund on the Sprint
     Pass, depends on my on-time steps, and is defined in the Terms."*
2. Generate a Payment Link for each product. On success, redirect back to
   `setup.html?unlocked=preflight` / `setup.html?unlocked=sprint`.
3. Set the two links in `setup.html`:
   ```html
   <script>
     window.IGNITION_CONFIG = {
       stripePreflightLink: "https://buy.stripe.com/xxxxx",
       stripeSprintLink: "https://buy.stripe.com/yyyyy"
     };
   </script>
   ```
4. `desk.js` currently unlocks a tier locally when Stripe links are absent
   (a `confirm()` dev fallback) so the funnel is demoable before Stripe is
   wired up. Once real links are set, that fallback is unreachable — the
   button navigates to Stripe instead. **The actual unlock still needs a
   server**: after a successful Stripe payment, verify the webhook
   server-side and email the customer their unlock link (or set a signed
   cookie/token the desk checks). Client-only `localStorage` unlocking is
   fine for a demo; it is not sufficient for a paid product, since a user
   could set `tier: "sprint"` in devtools. Treat the current client-side
   gate as UX polish, not the real paywall, until that backend exists.

## Email sequence

`emails/01` through `emails/07` are the seven onboarding emails, ready to
paste into Resend, Postmark, Buttondown, or MailerLite. Trigger email 1 on
`setup.html` form submit (capture `{{first_name}}`, `{{llc}}`, and email
into your ESP or a lightweight serverless function). Stop the sequence for
anyone who buys the Sprint Pass and move them to a separate "clock"
sequence (day-4 DUNS reminder, day-14 vendor reminder, day-20 review
prompt, day-30 audit) — not included here; build it after the first paid
customer, per the kit's sequencing.

## Guarantee — operational notes

The full, paste-ready guarantee lives in `terms.html#guarantee`. Two things
that matter operationally, not just legally:

- **Proof Pack required.** No refund or day-20 review without it (§3.5).
  Build the day-20 template as a canned response in your support inbox —
  see the kit's "Day-20 template" for the exact four-line format.
- **Refund SLA:** decide within 3 business days of a complete Proof Pack,
  pay back within 10. Slow refunds are what turn into chargebacks.

## Deploying

Any static host works. Example with Netlify:

```bash
netlify deploy --prod --dir .
```

Or Vercel:

```bash
vercel --prod
```

Point `ignitiondesk.biz` DNS at whichever host you choose. No environment
variables are required for the static site itself; Stripe keys live in
Stripe's dashboard/webhook config, not in this repo.

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## First-dollar checklist (from the kit, §8)

1. Homepage hero + sprint cards + pricing — done in `index.html`.
2. Terms §3 guarantee — done in `terms.html`.
3. Setup page copy — done in `setup.html`.
4. Create Stripe products $29 and $149 — see "Stripe setup" above.
5. Load emails 1–7, trigger email 1 on setup form submit — see "Email
   sequence" above.
6. Vendor field maps hidden behind Sprint gate — enforced by `desk.js`.
7. Post the Day-1 Reddit thread (kit §5) once the desk is live.
8. Run Sprint 001 on a real entity, keep dated proof, publish the redacted
   ledger (kit §6) once you have it.
