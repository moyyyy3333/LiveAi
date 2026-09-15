/**
 * POST /api/stripe-webhook
 * Stripe webhook receiver — the durable source of truth for a completed
 * payment (the confirm-checkout redirect flow is the fast path; this is
 * the one that still fires if the customer closes the tab before the
 * redirect, or pays via a delayed method).
 *
 * On checkout.session.completed: sends the tier-unlock transactional email.
 *
 * Requires env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET   (from `stripe listen` or the Dashboard endpoint)
 *
 * IMPORTANT: this handler needs the RAW request body to verify the Stripe
 * signature. `config.api.bodyParser = false` below tells Vercel's Node.js
 * runtime not to pre-parse the body, so it can be read and hashed as-is.
 */

const Stripe = require("stripe");
const { sendEmail } = require("./_lib/resend");
const { merge, PREFLIGHT_UNLOCKED, SPRINT_UNLOCKED } = require("./_lib/templates");

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(500).send("Stripe webhook is not configured on this deployment yet.");
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("stripe-webhook signature verification failed", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const tier = session.metadata && session.metadata.tier;
      const email = (session.customer_details && session.customer_details.email) || session.customer_email;

      if (email && (tier === "preflight" || tier === "sprint")) {
        const template = tier === "sprint" ? SPRINT_UNLOCKED : PREFLIGHT_UNLOCKED;
        const vars = {
          first_name: (session.metadata && session.metadata.first_name) || "",
          llc: (session.metadata && session.metadata.llc) || ""
        };
        await sendEmail({
          to: email,
          subject: merge(template.subject, vars),
          text: merge(template.text, vars)
        });
      }
    }
  } catch (err) {
    // Don't fail the webhook over a downstream email error — Stripe will
    // retry the whole event, and the payment itself already succeeded.
    console.error("stripe-webhook post-processing error", err);
  }

  res.status(200).json({ received: true });
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
