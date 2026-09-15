/**
 * Minimal Resend client (plain fetch — no SDK dependency).
 * Requires RESEND_API_KEY. Falls back to a console log in dev if the
 * key is missing, so local testing doesn't hard-fail.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Ignition <help@ignitiondesk.biz>";

  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY not set — logging email instead of sending.", {
      to,
      subject
    });
    return { simulated: true };
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, subject, text })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }

  return res.json();
}

module.exports = { sendEmail };
