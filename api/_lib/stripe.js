/**
 * Shared Stripe client factory with config validation.
 * Returns actionable, non-secret error messages so a misconfigured
 * deployment fails loudly in the API response instead of only in logs.
 */

const Stripe = require("stripe");

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    return { error: "STRIPE_SECRET_KEY is not set on this deployment." };
  }

  if (!/^(sk|rk)_(live|test)_/.test(key)) {
    return {
      error:
        "STRIPE_SECRET_KEY is set but is not a Stripe secret key (expected it to start with sk_live_, sk_test_, or rk_). " +
        "If the value starts with mk_, that is the key's ID, not the key itself: in dashboard.stripe.com/apikeys click 'Reveal live key' on the Secret key row and copy that value."
    };
  }

  return { stripe: new Stripe(key) };
}

function validatePriceId(envName) {
  const value = process.env[envName];
  if (!value) return `${envName} is not set on this deployment.`;
  if (!/^price_/.test(value)) {
    return `${envName} is set but does not look like a Stripe Price ID (expected price_...). Got a value starting with '${value.slice(0, 5)}'.`;
  }
  return null;
}

// Only machine-readable, non-sensitive fields. Never the raw message.
function stripeErrorInfo(err) {
  if (!err) return {};
  return {
    stripe_error_type: err.type || undefined,
    stripe_error_code: err.code || err.rawType || undefined,
    stripe_error_param: err.param || undefined
  };
}

module.exports = { getStripe, validatePriceId, stripeErrorInfo };
