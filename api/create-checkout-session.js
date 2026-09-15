/**
 * POST /api/create-checkout-session
 * Body: { tier: "preflight" | "sprint", email, llc, first_name }
 * Returns: { url } — redirect the browser to Stripe Checkout.
 *
 * Requires env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_PREFLIGHT   (Stripe Price ID for the $29 product)
 *   STRIPE_PRICE_SPRINT      (Stripe Price ID for the $149 product)
 *   SITE_URL                 (e.g. https://ignitiondesk.biz — used for redirect URLs)
 */

const { getStripe, validatePriceId, stripeErrorInfo } = require("./_lib/stripe");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const client = getStripe();
  if (client.error) {
    res.status(500).json({ error: client.error });
    return;
  }
  const stripe = client.stripe;

  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch (e) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  }

  const { tier, email, llc, first_name } = body || {};

  const priceIds = {
    preflight: process.env.STRIPE_PRICE_PREFLIGHT,
    sprint: process.env.STRIPE_PRICE_SPRINT
  };

  if (tier !== "preflight" && tier !== "sprint") {
    res.status(400).json({ error: "tier must be 'preflight' or 'sprint'" });
    return;
  }

  const priceEnvName = tier === "sprint" ? "STRIPE_PRICE_SPRINT" : "STRIPE_PRICE_PREFLIGHT";
  const priceError = validatePriceId(priceEnvName);
  if (priceError) {
    res.status(500).json({ error: priceError });
    return;
  }
  const priceId = priceIds[tier];

  const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

  try {
    const sessionParams = {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/setup.html?session_id={CHECKOUT_SESSION_ID}&unlocked=${tier}`,
      cancel_url: `${siteUrl}/setup.html?checkout=cancelled`,
      metadata: {
        tier: tier,
        llc: (llc || "").slice(0, 200),
        first_name: (first_name || "").slice(0, 100)
      }
    };

    if (email) {
      sessionParams.customer_email = email;
    }

    // Sprint Pass requires the guarantee-scope acknowledgment at checkout.
    if (tier === "sprint") {
      sessionParams.consent_collection = { terms_of_service: "required" };
      sessionParams.custom_text = {
        terms_of_service_acceptance: {
          message:
            "I understand the 30-day guarantee is a refund on the Sprint Pass, depends on my on-time steps, and is defined in the [Terms](" +
            siteUrl +
            "/terms.html#guarantee)."
        }
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error", err);
    res.status(500).json(Object.assign({ error: "Could not start checkout." }, stripeErrorInfo(err)));
  }
};
