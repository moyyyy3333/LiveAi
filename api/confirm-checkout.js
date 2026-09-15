/**
 * GET /api/confirm-checkout?session_id=cs_...
 * Server-side verification that a Stripe Checkout Session actually paid,
 * used by setup.html right after the Stripe redirect. This is the real
 * paywall check — never trust a `tier` value the client sets on its own.
 *
 * Returns: { ok: true, tier, email, llc } or { ok: false, error }
 */

const Stripe = require("stripe");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(500).json({ ok: false, error: "Stripe is not configured on this deployment yet." });
    return;
  }

  const sessionId = (req.query && req.query.session_id) || new URL(req.url, "http://x").searchParams.get("session_id");

  if (!sessionId) {
    res.status(400).json({ ok: false, error: "session_id is required" });
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      res.status(200).json({ ok: false, error: "Payment not completed." });
      return;
    }

    const tier = session.metadata && session.metadata.tier;
    if (tier !== "preflight" && tier !== "sprint") {
      res.status(200).json({ ok: false, error: "Unrecognized product." });
      return;
    }

    res.status(200).json({
      ok: true,
      tier: tier,
      email: (session.customer_details && session.customer_details.email) || session.customer_email || "",
      llc: (session.metadata && session.metadata.llc) || ""
    });
  } catch (err) {
    console.error("confirm-checkout error", err);
    res.status(500).json({ ok: false, error: "Could not verify checkout session." });
  }
};
