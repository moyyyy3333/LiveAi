/**
 * Transactional + sequence email templates.
 * Mirrors the plain-text copies in /emails for the nurture sequence,
 * plus two transactional templates triggered by Stripe events.
 * Merge tags: {{first_name}}, {{llc}}
 */

function merge(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, function (_, key) {
    var v = vars[key];
    return v && String(v).trim() ? v : (key === "first_name" ? "there" : "your LLC");
  });
}

const EMAIL_1_IMMEDIATE = {
  subject: "{{llc}} is on the desk. Export it tonight.",
  text:
    "{{first_name}} —\n\n" +
    "Pre-flight is open for {{llc}}.\n\n" +
    "Two things that are true on this version of the desk:\n\n" +
    "1. The company file lives in this browser until you export it.\n" +
    "2. The 30-day clock has not started. It starts the day the LLC checking account opens.\n\n" +
    "Tonight: open the desk, lock the legal name exactly as the state has it, and export. If you clear cookies next week and have no export, the file is gone. That is not a metaphor.\n\n" +
    "What you can do for $0: see the NAP rules, read the scam list, look at the operating-agreement preview.\n\n" +
    "What you cannot do yet: the vendor packets and the dated checklist. Those are the Sprint Pass, because they are the part that has to be right on a Tuesday, not interesting on a Sunday.\n\n" +
    "Desk: https://ignitiondesk.biz/setup.html\n\n" +
    "— Ignition\nhelp@ignitiondesk.biz"
};

const PREFLIGHT_UNLOCKED = {
  subject: "Pre-flight Kit unlocked for {{llc}}",
  text:
    "{{first_name}} —\n\n" +
    "The Pre-flight Kit is unlocked for {{llc}}. The full operating agreement, the locked NAP block, and the EIN/bank walkthroughs are ready on the desk.\n\n" +
    "Desk: https://ignitiondesk.biz/setup.html\n\n" +
    "If you decide you want the vendor packets, the dated 30-day checklist, and the guarantee later, the Sprint Pass upgrade is on the same page.\n\n" +
    "— Ignition\nhelp@ignitiondesk.biz"
};

const SPRINT_UNLOCKED = {
  subject: "Sprint Pass unlocked for {{llc}} — the clock is yours to start",
  text:
    "{{first_name}} —\n\n" +
    "The Sprint Pass is unlocked for {{llc}}. The vendor packets, the DUNS request packet, and the dated 30-day checklist are ready on the desk.\n\n" +
    "The clock does not start on its own — start it the day your LLC's business checking account opens. From that date: submit the free D-U-N-S request by day 4, submit the three vendor applications on their assigned days, and place the required first orders from the LLC account.\n\n" +
    "Nothing approved by day 20? Reply to this email with your Proof Pack (see the Terms page) and we'll send back a written review plus one revised packet, included.\n\n" +
    "Desk: https://ignitiondesk.biz/setup.html\n" +
    "Guarantee terms: https://ignitiondesk.biz/terms.html#guarantee\n\n" +
    "— Matthew\nIgnition\nhelp@ignitiondesk.biz"
};

module.exports = { merge, EMAIL_1_IMMEDIATE, PREFLIGHT_UNLOCKED, SPRINT_UNLOCKED };
