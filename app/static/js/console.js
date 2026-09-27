/* =========================================================
   Future Era — Career Architecture Console Logic
   ========================================================= */

let currentStudentType = "12th_pass";
let clientApiKey = sessionStorage.getItem("gemini_api_key") || "";
let selectedSkills = [];
let currentSuggestionsData = null;
let currentOriginalPayload = null;

const VALID_SHORT_TOKENS_JS = new Set([
  "c", "r", "go", "ai", "ml", "ui", "ux", "db", "os", "ip", "qa", "it", 
  "c#", "c++", "js", "ts", "php", "sql", "git", "aws", "gcp", "dsa", "oop",
  "bca", "mca", "bba", "mba", "cse", "ece", "eee", "sre", "nlp", "css",
  "b.sc", "m.sc", "b.tech", "m.tech", "b.com", "m.com", "b.des"
]);

const KNOWN_GIBBERISH_WORDS_JS = new Set([
  "fd", "asd", "asdf", "asdfg", "asdfgh", "asdfghjkl", "qwer", "qwerty", 
  "zxcv", "zxcvb", "hjkl", "test", "testing", "fake", "dummy", "none", 
  "nothing", "na", "n/a", "random", "xyz", "abc", "bla", "blah", "foo", 
  "bar", "gibberish", "123", "1234", "12345", "xxx", "xxxx", "asdfghjk"
]);

function isGibberishOrFake(text) {
  if (!text) return true;
  const clean = text.trim().toLowerCase();
  if (!clean) return true;

  if (KNOWN_GIBBERISH_WORDS_JS.has(clean)) return true;

  const tokens = clean.split(/\s+/).map(t => t.replace(/^[,\.\s]+|[,\.\s]+$/g, "")).filter(Boolean);
  if (tokens.length === 1) {
    const tok = tokens[0];
    if (KNOWN_GIBBERISH_WORDS_JS.has(tok)) return true;
    if (tok.length < 2 && !VALID_SHORT_TOKENS_JS.has(tok)) return true;
    if (tok.length === 2 && !VALID_SHORT_TOKENS_JS.has(tok)) {
      if (!/[aeiou]/.test(tok)) return true;
    }
  }

  const lettersOnly = clean.replace(/[^a-z0-9]/g, "");
  if (lettersOnly.length >= 3 && new Set(lettersOnly.split("")).size <= 1) {
    return true;
  }

  const walks = ["asdf", "qwer", "zxcv", "hjkl", "1234", "qwerty", "lkjh"];
  for (const walk of walks) {
    if (clean.includes(walk)) return true;
  }

  for (const tok of tokens) {
    const pureAlpha = tok.replace(/[^a-z]/g, "");
    if (pureAlpha.length >= 4 && !/[aeiouy]/.test(pureAlpha)) {
      const upper = pureAlpha.toUpperCase();
      if (!["DBMS", "RDBMS", "HTML", "HTTP", "CSS", "JSON", "REST", "GRPC", "SMTP"].includes(upper)) {
        return true;
      }
    }
  }

  return false;
}

function showValidationError(inputEl, message, title = "Blueprint Doesn't Exist") {
  const errorView = document.getElementById("errorView");
  const errorMsg = document.getElementById("errorMessage");
  const errorTitle = document.getElementById("errorTitle");
  const loadingView = document.getElementById("loadingView");
  const resultsDashboard = document.getElementById("resultsDashboard");
  const submitBtn = document.getElementById("submitBtn");

  if (loadingView) loadingView.classList.remove("active");
  if (resultsDashboard) resultsDashboard.classList.remove("active");
  if (submitBtn) submitBtn.disabled = false;
  stopLoadingTips();

  // Clear previous input errors
  document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));

  if (errorTitle) errorTitle.textContent = title;
  if (errorMsg) errorMsg.textContent = message;
  if (errorView) {
    errorView.style.display = "flex";
    errorView.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (inputEl) {
    inputEl.classList.add("input-error");
    inputEl.focus();

    const clearError = () => {
      inputEl.classList.remove("input-error");
      if (errorView) errorView.style.display = "none";
      inputEl.removeEventListener("input", clearError);
    };
    inputEl.addEventListener("input", clearError);
  }
}

function clearGeneratedResults() {
  const resultsDashboard = document.getElementById("resultsDashboard");
  if (resultsDashboard) {
    resultsDashboard.classList.remove("active");
    resultsDashboard.style.display = "none";
  }
  const professionView = document.getElementById("professionSelectionView");
  if (professionView) {
    professionView.style.display = "none";
  }
  const activeBanner = document.getElementById("activeProfessionBanner");
  if (activeBanner) {
    activeBanner.style.display = "none";
  }
  const sourceBadge = document.getElementById("resSourceBadge");
  if (sourceBadge) {
    sourceBadge.style.display = "none";
  }
  const fieldPanel = document.getElementById("panelFieldIntelligence");
  if (fieldPanel) {
    fieldPanel.style.display = "none";
  }
  const errorView = document.getElementById("errorView");
  if (errorView) {
    errorView.style.display = "none";
  }
  const loadingView = document.getElementById("loadingView");
  if (loadingView) {
    loadingView.classList.remove("active");
  }
  if (typeof stopLoadingTips === "function") {
    stopLoadingTips();
  }
  const titleEl = document.querySelector(".profession-selection-title");
  if (titleEl) {
    titleEl.textContent = "Pick Your Target Profession";
  }
  const cardsGrid = document.getElementById("professionCardsGrid");
  if (cardsGrid) {
    cardsGrid.classList.remove("single-card-view");
  }
  document.querySelectorAll(".profession-card").forEach((c) => {
    c.style.display = "flex";
    c.classList.remove("selected");
    const actionRow = c.querySelector(".profession-card__action-row");
    if (actionRow) {
      actionRow.innerHTML = `
        <button type="button" class="profession-card__btn">
          <span>Select &amp; Generate Blueprint</span>
          <span>&rarr;</span>
        </button>
      `;
    }
  });
  document.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));
  document.querySelectorAll(".combobox-wrapper").forEach((w) => w.classList.remove("open"));
}

function clear12thPassFields() {
  const interestsEl = document.getElementById("interests");
  if (interestsEl) {
    interestsEl.value = "";
  }

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.remove("active");
  });

  const streamBtns = document.querySelectorAll(".stream-btn");
  streamBtns.forEach((btn, idx) => {
    btn.classList.toggle("active", idx === 0);
  });
  const streamInput = document.getElementById("selectedStream");
  if (streamInput && streamBtns.length > 0) {
    streamInput.value = streamBtns[0].dataset.stream || "PCM (Physics, Chemistry, Maths)";
  }

  const durationOptions = document.querySelectorAll(".duration-option");
  durationOptions.forEach((opt) => {
    opt.classList.toggle("active", opt.dataset.years === "4");
  });
  const durationInput = document.getElementById("selectedDuration");
  if (durationInput) {
    durationInput.value = "4";
  }

  document.querySelectorAll("#fields12th .input-error").forEach((el) => el.classList.remove("input-error"));
}

function clearFinalYearFields() {
  const degreeEl = document.getElementById("degreeMajor");
  if (degreeEl) {
    degreeEl.value = "";
  }

  const roleEl = document.getElementById("targetRole");
  if (roleEl) {
    roleEl.value = "";
  }

  const searchInput = document.getElementById("skillSearchInput");
  if (searchInput) {
    searchInput.value = "";
  }

  const hiddenSkills = document.getElementById("currentSkills");
  if (hiddenSkills) {
    hiddenSkills.value = "";
  }

  selectedSkills = [];

  const container = document.getElementById("selectedSkillsContainer");
  if (container) {
    container.innerHTML = "";
  }

  document.querySelectorAll(".quick-skill-pill").forEach((pill) => {
    pill.classList.remove("selected");
  });

  document.querySelectorAll(".combobox-wrapper").forEach((w) => {
    w.classList.remove("open");
  });

  document.querySelectorAll("#fieldsFinal .input-error").forEach((el) => el.classList.remove("input-error"));
}

document.addEventListener("DOMContentLoaded", () => {
  checkServerApiStatus();
  setupConsoleEvents();
});

function setupConsoleEvents() {
  // Tab Switching & Stage Parameter
  const tab12th = document.getElementById("tab12th");
  const tabFinal = document.getElementById("tabFinal");
  const fields12th = document.getElementById("fields12th");
  const fieldsFinal = document.getElementById("fieldsFinal");
  const submitBtnText = document.getElementById("submitBtnText");
  const activeStagePill = document.getElementById("activeStagePill");
  const activeStageText = document.getElementById("activeStageText");
  const consoleHeroTitle = document.getElementById("consoleHeroTitle");

  function setStage(stage, isInitial = false) {
    if (stage === "final_year" || stage === "final" || stage === "college") {
      if (!isInitial && currentStudentType !== "final_year") {
        clearGeneratedResults();
        clear12thPassFields();
        clearFinalYearFields();
      }
      currentStudentType = "final_year";
      if (tabFinal) tabFinal.classList.add("active");
      if (tab12th) tab12th.classList.remove("active");
      if (fieldsFinal) fieldsFinal.style.display = "block";
      if (fields12th) fields12th.style.display = "none";
      if (submitBtnText) submitBtnText.textContent = "Generate Blueprint";
      if (activeStagePill) {
        activeStagePill.innerHTML = "🚀 Final-Year College Student";
        activeStagePill.style.color = "var(--accent-amber)";
        activeStagePill.style.borderColor = "#fde68a";
      }
      if (activeStageText) activeStageText.textContent = "Placement & industry acceleration mode enabled";
      if (consoleHeroTitle) {
        consoleHeroTitle.innerHTML = 'Chart Your Placement Blueprint for<br /><span class="hero-title__teal">Final-Year</span> <span class="hero-title__amber">Students</span>';
      }
      document.title = "Final-Year Career Architecture — FutureEra";
    } else {
      if (!isInitial && currentStudentType !== "12th_pass") {
        clearGeneratedResults();
        clear12thPassFields();
        clearFinalYearFields();
      }
      currentStudentType = "12th_pass";
      if (tab12th) tab12th.classList.add("active");
      if (tabFinal) tabFinal.classList.remove("active");
      if (fields12th) fields12th.style.display = "block";
      if (fieldsFinal) fieldsFinal.style.display = "none";
      if (submitBtnText) submitBtnText.textContent = "Generate Blueprint";
      if (activeStagePill) {
        activeStagePill.innerHTML = "🎓 Class 12 Graduate";
        activeStagePill.style.color = "var(--primary-teal)";
        activeStagePill.style.borderColor = "var(--border-light)";
      }
      if (activeStageText) activeStageText.textContent = "Pre-college discovery mode enabled";
      if (consoleHeroTitle) {
        consoleHeroTitle.innerHTML = 'Chart Your Career Path After<br /><span class="hero-title__teal">Class 12th</span> <span class="hero-title__amber">Graduation</span>';
      }
      document.title = "Class 12 Career Discovery — FutureEra";
    }
  }

  // Parse URL query parameter (e.g. ?stage=12th or ?stage=final)
  const urlParams = new URLSearchParams(window.location.search);
  const initialStage = urlParams.get("stage") || urlParams.get("mode");
  if (initialStage) {
    setStage(initialStage, true);
  }

  if (tab12th) tab12th.addEventListener("click", () => setStage("12th_pass"));
  if (tabFinal) tabFinal.addEventListener("click", () => setStage("final_year"));

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
        if (interestsTextarea) interestsTextarea.classList.remove("input-error");
        const errorView = document.getElementById("errorView");
        if (errorView) errorView.style.display = "none";
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

  // API Key Modal (if present)
  const apiKeyBtn = document.getElementById("apiKeyBtn");
  const apiKeyModal = document.getElementById("apiKeyModal");
  const closeApiKeyModal = document.getElementById("closeApiKeyModal");
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  const modalApiKeyInput = document.getElementById("modalApiKeyInput");

  if (apiKeyBtn && apiKeyModal) {
    apiKeyBtn.addEventListener("click", () => {
      modalApiKeyInput.value = clientApiKey;
      apiKeyModal.classList.add("active");
    });

    closeApiKeyModal?.addEventListener("click", () => {
      apiKeyModal.classList.remove("active");
    });

    saveApiKeyBtn?.addEventListener("click", () => {
      const key = modalApiKeyInput.value.trim();
      if (key) {
        clientApiKey = key;
        sessionStorage.setItem("gemini_api_key", key);
        const dot = document.getElementById("apiKeyDot");
        const text = document.getElementById("apiKeyStatusText");
        if (dot) dot.style.background = "#c8ff3d";
        if (text) text.textContent = "Key Active";
      }
      apiKeyModal.classList.remove("active");
    });
  }

  // Print Action
  document.getElementById("printBtn")?.addEventListener("click", () => {
    window.print();
  });

  // Form Submission
  document.getElementById("careerForm")?.addEventListener("submit", handleCareerSubmit);

  // Initialize Searchable Dropdowns & Skill Tags
  initComboboxesAndSkills();
}

async function checkServerApiStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    const dot = document.getElementById("apiKeyDot");
    const text = document.getElementById("apiKeyStatusText");
    if (dot && text) {
      if (data.has_server_api_key || clientApiKey) {
        dot.style.background = "#c8ff3d";
        text.textContent = data.has_server_api_key ? "Ready (.env)" : "Key Active";
      } else {
        dot.style.background = "#f59e0b";
        text.textContent = "Set API Key";
      }
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

  // Reset any prior error states
  if (errorView) errorView.style.display = "none";
  document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));

  let payload = {
    student_type: currentStudentType,
    api_key: clientApiKey || undefined
  };

  if (currentStudentType === "12th_pass") {
    const interestsEl = document.getElementById("interests");
    const interestsVal = interestsEl ? interestsEl.value.trim() : "";
    
    if (!interestsVal) {
      showValidationError(
        interestsEl, 
        "Please choose an interest from the suggested topics above or describe your favorite subjects.", 
        "Please Choose an Interest"
      );
      return;
    }
    if (isGibberishOrFake(interestsVal)) {
      showValidationError(
        interestsEl, 
        `"${interestsVal}" does not look like valid subjects or interests. Please choose from the suggested topics above or enter your genuine interests.`, 
        "Please Choose a Valid Interest"
      );
      return;
    }

    payload.stream = document.getElementById("selectedStream").value;
    payload.interests = interestsVal;
    payload.degree_years = parseInt(document.getElementById("selectedDuration").value) || 4;

  } else {
    // 1. Validate Degree & Major
    const degreeEl = document.getElementById("degreeMajor");
    const degreeVal = degreeEl ? degreeEl.value.trim() : "";

    if (!degreeVal) {
      showValidationError(degreeEl, "Blueprint doesn't exist. Please check the entered data: Current degree and major cannot be blank.");
      return;
    }
    if (isGibberishOrFake(degreeVal)) {
      showValidationError(degreeEl, `Blueprint doesn't exist. Please check the entered data: "${degreeVal}" is not a recognized degree or major.`);
      return;
    }

    // 2. Validate Skills
    const skillSearchEl = document.getElementById("skillSearchInput");
    const remainingSkillInput = skillSearchEl ? skillSearchEl.value.trim() : "";
    let combinedSkills = [...selectedSkills];
    if (remainingSkillInput) {
      const parts = remainingSkillInput.split(",").map(p => p.trim()).filter(Boolean);
      parts.forEach(p => {
        if (!combinedSkills.some(s => s.toLowerCase() === p.toLowerCase())) {
          combinedSkills.push(p);
        }
      });
    }

    if (combinedSkills.length === 0) {
      showValidationError(skillSearchEl, "Blueprint doesn't exist. Please check the entered data: Please select or type at least one recognized skill or technology.");
      return;
    }

    const validSkills = combinedSkills.filter(s => !isGibberishOrFake(s));
    if (validSkills.length === 0) {
      showValidationError(skillSearchEl, `Blueprint doesn't exist. Please check the entered data: "${combinedSkills.join(', ')}" does not contain recognized skills or technologies.`);
      return;
    }

    // 3. Validate Target Role
    const roleEl = document.getElementById("targetRole");
    const roleVal = roleEl ? roleEl.value.trim() : "";

    if (!roleVal) {
      showValidationError(roleEl, "Blueprint doesn't exist. Please check the entered data: Target career role cannot be blank.");
      return;
    }
    if (isGibberishOrFake(roleVal)) {
      showValidationError(roleEl, `Blueprint doesn't exist. Please check the entered data: "${roleVal}" is not a recognized career role.`);
      return;
    }

    payload.degree_major = degreeVal;
    payload.current_skills = validSkills.join(", ");
    payload.target_role = roleVal;
  }

  // All checks passed -> Dispatch based on student type
  clearGeneratedResults();
  
  if (currentStudentType === "12th_pass") {
    await handle12thPassDiscovery(payload);
  } else {
    await handleFinalYearSynthesis(payload);
  }
}

async function handle12thPassDiscovery(payload) {
  const loadingView = document.getElementById("loadingView");
  const loadingTitle = document.querySelector(".loading-title");
  const loadingTip = document.getElementById("loadingTip");
  const submitBtn = document.getElementById("submitBtn");

  if (loadingTitle) loadingTitle.textContent = "Discovering Eligible Professions";
  if (loadingTip) loadingTip.textContent = `Analyzing ${payload.stream} and "${payload.interests}" against 2026 industry demand...`;

  loadingView.classList.add("active");
  submitBtn.disabled = true;
  startLoadingTips();

  try {
    const response = await fetch("/api/suggest-professions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Blueprint doesn't exist. Please check the entered data.");
    }

    if (data.is_valid === false) {
      throw new Error(data.error_message || "Blueprint doesn't exist. Please check the entered data.");
    }

    renderProfessionSuggestions(data, payload);
  } catch (err) {
    const errorMsg = document.getElementById("errorMessage");
    const errorTitle = document.getElementById("errorTitle");
    const msg = err.message || "Blueprint doesn't exist. Please check the entered data.";
    if (errorTitle) {
      if (msg.toLowerCase().includes("interest")) {
        errorTitle.textContent = "Please Choose an Interest";
      } else {
        errorTitle.textContent = "Blueprint Doesn't Exist";
      }
    }
    if (errorMsg) errorMsg.textContent = msg;
    if (errorView) {
      errorView.style.display = "flex";
      errorView.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } finally {
    stopLoadingTips();
    loadingView.classList.remove("active");
    submitBtn.disabled = false;
  }
}

function renderProfessionSuggestions(data, originalPayload) {
  const professionView = document.getElementById("professionSelectionView");
  const cardsGrid = document.getElementById("professionCardsGrid");
  const subtitleEl = document.getElementById("professionSelectionSubtitle");
  const titleEl = document.querySelector(".profession-selection-title");

  if (!professionView || !cardsGrid) return;

  currentSuggestionsData = data;
  currentOriginalPayload = originalPayload;

  cardsGrid.innerHTML = "";
  cardsGrid.classList.remove("single-card-view");
  const suggestions = data.suggestions || [];

  if (titleEl) {
    titleEl.textContent = "Pick Your Target Profession";
  }

  if (subtitleEl) {
    subtitleEl.textContent = `Found ${suggestions.length} eligible career paths for ${escapeHtml(originalPayload.stream)} matching "${escapeHtml(originalPayload.interests)}". Select one to generate its comprehensive multi-year architecture blueprint.`;
  }

  suggestions.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "profession-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.dataset.index = index;

    card.innerHTML = `
      <div>
        <div class="profession-card__header">
          <span class="profession-card__match">🌟 ${escapeHtml(item.match_score || "Top Match")}</span>
          <span class="profession-card__salary">${escapeHtml(item.salary_range || "High Growth")}</span>
        </div>
        <div class="profession-card__title">${escapeHtml(item.title)}</div>
        <div class="profession-card__degrees">
          <span>🎓</span>
          <span><strong>Degrees:</strong> ${(item.recommended_degrees || []).map(d => escapeHtml(d)).join(", ")}</span>
        </div>
        <div class="profession-card__why">${escapeHtml(item.why_it_fits)}</div>
        <div class="profession-card__skills">
          ${(item.key_skills || []).map(s => `<span class="profession-card__skill">${escapeHtml(s)}</span>`).join("")}
        </div>
      </div>
      <div class="profession-card__action-row">
        <button type="button" class="profession-card__btn">
          <span>Select & Generate Blueprint</span>
          <span>&rarr;</span>
        </button>
      </div>
    `;

    const triggerSelect = () => {
      // 1. Hide all other courses and keep only the chosen field card
      document.querySelectorAll(".profession-card").forEach((c) => {
        if (c !== card) {
          c.style.display = "none";
          c.classList.remove("selected");
        } else {
          c.style.display = "flex";
          c.classList.add("selected");
          const actionRow = c.querySelector(".profession-card__action-row");
          if (actionRow) {
            actionRow.innerHTML = `
              <div style="display: flex; gap: 12px; flex-wrap: wrap; width: 100%; align-items: center; margin-top: 14px;">
                <div style="flex: 1; min-width: 180px; background: #0d9488; color: #ffffff; padding: 12px 18px; border-radius: 10px; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <span>✓ Chosen Target Field</span>
                </div>
                <button type="button" class="btn-switch-profession btn-show-all-internal" style="padding: 12px 20px; font-size: 13.5px; border-radius: 10px; cursor: pointer; white-space: nowrap;">
                  ⇄ View All Other Career Options
                </button>
              </div>
            `;
            const btnInternal = actionRow.querySelector(".btn-show-all-internal");
            if (btnInternal) {
              btnInternal.onclick = (e) => {
                e.stopPropagation();
                restoreAllProfessionCards();
              };
            }
          }
        }
      });

      cardsGrid.classList.add("single-card-view");

      // 2. Update Header
      if (titleEl) {
        titleEl.textContent = "Chosen Target Field Overview";
      }
      if (subtitleEl) {
        subtitleEl.innerHTML = `Showing brief details and generated multi-year architecture blueprint for <strong>${escapeHtml(item.title)}</strong>. <button type="button" id="btnShowAllCards" class="btn-switch-profession" style="margin-left: 10px; padding: 4px 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; vertical-align: middle;">⇄ View All Other Career Options</button>`;
        const btnShowAll = document.getElementById("btnShowAllCards");
        if (btnShowAll) {
          btnShowAll.onclick = (e) => {
            e.stopPropagation();
            restoreAllProfessionCards();
          };
        }
      }

      // 3. Synthesize the blueprint for the chosen field
      synthesizeChosenProfessionBlueprint(item.title, originalPayload);
    };

    card.addEventListener("click", () => {
      if (card.classList.contains("selected")) return;
      triggerSelect();
    });

    cardsGrid.appendChild(card);
  });

  professionView.style.display = "block";
  professionView.scrollIntoView({ behavior: "smooth", block: "start" });
}

function restoreAllProfessionCards() {
  const cardsGrid = document.getElementById("professionCardsGrid");
  if (cardsGrid) {
    cardsGrid.classList.remove("single-card-view");
  }

  const allCards = document.querySelectorAll(".profession-card");
  allCards.forEach((c) => {
    c.style.display = "flex";
    c.classList.remove("selected");
    const actionRow = c.querySelector(".profession-card__action-row");
    if (actionRow) {
      actionRow.innerHTML = `
        <button type="button" class="profession-card__btn">
          <span>Select &amp; Generate Blueprint</span>
          <span>&rarr;</span>
        </button>
      `;
    }
  });

  const titleEl = document.querySelector(".profession-selection-title");
  if (titleEl) {
    titleEl.textContent = "Pick Your Target Profession";
  }

  const subtitleEl = document.getElementById("professionSelectionSubtitle");
  if (subtitleEl && currentSuggestionsData && currentOriginalPayload) {
    const suggestions = currentSuggestionsData.suggestions || [];
    subtitleEl.textContent = `Found ${suggestions.length} eligible career paths for ${escapeHtml(currentOriginalPayload.stream)} matching "${escapeHtml(currentOriginalPayload.interests)}". Select one to generate its comprehensive multi-year architecture blueprint.`;
  }

  const profView = document.getElementById("professionSelectionView");
  if (profView) {
    profView.style.display = "block";
    profView.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function synthesizeChosenProfessionBlueprint(chosenProfessionTitle, originalPayload) {
  const resultsDashboard = document.getElementById("resultsDashboard");
  if (resultsDashboard) {
    resultsDashboard.classList.remove("active");
    resultsDashboard.style.display = "none";
  }

  const loadingView = document.getElementById("loadingView");
  const loadingTitle = document.querySelector(".loading-title");
  const loadingTip = document.getElementById("loadingTip");
  const submitBtn = document.getElementById("submitBtn");

  if (loadingTitle) loadingTitle.textContent = "Synthesizing Architecture Blueprint";
  if (loadingTip) loadingTip.textContent = `Constructing comprehensive multi-year blueprint for ${chosenProfessionTitle}...`;

  loadingView.classList.add("active");
  if (submitBtn) submitBtn.disabled = true;
  startLoadingTips();

  const analyzePayload = {
    ...originalPayload,
    preferred_careers: chosenProfessionTitle
  };

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analyzePayload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Blueprint doesn't exist. Please check the entered data.");
    }

    if (data.is_valid === false) {
      throw new Error(data.error_message || "Blueprint doesn't exist. Please check the entered data.");
    }

    renderFutureResults(data, chosenProfessionTitle);
  } catch (err) {
    const errorMsg = document.getElementById("errorMessage");
    const errorTitle = document.getElementById("errorTitle");
    if (errorTitle) errorTitle.textContent = "Blueprint Doesn't Exist";
    if (errorMsg) errorMsg.textContent = err.message || "Blueprint doesn't exist. Please check the entered data.";
    if (errorView) {
      errorView.style.display = "flex";
      errorView.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } finally {
    stopLoadingTips();
    loadingView.classList.remove("active");
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleFinalYearSynthesis(payload) {
  const loadingView = document.getElementById("loadingView");
  const loadingTitle = document.querySelector(".loading-title");
  const loadingTip = document.getElementById("loadingTip");
  const submitBtn = document.getElementById("submitBtn");

  if (loadingTitle) loadingTitle.textContent = "Synthesizing Trajectory";
  if (loadingTip) loadingTip.textContent = "Querying modern market metrics and constructing milestone roadmap...";

  loadingView.classList.add("active");
  submitBtn.disabled = true;
  startLoadingTips();

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Blueprint doesn't exist. Please check the entered data.");
    }

    if (data.is_valid === false) {
      throw new Error(data.error_message || "Blueprint doesn't exist. Please check the entered data.");
    }

    renderFutureResults(data, payload.target_role);
  } catch (err) {
    const errorMsg = document.getElementById("errorMessage");
    const errorTitle = document.getElementById("errorTitle");
    if (errorTitle) errorTitle.textContent = "Blueprint Doesn't Exist";
    if (errorMsg) errorMsg.textContent = err.message || "Blueprint doesn't exist. Please check the entered data.";
    if (errorView) {
      errorView.style.display = "flex";
      errorView.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } finally {
    stopLoadingTips();
    loadingView.classList.remove("active");
    submitBtn.disabled = false;
  }
}

function renderFutureResults(data, chosenTitle) {
  const displayTitle = chosenTitle || (data.field_intelligence && data.field_intelligence.field_title) || (data.recommended_roles && data.recommended_roles[0]) || "Custom Architecture";
  window.currentRenderedTrack = displayTitle;

  // Active Chosen Profession Banner
  const activeBanner = document.getElementById("activeProfessionBanner");
  const activeTitle = document.getElementById("activeProfessionTitle");
  if (activeBanner && activeTitle) {
    if (chosenTitle || currentStudentType === "12th_pass") {
      activeTitle.textContent = displayTitle;
      activeBanner.style.display = "flex";
      const btnSwitch = document.getElementById("btnSwitchProfession");
      if (btnSwitch) {
        btnSwitch.onclick = () => {
          const profView = document.getElementById("professionSelectionView");
          if (profView && profView.style.display !== "none" && currentStudentType === "12th_pass") {
            restoreAllProfessionCards();
          } else if (profView && profView.style.display !== "none") {
            profView.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            const form = document.getElementById("mainPlannerForm");
            if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        };
      }
    } else {
      activeBanner.style.display = "none";
    }
  }

  // Data Source Indicator (AI vs Database Vault)
  const sourceBadge = document.getElementById("resSourceBadge");
  if (sourceBadge) {
    if (data.data_source === "database_cache" || data._cached_from_db) {
      sourceBadge.className = "source-badge source-badge--db";
      sourceBadge.textContent = "💾 Database Vault (Instant Offline Match)";
      sourceBadge.style.display = "inline-flex";
    } else {
      sourceBadge.className = "source-badge source-badge--ai";
      sourceBadge.textContent = "⚡ AI Synthesized & Stored in DB";
      sourceBadge.style.display = "inline-flex";
    }
  }

  // 1. Trajectory Summary
  document.getElementById("resTrajectoryTitle").textContent = displayTitle;
  document.getElementById("resProfileSummary").textContent = data.profile_summary;

  const rolesContainer = document.getElementById("resRolesContainer");
  rolesContainer.innerHTML = "";
  (data.recommended_roles || []).forEach((role) => {
    const badge = document.createElement("span");
    badge.className = "pill-item pill-item--hot";
    badge.textContent = role;
    rolesContainer.appendChild(badge);
  });

  // 2. Field Intelligence & Domain Deep Dive
  const fieldPanel = document.getElementById("panelFieldIntelligence");
  if (data.field_intelligence && fieldPanel) {
    fieldPanel.style.display = "block";
    const fi = data.field_intelligence;

    document.getElementById("resFieldTitle").textContent = fi.field_title || (data.recommended_roles && data.recommended_roles[0]) || "Chosen Field Architecture";
    document.getElementById("resFieldReality").textContent = fi.industry_reality_2026 || "";

    const comps = fi.compensation_benchmarks || {};
    document.getElementById("resSalaryEntry").textContent = comps.entry_level || "₹6 - ₹12 LPA ($85k - $115k)";
    document.getElementById("resSalaryMid").textContent = comps.mid_level || "₹16 - ₹32 LPA ($130k - $175k)";
    document.getElementById("resSalaryStaff").textContent = comps.senior_staff || "₹38 - ₹75+ LPA ($200k - $310k+)";

    const hiringContainer = document.getElementById("resHiringCompanies");
    hiringContainer.innerHTML = "";
    (fi.top_hiring_companies || []).forEach(comp => {
      const pill = document.createElement("span");
      pill.className = "pill-item pill-item--hot";
      pill.textContent = comp;
      hiringContainer.appendChild(pill);
    });

    const specsList = document.getElementById("resSpecializationsList");
    specsList.innerHTML = "";
    (fi.key_specializations || []).forEach(spec => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="bullet">✦</span> <span>${escapeHtml(spec)}</span>`;
      specsList.appendChild(li);
    });

    const principlesList = document.getElementById("resPrinciplesList");
    principlesList.innerHTML = "";
    (fi.critical_architectural_principles || []).forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="bullet">⚡</span> <span>${escapeHtml(p)}</span>`;
      principlesList.appendChild(li);
    });

    const certsList = document.getElementById("resCertsList");
    certsList.innerHTML = "";
    (fi.high_value_certifications || []).forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="bullet">📜</span> <span>${escapeHtml(c)}</span>`;
      certsList.appendChild(li);
    });
  } else if (fieldPanel) {
    fieldPanel.style.display = "none";
  }

  // 3. AI Shield
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
    li.innerHTML = `<span class="bullet">✦</span> <span>${escapeHtml(item)}</span>`;
    aiFailsList.appendChild(li);
  });

  const aiToolsList = document.getElementById("resAiToolsList");
  aiToolsList.innerHTML = "";
  (data.ai_analysis?.ai_tools_to_master || []).forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="bullet">⚡</span> <span>${escapeHtml(item)}</span>`;
    aiToolsList.appendChild(li);
  });

  // 4. Tech Radar
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

  // 5. Timeline Roadmap
  document.getElementById("resTimelineHeading").textContent =
    currentStudentType === "12th_pass" ? "Multi-Year Architecture Roadmap" : "Multi-Phase Career Execution Roadmap";

  const timelineContainer = document.getElementById("resTimelineContainer");
  timelineContainer.innerHTML = "";

  (data.timeline_roadmap || []).forEach((item) => {
    const card = document.createElement("div");
    card.className = "timeline-card";

    let cap = item.capstone_project;
    let projTitle = "Production Capstone System";
    let projDesc = "";
    let projStack = [];
    let projChallenges = [];
    let projOutcome = "";

    if (cap && typeof cap === "object") {
      projTitle = cap.title || projTitle;
      projDesc = cap.description || "";
      projStack = Array.isArray(cap.tech_stack) ? cap.tech_stack : [];
      projChallenges = Array.isArray(cap.key_engineering_challenges) ? cap.key_engineering_challenges : [];
      projOutcome = cap.portfolio_outcome || "";
    } else if (item.action_project) {
      projDesc = item.action_project;
      projStack = item.skills_to_acquire || [];
    }

    card.innerHTML = `
      <div class="timeline-card__top">
        <span class="timeline-card__period">${escapeHtml(item.period)}</span>
        <h4 class="timeline-card__theme">${escapeHtml(item.focus_theme)}</h4>
      </div>

      <!-- Milestone Goals Checklist -->
      ${item.milestone_goals && item.milestone_goals.length > 0 ? `
        <div class="timeline-section">
          <div class="timeline-section__label">🎯 Core Milestone Goals:</div>
          <ul class="timeline-checklist">
            ${item.milestone_goals.map(g => `<li><span class="check-icon">✓</span> <span>${escapeHtml(g)}</span></li>`).join("")}
          </ul>
        </div>
      ` : ""}

      <!-- Skills Matrix -->
      <div class="timeline-section">
        <div class="timeline-section__label">⚡ Target Technical Stack:</div>
        <div class="timeline-card__skills">
          ${(item.skills_to_acquire || []).map((s) => `<span class="timeline-card__skill">${escapeHtml(s)}</span>`).join("")}
        </div>
      </div>

      <!-- Applied Capstone Project Architecture -->
      ${projDesc || projTitle ? `
        <div class="timeline-project-box">
          <div class="timeline-project-box__header">
            <span class="timeline-project-box__badge">🛠️ APPLIED CAPSTONE ARCHITECTURE</span>
            <div class="timeline-project-box__title">${escapeHtml(projTitle)}</div>
          </div>
          <div class="timeline-project-box__desc">${escapeHtml(projDesc)}</div>

          ${projStack.length > 0 ? `
            <div class="timeline-project-box__stack">
              <strong>Tech Stack:</strong>
              ${projStack.map(t => `<span class="proj-tech-pill">${escapeHtml(t)}</span>`).join("")}
            </div>
          ` : ""}

          ${projChallenges.length > 0 ? `
            <div class="timeline-project-box__challenges">
              <strong>Key Engineering Challenges:</strong>
              <ul>
                ${projChallenges.map(c => `<li>• ${escapeHtml(c)}</li>`).join("")}
              </ul>
            </div>
          ` : ""}

          ${projOutcome ? `
            <div class="timeline-project-box__outcome">
              <span>🚀</span> <span><strong>Portfolio Outcome:</strong> ${escapeHtml(projOutcome)}</span>
            </div>
          ` : ""}

          <!-- Link to 4-Person Squad War Room -->
          <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(20, 184, 166, 0.25); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 12px; color: #0d9488; font-weight: 700; display: flex; align-items: center; gap: 6px;">
              <span>🛡️</span> <span>Build this capstone with a 4-person squad (&ge; 2 interest match)</span>
            </div>
            <a href="/community?track=${encodeURIComponent(window.currentRenderedTrack || projTitle || 'AI & Machine Learning')}" style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: #ffffff; text-decoration: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(13,148,136,0.25); transition: all 0.2s ease;">
              <span>👥</span> Find Squad Teammates &rarr;
            </a>
          </div>
        </div>
      ` : ""}

      <!-- Action Items & AI Co-Pilot Split Row -->
      ${(item.career_action_item || item.ai_copilot_workflow) ? `
        <div class="timeline-split-row">
          ${item.career_action_item ? `
            <div class="timeline-action-card">
              <div class="timeline-action-card__label">💼 Career & Placement Move</div>
              <div>${escapeHtml(item.career_action_item)}</div>
            </div>
          ` : ""}
          ${item.ai_copilot_workflow ? `
            <div class="timeline-action-card timeline-action-card--ai">
              <div class="timeline-action-card__label">🤖 AI Co-Pilot Workflow</div>
              <div>${escapeHtml(item.ai_copilot_workflow)}</div>
            </div>
          ` : ""}
        </div>
      ` : ""}

      <!-- Curated Free Learning Resources -->
      ${item.free_learning_resources && item.free_learning_resources.length > 0 ? `
        <div class="timeline-card__resources">
          <span class="timeline-resources__label">📚 Primary Curated References:</span>
          <div class="timeline-resources__links">
            ${item.free_learning_resources.map(r => `<span class="timeline-res-link">${escapeHtml(r)}</span>`).join("")}
          </div>
        </div>
      ` : ""}
    `;

    timelineContainer.appendChild(card);
  });

  const dashboard = document.getElementById("resultsDashboard");
  dashboard.style.display = "";
  dashboard.classList.add("active");
  dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* =========================================================
   Combobox & Searchable Dropdown Systems
   ========================================================= */

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const COURSE_DATA = [
  { title: "B.Tech - Computer Science & Engineering (CSE)", category: "Engineering" },
  { title: "B.Tech - Artificial Intelligence & Data Science", category: "Engineering" },
  { title: "B.Tech - Information Technology (IT)", category: "Engineering" },
  { title: "B.Tech - Electronics & Communication (ECE)", category: "Engineering" },
  { title: "B.Tech - Electrical & Electronics (EEE)", category: "Engineering" },
  { title: "B.Tech - Mechanical Engineering", category: "Engineering" },
  { title: "B.Tech - Civil Engineering", category: "Engineering" },
  { title: "B.Tech - Robotics & Automation", category: "Engineering" },
  { title: "B.Tech - Biotechnology & Bioinformatics", category: "Engineering" },
  { title: "B.Tech - Chemical Engineering", category: "Engineering" },
  { title: "BCA - Bachelor of Computer Applications", category: "Computer Applications" },
  { title: "MCA - Master of Computer Applications", category: "Computer Applications" },
  { title: "B.Sc - Computer Science", category: "Science" },
  { title: "B.Sc - Information Technology (IT)", category: "Science" },
  { title: "B.Sc - Data Science & Analytics", category: "Science" },
  { title: "B.Sc - Mathematics & Computing", category: "Science" },
  { title: "B.Sc - Statistics", category: "Science" },
  { title: "B.Sc - Physics & Applied Sciences", category: "Science" },
  { title: "B.Com - Computer Applications", category: "Commerce" },
  { title: "B.Com - Finance & Accounting", category: "Commerce" },
  { title: "BBA - Business Analytics & Information Systems", category: "Management" },
  { title: "BBA - General Management & Marketing", category: "Management" },
  { title: "MBA - Tech & Systems Management", category: "Management" },
  { title: "B.Des - UI/UX & Interaction Design", category: "Design" },
  { title: "M.Tech - Computer Science & Engineering", category: "Postgraduate" }
];

const SKILL_DATA = [
  // Programming Languages
  { title: "Python", category: "Language" },
  { title: "JavaScript", category: "Language" },
  { title: "TypeScript", category: "Language" },
  { title: "Java", category: "Language" },
  { title: "C++", category: "Language" },
  { title: "C", category: "Language" },
  { title: "C#", category: "Language" },
  { title: "Go (Golang)", category: "Language" },
  { title: "Rust", category: "Language" },
  { title: "SQL", category: "Database" },
  { title: "Kotlin", category: "Mobile" },
  { title: "Swift", category: "Mobile" },
  { title: "PHP", category: "Language" },
  { title: "R", category: "Data Science" },
  { title: "Dart", category: "Mobile" },
  
  // Frontend
  { title: "React.js", category: "Frontend" },
  { title: "Next.js", category: "Frontend" },
  { title: "Vue.js", category: "Frontend" },
  { title: "Angular", category: "Frontend" },
  { title: "HTML5 & CSS3", category: "Frontend" },
  { title: "Tailwind CSS", category: "Frontend" },
  { title: "Redux / Zustand", category: "Frontend" },
  { title: "REST APIs", category: "API" },
  { title: "GraphQL", category: "API" },
  
  // Backend & Systems
  { title: "Node.js", category: "Backend" },
  { title: "Express.js", category: "Backend" },
  { title: "FastAPI", category: "Backend" },
  { title: "Django", category: "Backend" },
  { title: "Flask", category: "Backend" },
  { title: "Spring Boot", category: "Backend" },
  { title: "ASP.NET Core", category: "Backend" },
  { title: "NestJS", category: "Backend" },
  { title: "Microservices", category: "Architecture" },

  // Databases & Storage
  { title: "PostgreSQL", category: "Database" },
  { title: "MySQL", category: "Database" },
  { title: "MongoDB", category: "Database" },
  { title: "Redis", category: "Database" },
  { title: "SQLite", category: "Database" },
  { title: "Supabase", category: "Database" },
  { title: "Firebase", category: "Database" },
  
  // Cloud & DevOps
  { title: "Git & GitHub", category: "Tools" },
  { title: "Docker", category: "DevOps" },
  { title: "Kubernetes", category: "DevOps" },
  { title: "AWS (Amazon Web Services)", category: "Cloud" },
  { title: "Google Cloud (GCP)", category: "Cloud" },
  { title: "Microsoft Azure", category: "Cloud" },
  { title: "Linux & Bash", category: "DevOps" },
  { title: "CI/CD Pipelines", category: "DevOps" },

  // AI & Data Science
  { title: "Machine Learning", category: "AI / ML" },
  { title: "Deep Learning", category: "AI / ML" },
  { title: "PyTorch", category: "AI / ML" },
  { title: "TensorFlow", category: "AI / ML" },
  { title: "Pandas & NumPy", category: "Data Science" },
  { title: "Scikit-Learn", category: "AI / ML" },
  { title: "Generative AI & LLMs", category: "AI / ML" },
  { title: "LangChain", category: "AI / ML" },
  { title: "Computer Vision (OpenCV)", category: "AI / ML" },
  { title: "NLP (Natural Language)", category: "AI / ML" },

  // Core CS
  { title: "Data Structures & Algorithms (DSA)", category: "Core CS" },
  { title: "Object-Oriented Programming (OOP)", category: "Core CS" },
  { title: "System Design", category: "Architecture" },
  { title: "DBMS Concepts", category: "Core CS" },
  { title: "Computer Networks", category: "Core CS" },
  { title: "Operating Systems", category: "Core CS" }
];

const POPULAR_SKILLS = [
  "Python", "JavaScript", "React.js", "Java", "C++", 
  "SQL", "Node.js", "Docker", "Git & GitHub", "Machine Learning", 
  "Tailwind CSS", "AWS"
];

const ROLE_DATA = [
  { title: "Full Stack Web Developer", category: "Web Dev" },
  { title: "Frontend Engineer (React / Next.js)", category: "Frontend" },
  { title: "Backend Systems Engineer (Python / Go / Java)", category: "Backend" },
  { title: "AI / Machine Learning Engineer", category: "AI / ML" },
  { title: "Data Scientist & Applied ML", category: "Data Science" },
  { title: "Data Analyst & Business Intelligence", category: "Analytics" },
  { title: "Cloud & DevOps Architect", category: "Cloud" },
  { title: "Cybersecurity Analyst & Engineer", category: "Security" },
  { title: "Mobile App Developer (Flutter / React Native)", category: "Mobile" },
  { title: "Site Reliability Engineer (SRE)", category: "DevOps" },
  { title: "AI Product Manager / Technical PM", category: "Product" },
  { title: "Embedded Systems & IoT Engineer", category: "Hardware" },
  { title: "UI/UX & Product Designer", category: "Design" },
  { title: "Blockchain & Web3 Developer", category: "Web3" }
];

function initComboboxesAndSkills() {
  setupStandardCombobox({
    wrapperId: "degreeCombobox",
    inputId: "degreeMajor",
    dropdownId: "degreeDropdown",
    toggleId: "degreeToggle",
    data: COURSE_DATA,
    placeholderAction: "Use custom degree"
  });

  setupStandardCombobox({
    wrapperId: "roleCombobox",
    inputId: "targetRole",
    dropdownId: "roleDropdown",
    toggleId: "roleToggle",
    data: ROLE_DATA,
    placeholderAction: "Use custom role"
  });

  setupSkillsSelector();
}

function setupStandardCombobox({ wrapperId, inputId, dropdownId, toggleId, data, placeholderAction }) {
  const wrapper = document.getElementById(wrapperId);
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const toggle = document.getElementById(toggleId);

  if (!wrapper || !input || !dropdown) return;

  let activeIndex = -1;

  function renderList(query = "") {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? data.filter(d => d.title.toLowerCase().includes(q))
      : data;

    activeIndex = -1;

    let html = "";
    if (filtered.length > 0) {
      filtered.forEach((item, idx) => {
        html += `
          <div class="combobox-item" data-value="${escapeHtml(item.title)}" data-index="${idx}">
            <span class="combobox-item-title">${escapeHtml(item.title)}</span>
            <span class="combobox-item-badge">${escapeHtml(item.category)}</span>
          </div>
        `;
      });
    }

    // If query has no exact match, allow custom select
    if (q && !filtered.some(d => d.title.toLowerCase() === q)) {
      html += `
        <div class="combobox-custom-action" data-custom="${escapeHtml(query.trim())}">
          <span>✦ ${escapeHtml(placeholderAction)}:</span> <strong>"${escapeHtml(query.trim())}"</strong>
        </div>
      `;
    }

    if (!html) {
      html = `<div class="combobox-empty">No matching options found</div>`;
    }

    dropdown.innerHTML = html;
  }

  function openDropdown() {
    renderList(input.value);
    wrapper.classList.add("open");
  }

  function closeDropdown() {
    wrapper.classList.remove("open");
    activeIndex = -1;
  }

  input.addEventListener("focus", () => {
    openDropdown();
  });

  input.addEventListener("input", () => {
    openDropdown();
  });

  toggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (wrapper.classList.contains("open")) {
      closeDropdown();
    } else {
      input.focus();
      openDropdown();
    }
  });

  dropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".combobox-item");
    if (item) {
      input.value = item.dataset.value;
      closeDropdown();
      input.focus();
      return;
    }
    const custom = e.target.closest(".combobox-custom-action");
    if (custom) {
      input.value = custom.dataset.custom;
      closeDropdown();
      input.focus();
      return;
    }
  });

  input.addEventListener("keydown", (e) => {
    if (!wrapper.classList.contains("open")) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        openDropdown();
        e.preventDefault();
      }
      return;
    }

    const items = dropdown.querySelectorAll(".combobox-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      activeIndex = (activeIndex + 1) % items.length;
      updateHighlight(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateHighlight(items);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        input.value = items[activeIndex].dataset.value;
        closeDropdown();
      } else {
        closeDropdown();
      }
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  });

  function updateHighlight(items) {
    items.forEach((it, i) => {
      if (i === activeIndex) {
        it.classList.add("highlighted");
        it.scrollIntoView({ block: "nearest" });
      } else {
        it.classList.remove("highlighted");
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      closeDropdown();
    }
  });
}

function setupSkillsSelector() {
  const container = document.getElementById("selectedSkillsContainer");
  const hiddenInput = document.getElementById("currentSkills");
  const wrapper = document.getElementById("skillsCombobox");
  const searchInput = document.getElementById("skillSearchInput");
  const dropdown = document.getElementById("skillsDropdown");
  const toggle = document.getElementById("skillsToggle");
  const quickTray = document.getElementById("quickSkillsPills");

  if (!wrapper || !searchInput || !dropdown || !hiddenInput) return;

  selectedSkills = [];
  let activeIndex = -1;

  // Setup quick pill suggestions
  if (quickTray) {
    if (quickTray.children.length === 0) {
      quickTray.innerHTML = POPULAR_SKILLS.map(skill => `
        <button type="button" class="quick-skill-pill" data-skill="${escapeHtml(skill)}">+ ${escapeHtml(skill)}</button>
      `).join("");
    }

    quickTray.addEventListener("click", (e) => {
      const pill = e.target.closest(".quick-skill-pill");
      if (!pill) return;
      const skillName = pill.dataset.skill;
      if (hasSkill(skillName)) {
        removeSkill(skillName);
      } else {
        addSkill(skillName);
      }
    });
  }

  function hasSkill(name) {
    return selectedSkills.some(s => s.toLowerCase() === name.trim().toLowerCase());
  }

  function addSkill(name) {
    const clean = name.trim();
    if (!clean) return;
    if (!hasSkill(clean)) {
      selectedSkills.push(clean);
      syncUI();
    }
    searchInput.value = "";
    renderDropdown("");
  }

  function removeSkill(name) {
    selectedSkills = selectedSkills.filter(s => s.toLowerCase() !== name.trim().toLowerCase());
    syncUI();
    renderDropdown(searchInput.value);
  }

  function syncUI() {
    hiddenInput.value = selectedSkills.join(", ");
    container.innerHTML = selectedSkills.map(s => `
      <span class="skill-tag">
        <span>${escapeHtml(s)}</span>
        <button type="button" class="skill-tag__remove" data-skill="${escapeHtml(s)}" aria-label="Remove ${escapeHtml(s)}" tabindex="-1">&times;</button>
      </span>
    `).join("");

    // Update quick pills state
    document.querySelectorAll(".quick-skill-pill").forEach(pill => {
      const isSel = hasSkill(pill.dataset.skill);
      pill.classList.toggle("selected", isSel);
    });
  }

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".skill-tag__remove");
    if (btn) {
      removeSkill(btn.dataset.skill);
    }
  });

  function renderDropdown(query = "") {
    const q = query.trim().toLowerCase();
    // Exclude already added skills
    const available = SKILL_DATA.filter(item => !hasSkill(item.title));
    const filtered = q
      ? available.filter(item => item.title.toLowerCase().includes(q))
      : available;

    activeIndex = -1;

    let html = "";
    if (filtered.length > 0) {
      filtered.forEach((item, idx) => {
        html += `
          <div class="combobox-item" data-value="${escapeHtml(item.title)}" data-index="${idx}">
            <span class="combobox-item-title">${escapeHtml(item.title)}</span>
            <span class="combobox-item-badge">${escapeHtml(item.category)}</span>
          </div>
        `;
      });
    }

    // If typed query doesn't match an existing skill exactly, allow adding as custom
    if (q && !hasSkill(query) && !filtered.some(item => item.title.toLowerCase() === q)) {
      html += `
        <div class="combobox-custom-action" data-custom="${escapeHtml(query.trim())}">
          <span>✦ Add custom skill:</span> <strong>"${escapeHtml(query.trim())}"</strong>
        </div>
      `;
    }

    if (!html) {
      html = `<div class="combobox-empty">All suggestions selected or no match</div>`;
    }

    dropdown.innerHTML = html;
  }

  function openDropdown() {
    renderDropdown(searchInput.value);
    wrapper.classList.add("open");
  }

  function closeDropdown() {
    wrapper.classList.remove("open");
    activeIndex = -1;
  }

  searchInput.addEventListener("focus", openDropdown);
  searchInput.addEventListener("input", openDropdown);

  toggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (wrapper.classList.contains("open")) {
      closeDropdown();
    } else {
      searchInput.focus();
      openDropdown();
    }
  });

  dropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".combobox-item");
    if (item) {
      addSkill(item.dataset.value);
      searchInput.focus();
      return;
    }
    const custom = e.target.closest(".combobox-custom-action");
    if (custom) {
      addSkill(custom.dataset.custom);
      searchInput.focus();
      return;
    }
  });

  searchInput.addEventListener("keydown", (e) => {
    if (!wrapper.classList.contains("open")) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        openDropdown();
        e.preventDefault();
      }
      return;
    }

    const items = dropdown.querySelectorAll(".combobox-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      activeIndex = (activeIndex + 1) % items.length;
      updateHighlight(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateHighlight(items);
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        addSkill(items[activeIndex].dataset.value);
      } else if (searchInput.value.trim()) {
        const parts = searchInput.value.split(",");
        parts.forEach(p => addSkill(p));
      }
      openDropdown();
    } else if (e.key === "Backspace" && !searchInput.value && selectedSkills.length > 0) {
      removeSkill(selectedSkills[selectedSkills.length - 1]);
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  });

  function updateHighlight(items) {
    items.forEach((it, i) => {
      if (i === activeIndex) {
        it.classList.add("highlighted");
        it.scrollIntoView({ block: "nearest" });
      } else {
        it.classList.remove("highlighted");
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      closeDropdown();
    }
  });
}

