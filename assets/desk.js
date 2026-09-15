/* ==========================================================================
   Ignition Desk — pre-flight state machine
   Pure client-side, localStorage-backed. No server required.
   Tiers: preview (free) -> preflight ($29) -> sprint ($149)
   ========================================================================== */

(function () {
  "use strict";

  var STORE_KEY = "ignition_desk_v1";

  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function defaultState() {
    return {
      llc: "",
      state_of_formation: "",
      signer: "",
      email: "",
      tier: "preview", // preview | preflight | sprint
      nap_locked: false,
      nap_name: "",
      nap_address: "",
      nap_phone: "",
      oa_unlocked: false,
      ein_started: false,
      bank_started: false,
      clock_started_at: null,
      created_at: new Date().toISOString()
    };
  }

  function saveState(state) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  var state = loadState();

  function set(patch) {
    state = Object.assign({}, state, patch);
    saveState(state);
    render();
  }

  window.IgnitionDesk = {
    getState: function () { return state; },
    set: set,
    reset: function () {
      localStorage.removeItem(STORE_KEY);
      state = defaultState();
      render();
    }
  };

  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }
  window.deskToast = toast;

  function esc(s) {
    return (s || "").replace(/[<>&]/g, function (c) {
      return c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;";
    });
  }

  function fmtName(v) { return (v || "").trim(); }

  function daysRemaining() {
    if (!state.clock_started_at) return null;
    var start = new Date(state.clock_started_at).getTime();
    var elapsed = Math.floor((Date.now() - start) / 86400000);
    return Math.max(0, 30 - elapsed);
  }

  function render() {
    // Onboarding form fields (Screen entry)
    var llcInput = document.getElementById("f-llc");
    var stateInput = document.getElementById("f-state");
    var signerInput = document.getElementById("f-signer");
    var emailInput = document.getElementById("f-email");

    if (llcInput && !llcInput.dataset.bound) {
      llcInput.value = state.llc;
      stateInput.value = state.state_of_formation;
      signerInput.value = state.signer;
      emailInput.value = state.email;
      [llcInput, stateInput, signerInput, emailInput].forEach(function (el) {
        el.dataset.bound = "1";
        el.addEventListener("input", function () {
          set({
            llc: llcInput.value,
            state_of_formation: stateInput.value,
            signer: signerInput.value,
            email: emailInput.value
          });
        });
      });
    }

    var llcNameEls = document.querySelectorAll("[data-llc-name]");
    llcNameEls.forEach(function (el) {
      el.textContent = fmtName(state.llc) || "your LLC";
    });

    renderStatusPanel();
    renderScreens();
  }

  function statusRow(label, value, dotClass, valClass) {
    return (
      '<div class="status-row"><span class="status-label">' +
      '<span class="status-dot ' + dotClass + '"></span>' + label +
      '</span><span class="status-val ' + (valClass || "") + '">' + value + "</span></div>"
    );
  }

  function renderStatusPanel() {
    var panel = document.getElementById("status-panel");
    if (!panel) return;

    var napDone = state.nap_locked;
    var oaDone = state.tier !== "preview";
    var einDone = state.ein_started;
    var bankDone = state.bank_started;
    var clockDone = !!state.clock_started_at;
    var vendorsUnlocked = state.tier === "sprint";

    var html = "";
    html += statusRow("NAP lock", napDone ? "Locked" : "Incomplete", napDone ? "done" : "progress", napDone ? "done" : "");
    html += statusRow("Operating agreement", oaDone ? "Full" : "Preview", oaDone ? "done" : "progress", oaDone ? "done" : "");
    html += statusRow("EIN", einDone ? "In progress" : "Not started", einDone ? "progress" : "locked");
    html += statusRow("Business bank", bankDone ? "In progress" : "Not started", bankDone ? "progress" : "locked");
    html += statusRow("30-day clock", clockDone ? daysRemaining() + "d left" : "Not started", clockDone ? "progress" : "locked");
    html += statusRow("Vendor packets", vendorsUnlocked ? "Unlocked" : "Locked", vendorsUnlocked ? "done" : "locked");

    panel.innerHTML = html;

    var tierBadge = document.getElementById("tier-badge");
    if (tierBadge) {
      var labels = { preview: "Preview · $0", preflight: "Pre-flight Kit · $29", sprint: "Sprint Pass · $149" };
      tierBadge.textContent = labels[state.tier] || labels.preview;
      tierBadge.className = "tag " + (state.tier === "sprint" ? "tag-open" : "tag-locked");
    }
  }

  function renderScreens() {
    // Screen A: welcome / export banner
    var welcome = document.getElementById("screen-a");
    if (welcome) {
      var llcName = fmtName(state.llc) || "Your LLC";
      welcome.innerHTML =
        '<h3>' + esc(llcName) + ' is on the desk.</h3>' +
        '<p>Pre-flight is open. Export this file tonight — browser storage can vanish the moment you clear cookies or switch devices.</p>' +
        '<div class="btn-row" style="display:flex;gap:12px;flex-wrap:wrap;">' +
        '<button class="btn btn-quiet btn-sm" id="btn-export">Export company file (.json)</button>' +
        '<button class="btn btn-quiet btn-sm" id="btn-print">Print / save as PDF</button>' +
        "</div>";
      var exportBtn = document.getElementById("btn-export");
      if (exportBtn) exportBtn.onclick = exportFile;
      var printBtn = document.getElementById("btn-print");
      if (printBtn) printBtn.onclick = function () { window.print(); };
    }

    // Screen B: NAP lock generator
    var napForm = document.getElementById("screen-b");
    if (napForm) {
      renderNapScreen(napForm);
    }

    // Screen C: OA preview
    var oaScreen = document.getElementById("screen-c");
    if (oaScreen) {
      renderOaScreen(oaScreen);
    }

    // Screen D: the wall — vendor packets / checklist / guarantee
    var wallTargets = document.querySelectorAll("[data-gate='sprint']");
    wallTargets.forEach(function (el) {
      renderGate(el, "sprint");
    });
    var preflightGate = document.querySelectorAll("[data-gate='preflight']");
    preflightGate.forEach(function (el) {
      renderGate(el, "preflight");
    });

    // Clock start control
    var clockBtn = document.getElementById("btn-start-clock");
    if (clockBtn) {
      clockBtn.disabled = state.tier !== "sprint" || !state.bank_started;
      clockBtn.textContent = state.clock_started_at
        ? "Clock running — " + daysRemaining() + " days left"
        : "Start the 30-day clock";
      clockBtn.onclick = function () {
        if (clockBtn.disabled) return;
        set({ clock_started_at: new Date().toISOString() });
        toast("Clock started. Day 30 is " + new Date(Date.now() + 30 * 86400000).toDateString() + ".");
      };
    }

    var einBtn = document.getElementById("btn-ein-started");
    if (einBtn) {
      einBtn.onclick = function () {
        set({ ein_started: true });
        toast("Marked EIN as started. Go finish it on IRS.gov.");
      };
    }
    var bankBtn = document.getElementById("btn-bank-started");
    if (bankBtn) {
      bankBtn.onclick = function () {
        set({ bank_started: true });
        toast("Marked business banking as started.");
      };
    }
  }

  function renderNapScreen(container) {
    var locked = state.nap_locked;
    if (locked) {
      container.innerHTML =
        '<h3>NAP lock <span class="tag tag-open" style="margin-left:8px;">Locked</span></h3>' +
        '<p>Use this exact string on every filing — Secretary of State, EIN, bank, vendor applications. Do not retype it from memory anywhere.</p>' +
        '<div class="nap-block">' + esc(state.nap_name) + "\n" + esc(state.nap_address) + "\n" + esc(state.nap_phone) + "</div>" +
        '<button class="btn btn-quiet btn-sm" id="btn-nap-edit">Edit NAP block</button>';
      var editBtn = document.getElementById("btn-nap-edit");
      if (editBtn) editBtn.onclick = function () { set({ nap_locked: false }); };
      return;
    }

    container.innerHTML =
      '<h3>Lock your NAP pattern</h3>' +
      '<p>Name, address, phone — copied once, used identically everywhere. This is the single biggest cause of "new company" denials.</p>' +
      '<div class="field"><label>Legal name (exact, from the formation document)</label><input id="nap-name" placeholder="Hearth &amp; Kiln Supply LLC" /></div>' +
      '<div class="field"><label>Business address (one you can receive a package at)</label><input id="nap-address" placeholder="123 Main St, Suite 4, Houston, TX 77002" /></div>' +
      '<div class="field"><label>Business phone (one number, used everywhere)</label><input id="nap-phone" placeholder="(713) 555-0148" /></div>' +
      '<button class="btn btn-primary btn-sm" id="btn-nap-lock">Lock this NAP block</button>';

    document.getElementById("nap-name").value = state.nap_name;
    document.getElementById("nap-address").value = state.nap_address;
    document.getElementById("nap-phone").value = state.nap_phone;

    document.getElementById("btn-nap-lock").onclick = function () {
      var name = document.getElementById("nap-name").value.trim();
      var address = document.getElementById("nap-address").value.trim();
      var phone = document.getElementById("nap-phone").value.trim();
      if (!name || !address || !phone) {
        toast("Fill in all three fields — that's the whole point of a lock.");
        return;
      }
      set({ nap_locked: true, nap_name: name, nap_address: address, nap_phone: phone });
      toast("NAP locked. Use this string everywhere.");
    };
  }

  function renderOaScreen(container) {
    var name = fmtName(state.llc) || "[Company Name] LLC";
    if (state.tier !== "preview") {
      container.innerHTML =
        '<h3>Operating agreement <span class="tag tag-open" style="margin-left:8px;">Full</span></h3>' +
        '<p>Full agreement unlocked. Export the company file to get the complete document.</p>' +
        '<div class="watermark-doc" style="opacity:.9;"><strong>' + esc(name) + '</strong> — Operating Agreement<br><br>Full 12-section agreement included in your export, covering membership, capital contributions, distributions, management, dissolution, and amendment procedure.</div>';
      return;
    }
    container.innerHTML =
      '<h3>Operating agreement — preview</h3>' +
      '<div class="watermark-doc"><strong>' + esc(name) + '</strong> — Operating Agreement<br><br>' +
      "Article I — Formation<br>" +
      "The undersigned member(s) hereby form a limited liability company under the laws of the state of formation named above...<br><br>" +
      "Signature Block<br>______________________________<br>" + esc(fmtName(state.signer) || "Member Signature") + "</div>" +
      '<p class="field-hint">This is the first page and signature block only. The full 12-section agreement unlocks with the Pre-flight Kit or Sprint Pass.</p>' +
      '<button class="btn btn-primary btn-sm" id="btn-unlock-oa">Unlock full agreement — $29</button>';
    var btn = document.getElementById("btn-unlock-oa");
    if (btn) btn.onclick = function () { goCheckout("preflight"); };
  }

  function renderGate(el, requiredTier) {
    var rank = { preview: 0, preflight: 1, sprint: 2 };
    var have = rank[state.tier] || 0;
    var need = rank[requiredTier];
    if (have >= need) {
      el.classList.remove("wall-hidden");
      return;
    }
    // leave content, but overlay a wall message once
    if (el.dataset.gated === "1") return;
    el.dataset.gated = "1";
    var original = el.innerHTML;
    el.dataset.original = original;
    el.innerHTML =
      '<div class="wall">' +
      "<h3>" + (requiredTier === "sprint" ? "The Sprint Pass is the rest of the desk." : "This lives in the Pre-flight Kit.") + "</h3>" +
      "<p>Preview showed you the file. " +
      (requiredTier === "sprint"
        ? "The Pass gives you the packets the vendors actually see, the days they're due, and the refund if the LLC still has no net-30 line after you run the steps on time."
        : "The Pre-flight Kit gives you the full operating agreement, the locked NAP block, and the EIN and bank walkthroughs.") +
      "</p>" +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" data-checkout="' + requiredTier + '">' +
      (requiredTier === "sprint" ? "Unlock Sprint Pass — $149" : "Unlock Pre-flight — $29") +
      "</button>" +
      (requiredTier === "sprint" ? '<button class="btn btn-ghost" data-checkout="preflight">Documents only — $29</button>' : "") +
      "</div></div>";

    el.querySelectorAll("[data-checkout]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goCheckout(btn.getAttribute("data-checkout"));
      });
    });
  }

  function goCheckout(tier) {
    // Placeholder: wire this to real Stripe Payment Links / Checkout Sessions.
    // See README.md → "Stripe setup" for product IDs referenced here.
    var links = {
      preflight: (window.IGNITION_CONFIG && window.IGNITION_CONFIG.stripePreflightLink) || "#",
      sprint: (window.IGNITION_CONFIG && window.IGNITION_CONFIG.stripeSprintLink) || "#"
    };
    var url = links[tier];
    if (url && url !== "#") {
      window.location.href = url;
      return;
    }
    // Dev fallback so the flow is demoable before Stripe keys exist.
    if (window.confirm("Stripe isn't wired up yet. Simulate a successful " + tier + " purchase for local testing?")) {
      set({ tier: tier });
      toast(tier === "sprint" ? "Sprint Pass unlocked (simulated)." : "Pre-flight Kit unlocked (simulated).");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  window.deskCheckout = goCheckout;

  function exportFile() {
    var data = JSON.stringify(state, null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = (fmtName(state.llc) || "ignition-company-file").replace(/[^a-z0-9\-]+/gi, "_") + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Exported. Store this file somewhere that isn't a browser tab.");
  }

  document.addEventListener("DOMContentLoaded", render);
})();
