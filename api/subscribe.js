/**
 * POST /api/subscribe
 * Body: { email, first_name, llc }
 * Fires Email 1 of the onboarding sequence immediately. Emails 2–7 are
 * time-delayed (18h, day 2, 3, 4, 5, 7) and belong in your ESP's
 * automation (Resend Broadcasts, Loops, Customer.io, etc.) rather than in
 * a stateless serverless function — see README.md → "Email sequence".
 *
 * Requires env vars: RESEND_API_KEY, RESEND_FROM (optional)
 */

const { sendEmail } = require("./_lib/resend");
const { merge, EMAIL_1_IMMEDIATE } = require("./_lib/templates");

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch (e) {
      res.status(400).json({ ok: false, error: "Invalid JSON body" });
      return;
    }
  }

  const { email, first_name, llc } = body || {};

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "A valid email is required." });
    return;
  }

  try {
    const vars = { first_name: first_name || "", llc: llc || "" };
    await sendEmail({
      to: email,
      subject: merge(EMAIL_1_IMMEDIATE.subject, vars),
      text: merge(EMAIL_1_IMMEDIATE.text, vars)
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("subscribe error", err);
    res.status(500).json({ ok: false, error: "Could not send the email right now." });
  }
};
