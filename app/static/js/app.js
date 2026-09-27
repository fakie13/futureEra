/* =========================================================
   Future Era — Animation Engine & Application Controller
   ========================================================= */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Removes missing elements so GSAP never gets a null target */
function pick(list) {
  return list.flat().filter(Boolean);
}

/* Builds one .title-line per line of text, each word wrapped in a mask. */
function splitWords(el) {
  const lines = el.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  el.textContent = "";
  el.setAttribute("aria-label", lines.join(" ").replace(/\s+/g, " "));

  const lineInners = [];

  lines.forEach((lineText) => {
    const lineEl = document.createElement("span");
    lineEl.className = "title-line";

    const words = lineText.split(/\s+/);
    const lineWords = [];

    words.forEach((word, i) => {
      const mask = document.createElement("span");
      mask.className = "line-mask";
      const inner = document.createElement("span");
      inner.textContent = word;
      mask.appendChild(inner);
      lineEl.appendChild(mask);
      if (i < words.length - 1) lineEl.appendChild(document.createTextNode(" "));
      lineWords.push(inner);
    });

    lineInners.push(lineWords);
    el.appendChild(lineEl);
  });

  return lineInners;
}

function initIntro() {
  const titleEls = gsap.utils.toArray(".intro__title, .intro__title1");
  const subEl = document.querySelector(".intro__subtitle");
  if (!titleEls.length || !subEl) return;

  const titleGroups = titleEls.map((el) => splitWords(el).flat());
  const subLines = splitWords(subEl);
  const titleWords = titleGroups.flat();
  const subWords = subLines.flat();

  const els = {
    eyebrow: document.querySelector(".intro__eyebrow"),
    rule: document.querySelector(".intro__rule span"),
    glow: document.querySelector(".intro__glow"),
    actions: document.querySelector(".intro__actions"),
    cue: document.querySelector(".scroll-cue"),
    cueLine: document.querySelector(".scroll-cue__line i"),
  };

  if (reduceMotion) {
    gsap.set(
      pick([els.eyebrow, els.actions, els.cue, titleWords, subWords]),
      { opacity: 1, y: 0, x: 0 }
    );
    gsap.set(pick([els.rule, els.cueLine]), { scaleX: 1, scaleY: 1 });
    return;
  }

  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

  tl.set(pick([els.eyebrow, els.actions, els.cue]), { opacity: 0 })
    .set(pick([titleWords]), { xPercent: -120, opacity: 0 })
    .set(pick([subWords]), { yPercent: 130, opacity: 0 })
    .set(pick([els.glow]), { opacity: 0, scale: 0.7 })

    /* soft glow blooms in first */
    .to(pick([els.glow]), { opacity: 1, scale: 1, duration: 2.2, ease: "power2.out" }, 0)

    /* eyebrow + rule */
    .to(pick([els.eyebrow]), { opacity: 1, duration: 1, y: 0 }, 0.15)
    .to(pick([els.rule]), { scaleX: 1, duration: 1.6, ease: "power3.inOut" }, 0.25);

  /* heading lines slide in with stagger */
  titleGroups.forEach((group, i) => {
    tl.fromTo(
      pick([group]),
      { xPercent: -120, opacity: 0 },
      {
        xPercent: 0,
        opacity: 1,
        duration: 1.4,
        stagger: 0.09,
      },
      i === 0 ? 0.4 : "-=0.85"
    );
  });

  tl
    .to(
      pick([subWords]),
      { yPercent: 0, opacity: 1, duration: 1.3, stagger: 0.07 },
      "-=0.9"
    )
    .to(
      pick([titleEls]),
      { textShadow: "0 0 60px rgba(200,255,61,0.35)", duration: 1.4 },
      "-=0.6"
    )
    .to(pick([els.actions, els.cue]), { opacity: 1, y: 0, duration: 1 }, "-=0.5")
    .to(pick([els.cueLine]), { scaleY: 1, duration: 0.8, ease: "power2.inOut" }, "<0.2")
    .to(pick([els.cueLine]), {
      scaleY: 0,
      transformOrigin: "bottom",
      duration: 0.9,
      ease: "power2.in",
      repeat: -1,
      repeatDelay: 0.35,
    });

  /* Parallax on intro */
  gsap.to(".intro__inner", {
    yPercent: -18,
    opacity: 0.15,
    ease: "none",
    scrollTrigger: {
      trigger: ".intro",
      start: "top top",
      end: "bottom top",
      scrub: 0.6,
    },
  });
}

function initAbout() {
  if (reduceMotion) return;

  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      y: 50,
      opacity: 0,
      duration: 1.1,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });

  gsap.utils.toArray(".card").forEach((card) => {
    const h3 = card.querySelector("h3");
    gsap.from(card.querySelector("p"), {
      y: 20,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      delay: 0.15,
      scrollTrigger: { trigger: card, start: "top 85%" },
    });
    card.addEventListener("mouseenter", () =>
      gsap.to(h3, { letterSpacing: "0.3em", duration: 0.5, ease: "expo.out" })
    );
    card.addEventListener("mouseleave", () =>
      gsap.to(h3, { letterSpacing: "0.2em", duration: 0.5, ease: "expo.out" })
    );
  });
}

/* =========================================================
   APPLICATION & API CONTROLLER
   ========================================================= */

let currentStudentType = "12th_pass";
let clientApiKey = sessionStorage.getItem("gemini_api_key") || "";

function initAppController() {
  checkServerApiStatus();

  // Tab Switching
  const tab12th = document.getElementById("tab12th");
  const tabFinal = document.getElementById("tabFinal");
  const fields12th = document.getElementById("fields12th");
  const fieldsFinal = document.getElementById("fieldsFinal");
  const submitBtnText = document.getElementById("submitBtnText");

  tab12th.addEventListener("click", () => {
    currentStudentType = "12th_pass";
    tab12th.classList.add("active");
    tabFinal.classList.remove("active");
    fields12th.style.display = "block";
    fieldsFinal.style.display = "none";
    submitBtnText.textContent = "Generate Future Era Blueprint";
  });

  tabFinal.addEventListener("click", () => {
    currentStudentType = "final_year";
    tabFinal.classList.add("active");
    tab12th.classList.remove("active");
    fieldsFinal.style.display = "block";
    fields12th.style.display = "none";
    submitBtnText.textContent = "Audit Tech Stack & Generate Sprint";
  });

  // Stream Selection
  const streamBtns = document.querySelectorAll(".stream-btn");
  streamBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      streamBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("selectedStream").value = btn.dataset.stream;
    });
  });

  // Interest Chips
  const chips = document.querySelectorAll(".chip");
  const interestsTextarea = document.getElementById("interests");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const text = chip.dataset.text;
      let currentVal = interestsTextarea.value.trim();
      if (!currentVal.includes(text)) {
        interestsTextarea.value = currentVal ? `${currentVal}, ${text}` : text;
        chip.classList.add("active");
      }
    });
  });

  // Duration Selection
  const durationOptions = document.querySelectorAll(".duration-option");
  durationOptions.forEach((opt) => {
    opt.addEventListener("click", () => {
      durationOptions.forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      document.getElementById("selectedDuration").value = opt.dataset.years;
    });
  });

  // API Key Modal
  const apiKeyBtn = document.getElementById("apiKeyBtn");
  const apiKeyModal = document.getElementById("apiKeyModal");
  const closeApiKeyModal = document.getElementById("closeApiKeyModal");
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  const modalApiKeyInput = document.getElementById("modalApiKeyInput");

  apiKeyBtn.addEventListener("click", () => {
    modalApiKeyInput.value = clientApiKey;
    apiKeyModal.classList.add("active");
  });

  closeApiKeyModal.addEventListener("click", () => {
    apiKeyModal.classList.remove("active");
  });

  saveApiKeyBtn.addEventListener("click", () => {
    const key = modalApiKeyInput.value.trim();
    if (key) {
      clientApiKey = key;
      sessionStorage.setItem("gemini_api_key", key);
      document.getElementById("apiKeyDot").style.background = "#c8ff3d";
      document.getElementById("apiKeyStatusText").textContent = "Key Active";
    }
    apiKeyModal.classList.remove("active");
  });

  // Print Action
  document.getElementById("printBtn").addEventListener("click", () => {
    window.print();
  });

  // Form Submission
  document.getElementById("careerForm").addEventListener("submit", handleCareerSubmit);
}

async function checkServerApiStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    const dot = document.getElementById("apiKeyDot");
    const text = document.getElementById("apiKeyStatusText");
    if (data.has_server_api_key || clientApiKey) {
      dot.style.background = "#c8ff3d";
      text.textContent = data.has_server_api_key ? "Ready (.env)" : "Key Active";
    } else {
      dot.style.background = "#f59e0b";
      text.textContent = "Set API Key";
    }
  } catch (e) {
    console.warn("Status check unavailable", e);
  }
}

const loadingPrompts = [
  "Evaluating task automation boundaries & human domain resilience...",
  "Querying current industry production standards for 2026...",
  "Filtering legacy academic topics & redundant coursework...",
  "Formulating applied production projects...",
  "Synthesizing customized milestone timeline..."
];

let tipTimer = null;
function startLoadingTips() {
  const tipEl = document.getElementById("loadingTip");
  let idx = 0;
  tipEl.textContent = loadingPrompts[0];
  tipTimer = setInterval(() => {
    idx = (idx + 1) % loadingPrompts.length;
    tipEl.textContent = loadingPrompts[idx];
  }, 2200);
}

function stopLoadingTips() {
  if (tipTimer) clearInterval(tipTimer);
}

async function handleCareerSubmit(e) {
  e.preventDefault();

  const loadingView = document.getElementById("loadingView");
  const errorView = document.getElementById("errorView");
  const resultsDashboard = document.getElementById("resultsDashboard");
  const submitBtn = document.getElementById("submitBtn");

  errorView.style.display = "none";
  resultsDashboard.classList.remove("active");
  loadingView.classList.add("active");
  submitBtn.disabled = true;
  startLoadingTips();

  let payload = {
    student_type: currentStudentType,
    api_key: clientApiKey || undefined
  };

  if (currentStudentType === "12th_pass") {
    payload.stream = document.getElementById("selectedStream").value;
    payload.interests = document.getElementById("interests").value.trim() || "Technology and Systems";
    payload.degree_years = parseInt(document.getElementById("selectedDuration").value) || 4;
  } else {
    payload.degree_major = document.getElementById("degreeMajor").value.trim() || "Computer Science / Engineering";
    payload.current_skills = document.getElementById("currentSkills").value.trim() || "Foundational concepts";
    payload.target_role = document.getElementById("targetRole").value.trim() || "Software Systems Engineer";
  }

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Blueprint generation failed.");
    }

    renderFutureResults(data);
  } catch (err) {
    document.getElementById("errorMessage").textContent = err.message || "An unexpected error occurred.";
    errorView.style.display = "block";
  } finally {
    stopLoadingTips();
    loadingView.classList.remove("active");
    submitBtn.disabled = false;
  }
}

function renderFutureResults(data) {
  // 1. Trajectory Summary
  document.getElementById("resTrajectoryTitle").textContent = data.recommended_roles[0] || "Custom Architecture";
  document.getElementById("resProfileSummary").textContent = data.profile_summary;

  const rolesContainer = document.getElementById("resRolesContainer");
  rolesContainer.innerHTML = "";
  (data.recommended_roles || []).forEach((role) => {
    const badge = document.createElement("span");
    badge.className = "pill-item pill-item--hot";
    badge.textContent = role;
    rolesContainer.appendChild(badge);
  });

  // 2. AI Shield
  const threatBadge = document.getElementById("resThreatBadge");
  const threatLevel = (data.ai_analysis?.threat_level || "Moderate").toLowerCase();

  if (threatLevel.includes("low")) {
    threatBadge.className = "threat-tag threat-low";
    threatBadge.textContent = "Automation Exposure: Low (Resilient)";
  } else if (threatLevel.includes("high")) {
    threatBadge.className = "threat-tag threat-high";
    threatBadge.textContent = "Automation Exposure: High (Must Evolve)";
  } else {
    threatBadge.className = "threat-tag threat-moderate";
    threatBadge.textContent = "Automation Exposure: Moderate";
  }

  const aiFailsList = document.getElementById("resAiFailsList");
  aiFailsList.innerHTML = "";
  (data.ai_analysis?.why_ai_wont_replace_this || []).forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="bullet">✦</span> <span>${item}</span>`;
    aiFailsList.appendChild(li);
  });

  const aiToolsList = document.getElementById("resAiToolsList");
  aiToolsList.innerHTML = "";
  (data.ai_analysis?.ai_tools_to_master || []).forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="bullet">⚡</span> <span>${item}</span>`;
    aiToolsList.appendChild(li);
  });

  // 3. Tech Radar
  const inDemandContainer = document.getElementById("resInDemandPills");
  inDemandContainer.innerHTML = "";
  (data.market_tech_radar?.in_demand_technologies || []).forEach((tech) => {
    const pill = document.createElement("span");
    pill.className = "pill-item pill-item--hot";
    pill.textContent = tech;
    inDemandContainer.appendChild(pill);
  });

  const outdatedContainer = document.getElementById("resOutdatedPills");
  outdatedContainer.innerHTML = "";
  (data.market_tech_radar?.outdated_or_deprioritized || []).forEach((tech) => {
    const pill = document.createElement("span");
    pill.className = "pill-item pill-item--old";
    pill.textContent = tech;
    outdatedContainer.appendChild(pill);
  });

  // 4. Timeline
  document.getElementById("resTimelineHeading").textContent =
    currentStudentType === "12th_pass" ? "Multi-Year Architecture Roadmap" : "90-Day Execution Sprint";

  const timelineContainer = document.getElementById("resTimelineContainer");
  timelineContainer.innerHTML = "";

  (data.timeline_roadmap || []).forEach((item) => {
    const card = document.createElement("div");
    card.className = "timeline-card";

    card.innerHTML = `
      <div class="timeline-card__top">
        <span class="timeline-card__period">${item.period}</span>
        <span class="timeline-card__theme">${item.focus_theme}</span>
      </div>

      <div class="timeline-card__skills">
        ${(item.skills_to_acquire || []).map((s) => `<span class="timeline-card__skill">${s}</span>`).join("")}
      </div>

      <div class="timeline-card__project">
        <div class="timeline-card__project-label">Applied Capstone Project:</div>
        <div>${item.action_project}</div>
      </div>

      <div class="timeline-card__resources">
        <span style="color: rgba(245,245,245,0.4); margin-right: 6px;">Primary References:</span>
        ${(item.free_learning_resources || []).map((r) => `<span style="color: #c8ff3d; margin-right: 8px;">${r}</span>`).join("")}
      </div>
    `;

    timelineContainer.appendChild(card);
  });

  const dashboard = document.getElementById("resultsDashboard");
  dashboard.classList.add("active");

  // Animate results with GSAP
  if (!reduceMotion) {
    gsap.from(dashboard.querySelectorAll(".res-panel"), {
      y: 40,
      opacity: 0,
      duration: 0.9,
      stagger: 0.15,
      ease: "power3.out"
    });
  }

  dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Initializer
function init() {
  gsap.registerPlugin(ScrollTrigger);
  initIntro();
  initAbout();
  initAppController();
}

if (document.readyState === "complete") {
  init();
} else {
  window.addEventListener("load", init);
}
