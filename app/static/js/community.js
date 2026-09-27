/**
 * FutureEra Community & Project Squad Engine
 * Human-crafted peer matchmaking and 4-member squad collaboration.
 */

// Global State
const STATE = {
  token: localStorage.getItem("fe_session_token") || "",
  currentUser: null,
  allPeers: [],
  guestInterests: ["Coding & Tech", "AI & Machine Learning"],
  currentSquad: null,
  activeTab: "matchmaking",
  chatPollTimer: null,
  regInterests: new Set(),
  activeSkillFilter: "all"
};

// ==========================================
// SVG ICON HELPERS
// ==========================================
const ICONS = {
  search: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  target: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
  academic: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>`,
  userPlus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  share: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
  video: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`,
  compass: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  send: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
};

function getInitials(name) {
  if (!name) return "FE";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function getAvatarColor(name, storedColor) {
  if (storedColor && storedColor.startsWith("#")) return storedColor;
  const palette = ["#0f766e", "#4338ca", "#0284c7", "#b45309", "#059669", "#7c3aed", "#be185d", "#334155"];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  initRegistrationChips();
  await checkAuthStatus();
  await refreshPeers();
  await refreshSquadsDirectory();
  checkUrlParamsForJoin();
});

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (STATE.token) {
    headers["Authorization"] = `Bearer ${STATE.token}`;
    headers["X-Session-Token"] = STATE.token;
  }
  return headers;
}

// ==========================================
// AUTHENTICATION & SESSION HANDLING
// ==========================================
async function checkAuthStatus() {
  if (!STATE.token) {
    renderUserHeaderLoggedOut();
    return;
  }

  try {
    const res = await fetch("/api/auth/me", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.authenticated && data.user) {
      STATE.currentUser = data.user;
      renderUserHeaderLoggedIn(data.user);
      if (data.user.squad_id) {
        loadUserSquad();
      }
    } else {
      logout(false);
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    renderUserHeaderLoggedOut();
  }
}

function renderUserHeaderLoggedIn(user) {
  const container = document.getElementById("userHeaderArea");
  if (!container) return;

  const initials = getInitials(user.full_name);
  const color = getAvatarColor(user.full_name, user.avatar_color);

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <button class="user-pill-btn" onclick="openMyProfileModal()">
        <div class="user-avatar-initials-sm" style="background-color: ${color};">
          ${initials}
        </div>
        <span>${escapeHtml(user.full_name.split(' ')[0])}</span>
        ${user.squad_name ? `<span style="font-size: 11px; background: #f0fdfa; color: #0f766e; border: 1px solid #ccfbf1; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${escapeHtml(user.squad_name)}</span>` : ''}
      </button>
      <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px; border-radius: 999px;" onclick="logout(true)" title="Sign Out">
        Sign Out
      </button>
    </div>
  `;
}

function renderUserHeaderLoggedOut() {
  const container = document.getElementById("userHeaderArea");
  if (!container) return;

  container.innerHTML = `
    <button id="authModalTriggerBtn" class="btn btn--solid" style="padding: 8px 18px; font-size: 13px;" onclick="openAuthModal('signin')">
      Sign In / Join &rarr;
    </button>
  `;
}

async function handleSignInSubmit(e) {
  e.preventDefault();
  const username_or_email = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username_or_email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Sign-in failed. Please check credentials.", "error");
      return;
    }

    STATE.token = data.token;
    STATE.currentUser = data.user;
    localStorage.setItem("fe_session_token", data.token);

    closeAuthModal();
    renderUserHeaderLoggedIn(data.user);
    showToast(`Signed in as ${data.user.full_name}`);

    await refreshPeers();
    if (data.user.squad_id) {
      await loadUserSquad();
    }
  } catch (err) {
    showToast("Network error. Please try again.", "error");
  }
}

async function handleSignUpSubmit(e) {
  e.preventDefault();
  const full_name = document.getElementById("regFullName").value.trim();
  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const stage = document.getElementById("regStage").value;
  const stream_or_degree = document.getElementById("regDegree").value.trim();
  const target_role = document.getElementById("regTargetRole").value.trim();
  const bio = document.getElementById("regBio").value.trim();
  const interests = Array.from(STATE.regInterests);

  if (interests.length < 3) {
    showToast("Please choose at least 3 core interests to enable peer matching.", "error");
    return;
  }

  const color = getAvatarColor(full_name);

  try {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name,
        username,
        email,
        password,
        stage,
        stream_or_degree,
        target_role,
        bio,
        interests,
        avatar_color: color,
        avatar_emoji: ""
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Registration failed.", "error");
      return;
    }

    STATE.token = data.token;
    STATE.currentUser = data.user;
    localStorage.setItem("fe_session_token", data.token);

    closeAuthModal();
    renderUserHeaderLoggedIn(data.user);
    showToast(`Account created. Welcome, ${data.user.full_name}!`);

    await refreshPeers();
  } catch (err) {
    showToast("Network error during registration.", "error");
  }
}

function logout(showNotice = true) {
  if (STATE.token) {
    fetch("/api/auth/logout", { method: "POST", headers: getAuthHeaders() }).catch(() => {});
  }
  STATE.token = "";
  STATE.currentUser = null;
  STATE.currentSquad = null;
  localStorage.removeItem("fe_session_token");
  renderUserHeaderLoggedOut();
  if (showNotice) showToast("Signed out successfully.");
  refreshPeers();
  renderNotInSquadView();
}

// ==========================================
// TAB SWITCHING & URL PARAMS
// ==========================================
function switchCommTab(tabKey) {
  STATE.activeTab = tabKey;
  document.querySelectorAll(".comm-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick").includes(`'${tabKey}'`));
  });

  document.querySelectorAll(".tab-view").forEach(view => {
    view.classList.remove("active");
  });
  const activeView = document.getElementById(`tab-${tabKey}`);
  if (activeView) activeView.classList.add("active");

  if (tabKey === "squad") {
    if (STATE.currentUser && STATE.currentUser.squad_id) {
      loadUserSquad();
    } else {
      renderDefaultSquadView();
    }
  } else {
    stopChatPolling();
  }

  if (tabKey === "directory") {
    refreshSquadsDirectory();
  }
}

function checkUrlParamsForJoin() {
  const urlParams = new URLSearchParams(window.location.search);
  const joinCode = urlParams.get("join");
  if (joinCode) {
    openJoinSquadModal(joinCode);
  }

  const trackParam = urlParams.get("track");
  if (trackParam) {
    const searchInput = document.getElementById("peerSearchInput");
    if (searchInput) {
      searchInput.value = trackParam;
      document.getElementById("clearSearchBtn").style.display = "block";
      refreshPeers();
    }
    const squadTrackInput = document.getElementById("squadTrackInput");
    if (squadTrackInput) {
      squadTrackInput.value = trackParam;
    }
    showToast(`Filtered peers for track: "${trackParam}"`);
  }

  const tabParam = urlParams.get("tab");
  if (tabParam && ["matchmaking", "squad", "directory"].includes(tabParam)) {
    switchCommTab(tabParam);
  }
}

// ==========================================
// TAB 1: PEER DISCOVERY & MATCHMAKING
// ==========================================
function initRegistrationChips() {
  const chips = document.querySelectorAll("#regInterestChips .skill-pill-btn");
  const counter = document.getElementById("regInterestCounter");

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const val = chip.getAttribute("data-interest");
      if (STATE.regInterests.has(val)) {
        STATE.regInterests.delete(val);
        chip.classList.remove("active");
      } else {
        STATE.regInterests.add(val);
        chip.classList.add("active");
      }
      const count = STATE.regInterests.size;
      if (counter) {
        counter.textContent = `${count}/3 selected`;
        counter.style.color = count >= 3 ? "#0f766e" : "#b45309";
      }
    });
  });
}

function toggleQuickSkill(skill) {
  STATE.activeSkillFilter = skill;
  document.querySelectorAll("#quickSkillPills .skill-pill-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-skill") === skill);
  });

  const searchInput = document.getElementById("peerSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");

  if (skill === "all") {
    if (searchInput) {
      searchInput.value = "";
      if (clearBtn) clearBtn.style.display = "none";
    }
  } else {
    if (searchInput) {
      searchInput.value = skill;
      if (clearBtn) clearBtn.style.display = "block";
    }
  }
  refreshPeers();
}

function clearSearchInput() {
  const searchInput = document.getElementById("peerSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");
  if (searchInput) searchInput.value = "";
  if (clearBtn) clearBtn.style.display = "none";
  toggleQuickSkill("all");
}

async function refreshPeers() {
  const search = document.getElementById("peerSearchInput")?.value.trim() || "";
  const stage = document.getElementById("stageFilterSelect")?.value || "all";
  const minOverlap = parseInt(document.getElementById("overlapFilterSelect")?.value || "0", 10);

  const clearBtn = document.getElementById("clearSearchBtn");
  if (clearBtn) {
    clearBtn.style.display = search.length > 0 ? "block" : "none";
  }

  const queryParams = new URLSearchParams({
    search,
    stage,
    min_overlap: minOverlap
  });

  if (!STATE.currentUser && STATE.guestInterests.length > 0) {
    queryParams.set("guest_interests", STATE.guestInterests.join(","));
  }

  try {
    const res = await fetch(`/api/community/peers?${queryParams.toString()}`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      STATE.allPeers = data.peers;
      renderPeers(data.peers);
      updatePeerStats(data.peers);
    }
  } catch (err) {
    console.error("Failed to fetch peers:", err);
  }
}

function handlePeerSearch() {
  refreshPeers();
}

function updatePeerStats(peers) {
  const totalElem = document.getElementById("statTotalPeers");
  const badgeElem = document.getElementById("tabMatchBadge");
  if (totalElem) totalElem.textContent = peers.length;
  if (badgeElem) badgeElem.textContent = peers.length;
}

function renderPeers(peers) {
  const grid = document.getElementById("peersGrid");
  if (!grid) return;

  if (peers.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: #ffffff; border-radius: 14px; border: 1px dashed var(--comm-border-strong);">
        <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">No Matching Peers Found</h3>
        <p style="font-size: 13.5px; color: #64748b; max-width: 440px; margin: 0 auto 16px;">
          Try expanding your search terms, selecting "All Academic Stages", or switching to "All Match Levels".
        </p>
        <button class="btn-secondary" style="padding: 7px 16px; font-size: 12.5px; border-radius: 6px;" onclick="resetPeerFilters()">
          Reset Search Filters
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = peers.map(peer => {
    const isStrong = peer.is_strong_match;
    const matchTag = isStrong
      ? `<span class="peer-match-pill strong"><span class="match-indicator-dot"></span> ${peer.match_percentage}% match • ${peer.overlap_count} shared</span>`
      : peer.overlap_count > 0
        ? `<span class="peer-match-pill"><span class="match-indicator-dot muted"></span> ${peer.match_percentage}% match • 1 shared</span>`
        : `<span class="peer-match-pill">Available</span>`;

    const stageLabel = peer.stage === "final_year" ? "Final Year" : "Class 12th";
    const initials = getInitials(peer.full_name);
    const color = getAvatarColor(peer.full_name, peer.avatar_color);

    return `
      <div class="peer-card ${isStrong ? 'strong-match' : ''}">
        <div class="peer-card-top">
          <div class="peer-header">
            <div class="peer-avatar-initials" style="background-color: ${color};">
              ${initials}
              <span class="peer-status-dot"></span>
            </div>
            <div class="peer-name-group">
              <div class="peer-full-name">${escapeHtml(peer.full_name)}</div>
              <div class="peer-meta-sub">
                <span>@${escapeHtml(peer.username)}</span>
                <span>•</span>
                <span class="peer-stage-tag">${stageLabel}</span>
              </div>
            </div>
          </div>
          ${matchTag}
        </div>

        <div class="peer-detail-line">
          <span class="peer-detail-label">Focus:</span>
          <span class="peer-role-text">${escapeHtml(peer.target_role || "Engineering Track")}</span>
        </div>

        <div class="peer-detail-line">
          <span class="peer-detail-label">Degree:</span>
          <span class="peer-degree-text">${escapeHtml(peer.stream_or_degree || "Technical Sciences")}</span>
        </div>

        <div class="peer-bio-text">
          ${escapeHtml(peer.bio || "Student engineer focused on high-yield software systems and capstone development.")}
        </div>

        <div class="peer-skills-block">
          <div class="peer-skills-header">
            <span>Interests &amp; Skills</span>
            <span style="color: #0f766e;">${peer.overlap_count} matching</span>
          </div>
          <div class="peer-skills-tags">
            ${peer.shared_interests.map(i => `<span class="tag-shared" onclick="filterByInterestTag('${escapeHtml(i)}')" title="Filter by ${escapeHtml(i)}">${escapeHtml(i)}</span>`).join("")}
            ${peer.interests.filter(i => !peer.shared_interests.includes(i)).map(i => `<span class="tag-other" onclick="filterByInterestTag('${escapeHtml(i)}')" title="Filter by ${escapeHtml(i)}">${escapeHtml(i)}</span>`).join("")}
          </div>
        </div>

        <div class="peer-card-actions">
          <button class="btn-secondary" onclick="openPeerModal(${peer.id})">
            View Profile
          </button>
          <button class="btn-primary-action" onclick="handlePeerInviteClick(${peer.id}, '${escapeHtml(peer.username)}')">
            ${ICONS.userPlus}
            <span>Invite</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function filterByInterestTag(tag) {
  const searchInput = document.getElementById("peerSearchInput");
  if (searchInput) {
    searchInput.value = tag;
    const clearBtn = document.getElementById("clearSearchBtn");
    if (clearBtn) clearBtn.style.display = "block";
    refreshPeers();
    showToast(`Filtering by skill: "${tag}"`);
  }
}

function resetPeerFilters() {
  clearSearchInput();
  const stage = document.getElementById("stageFilterSelect");
  const overlap = document.getElementById("overlapFilterSelect");
  if (stage) stage.value = "all";
  if (overlap) overlap.value = "0";
  refreshPeers();
}

// ==========================================
// TAB 2: 4-MEMBER SQUAD WORKSPACE ("RULE OF 4")
// ==========================================
async function loadUserSquad() {
  if (!STATE.token) {
    renderDefaultSquadView();
    return;
  }

  try {
    const res = await fetch("/api/squads/my-squad", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.in_squad && data.squad) {
      STATE.currentSquad = data.squad;
      renderActiveSquadWorkspace(data.squad);
      startChatPolling(data.squad.id);
    } else {
      renderNotInSquadView();
    }
  } catch (err) {
    console.error("Failed to load user squad:", err);
    renderDefaultSquadView();
  }
}

async function renderDefaultSquadView() {
  try {
    const res = await fetch("/api/squads/1");
    if (res.ok) {
      const demoSquad = await res.json();
      renderActiveSquadWorkspace(demoSquad, true);
      startChatPolling(demoSquad.id);
      return;
    }
  } catch (e) {}

  renderNotInSquadView();
}

function renderActiveSquadWorkspace(squad, isDemoPreview = false) {
  const container = document.getElementById("squadViewContainer");
  if (!container) return;

  const currentCount = squad.members.length;
  const maxMembers = squad.max_members || 4;
  const openSeats = squad.open_seats;
  const isFull = currentCount >= maxMembers;

  const statusBadge = isFull
    ? `<span class="squad-status-badge full"><span class="meta-dot green"></span> Squad Full (4/4 Members)</span>`
    : `<span class="squad-status-badge open"><span class="meta-dot amber"></span> ${currentCount}/${maxMembers} Members (${openSeats} Open Seat)</span>`;

  // Build the 4 seat cards
  let seatCardsHtml = "";
  for (let i = 0; i < maxMembers; i++) {
    if (i < currentCount) {
      const member = squad.members[i];
      const isLeader = member.role === "leader";
      const initials = getInitials(member.full_name);
      const color = getAvatarColor(member.full_name, member.avatar_color);

      seatCardsHtml += `
        <div class="member-seat-card ${isLeader ? 'lead' : ''}">
          <div class="seat-role-badge ${isLeader ? 'lead' : 'member'}">
            ${isLeader ? 'Team Lead' : `Teammate #${i + 1}`}
          </div>
          <div class="seat-avatar-row">
            <div class="seat-avatar-circle" style="background-color: ${color};">
              ${initials}
            </div>
            <div>
              <div class="seat-name-text">${escapeHtml(member.full_name)}</div>
              <div class="seat-handle-text">@${escapeHtml(member.username)}</div>
            </div>
          </div>
          <div class="seat-role-focus">${escapeHtml(member.target_role || "Engineering Track")}</div>
          <div class="seat-skills-pills">
            ${(member.interests || []).slice(0, 3).map(sk => `<span class="seat-skill-item">${escapeHtml(sk)}</span>`).join("")}
          </div>
        </div>
      `;
    } else {
      seatCardsHtml += `
        <div class="member-seat-card open" onclick="handleClaimSeatClick('${squad.invite_code}')">
          <div class="open-seat-plus-icon">+</div>
          <div class="open-seat-title">Open Seat #${i + 1}</div>
          <div class="open-seat-sub">Available for matching engineer (&ge; 2 shared skills)</div>
          <button class="btn-claim-pill">Claim Seat</button>
        </div>
      `;
    }
  }

  container.innerHTML = `
    <div class="squad-workspace-layout">
      <!-- Squad Overview Card -->
      <div class="squad-overview-card">
        <div class="squad-top-meta">
          <div>
            <div class="squad-title-row">
              <h2>${escapeHtml(squad.squad_name)}</h2>
              ${statusBadge}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
              <span class="squad-tag-pill">${escapeHtml(squad.track_name)}</span>
              <span class="squad-tag-pill" style="color: #475569; background: #f1f5f9; border-color: #e2e8f0;">
                ${squad.stage === 'final_year' ? 'Final Year' : 'Class 12th'}
              </span>
            </div>
          </div>

          <!-- Invite code & quick share -->
          <div class="squad-invite-block">
            <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Invite Code</span>
            <span class="squad-code-val">${escapeHtml(squad.invite_code)}</span>
            <button class="btn-icon-subtle" onclick="copySquadCode('${escapeHtml(squad.invite_code)}')">
              ${ICONS.copy}
              <span>Copy</span>
            </button>
            <button class="btn-icon-subtle" onclick="copySquadLink('${escapeHtml(squad.invite_code)}')">
              ${ICONS.share}
              <span>Share Link</span>
            </button>
            ${!isDemoPreview ? `
              <button class="btn-icon-subtle" style="color: #dc2626; border-color: #fecaca;" onclick="confirmLeaveSquad(${squad.id})">
                Leave Squad
              </button>
            ` : ''}
          </div>
        </div>

        <div>
          <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; display: flex; justify-content: space-between;">
            <span>4-Member Pod Seats</span>
            <span>${currentCount} of 4 Occupied</span>
          </div>
          <div class="seats-grid">
            ${seatCardsHtml}
          </div>
        </div>
      </div>

      <!-- Split: Objective & Tools / Team Chat -->
      <div class="workspace-split">
        <!-- Sprint Objective & Collaboration Tools -->
        <div class="workspace-card">
          <div class="card-header-clean">
            <div class="card-heading">
              <span>Sprint Objective</span>
            </div>
            <button class="btn-icon-subtle" style="font-size: 11.5px; padding: 4px 8px;" onclick="promptUpdateSprintGoal(${squad.id})">
              Edit Objective
            </button>
          </div>

          <div class="sprint-goal-box">
            <div class="sprint-goal-content" id="sprintGoalText">
              ${escapeHtml(squad.sprint_goal || "Sprint 1: Architecture & API Gateway Scaffold")}
            </div>
          </div>

          <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;">
            Team Workspace Tools
          </div>
          <div class="tools-grid">
            <a href="https://meet.jit.si/FutureEra-${escapeHtml(squad.invite_code)}" target="_blank" class="tool-link-card">
              ${ICONS.video}
              <span>Video Standup</span>
            </a>
            <a href="/console" class="tool-link-card">
              ${ICONS.compass}
              <span>Career Roadmap</span>
            </a>
            <button class="tool-link-card" onclick="exportSquadManifest()">
              ${ICONS.download}
              <span>Export Team JSON</span>
            </button>
          </div>
        </div>

        <!-- Real-Time Team Chat -->
        <div class="workspace-card">
          <div class="card-header-clean">
            <div class="card-heading">
              <span>Team Chat</span>
            </div>
            <span style="font-size: 11px; color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              <span class="meta-dot green"></span> Live
            </span>
          </div>

          <div class="chat-scroll-area" id="squadChatMessages">
            <div style="color: #64748b; font-size: 13px; text-align: center; margin-top: 40px;">
              Loading conversation...
            </div>
          </div>

          <form class="chat-compose-form" onsubmit="handleSendChatMessage(event, ${squad.id})">
            <input type="text" id="squadChatInput" placeholder="Message teammates..." required />
            <button type="submit" class="btn-send-message">
              <span>Send</span>
              ${ICONS.send}
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  fetchChatMessages(squad.id);
}

function renderNotInSquadView() {
  const container = document.getElementById("squadViewContainer");
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; max-width: 580px; margin: 16px auto 30px;">
      <h2 style="font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
        Join or Create a 4-Person Squad
      </h2>
      <p style="font-size: 14px; color: #64748b; line-height: 1.55;">
        FutureEra caps project squads strictly at 4 members. Smaller pods eliminate social loafing, maintain sprint velocity, and ensure every member owns high-yield architecture deliverables.
      </p>
    </div>

    <div class="not-in-squad-state">
      <div class="action-join-card">
        <div class="action-icon-circle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
        </div>
        <h3 class="action-join-title">Join Existing Squad</h3>
        <p class="action-join-desc">
          Have an invite code from a squad leader (e.g. <code>NV-2026</code>)? Enter it to claim an open seat.
        </p>
        <button class="btn btn--solid" style="width: 100%; padding: 10px;" onclick="openJoinSquadModal()">
          Enter Squad Code &rarr;
        </button>
      </div>

      <div class="action-join-card">
        <div class="action-icon-circle" style="background: #f0f9ff; border-color: #bae6fd; color: #0284c7;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M2 12h20"></path>
          </svg>
        </div>
        <h3 class="action-join-title">Form New 4-Person Squad</h3>
        <p class="action-join-desc">
          Start your own squad, select an engineering track, set Sprint 1 goals, and recruit matching peers.
        </p>
        <button class="btn btn--solid" style="width: 100%; padding: 10px; background: #0f766e;" onclick="openCreateSquadModal()">
          Form New Squad &rarr;
        </button>
      </div>
    </div>
  `;
}

// Chat functions
async function fetchChatMessages(squadId) {
  try {
    const res = await fetch(`/api/squads/${squadId}/messages?limit=60`);
    const data = await res.json();
    if (data.success) {
      renderChatMessages(data.messages);
    }
  } catch (err) {
    console.error("Chat fetch error:", err);
  }
}

function renderChatMessages(messages) {
  const container = document.getElementById("squadChatMessages");
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `
      <div style="color: #64748b; font-size: 13px; text-align: center; margin-top: 60px;">
        No messages yet. Send the first update to your squad.
      </div>
    `;
    return;
  }

  const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 40;

  container.innerHTML = messages.map(m => {
    const initials = getInitials(m.sender_name);
    const color = getAvatarColor(m.sender_name, m.sender_avatar_color);

    return `
      <div class="chat-msg-row">
        <div class="chat-sender-avatar" style="background-color: ${color};">
          ${initials}
        </div>
        <div class="chat-msg-bubble">
          <div class="chat-meta-row">
            <span class="chat-sender-name">${escapeHtml(m.sender_name)}</span>
            <span class="chat-timestamp">${formatTime(m.created_at)}</span>
          </div>
          <div class="chat-text">${escapeHtml(m.message)}</div>
        </div>
      </div>
    `;
  }).join("");

  if (isScrolledToBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

async function handleSendChatMessage(e, squadId) {
  e.preventDefault();
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in to participate in squad chat.", "error");
    return;
  }

  const input = document.getElementById("squadChatInput");
  const msg = input.value.trim();
  if (!msg) return;

  input.value = "";
  try {
    const res = await fetch(`/api/squads/${squadId}/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Failed to post message.", "error");
      return;
    }
    fetchChatMessages(squadId);
  } catch (err) {
    showToast("Error sending message.", "error");
  }
}

function startChatPolling(squadId) {
  stopChatPolling();
  STATE.chatPollTimer = setInterval(() => {
    if (STATE.activeTab === "squad") {
      fetchChatMessages(squadId);
    }
  }, 3500);
}

function stopChatPolling() {
  if (STATE.chatPollTimer) {
    clearInterval(STATE.chatPollTimer);
    STATE.chatPollTimer = null;
  }
}

// Squad Actions
async function handleCreateSquadSubmit(e) {
  e.preventDefault();
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in to form a squad.", "error");
    return;
  }

  const squad_name = document.getElementById("squadNameInput").value.trim();
  const track_name = document.getElementById("squadTrackInput").value.trim();
  const stage = document.getElementById("squadStageInput").value;
  const sprint_goal = document.getElementById("squadGoalInput").value.trim();

  try {
    const res = await fetch("/api/squads/create", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ squad_name, track_name, stage, sprint_goal })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Could not create squad.", "error");
      return;
    }

    closeCreateSquadModal();
    showToast(`Squad '${squad_name}' created.`);
    STATE.currentSquad = data.squad;
    if (STATE.currentUser) STATE.currentUser.squad_id = data.squad.id;
    renderActiveSquadWorkspace(data.squad);
    startChatPolling(data.squad.id);
    refreshSquadsDirectory();
  } catch (err) {
    showToast("Network error creating squad.", "error");
  }
}

async function handleJoinSquadSubmit(e) {
  e.preventDefault();
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in before joining a squad.", "error");
    return;
  }

  const invite_code = document.getElementById("joinCodeInput").value.trim().toUpperCase();
  if (!invite_code) return;

  try {
    const res = await fetch("/api/squads/join", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ invite_code })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Failed to join squad.", "error");
      return;
    }

    closeJoinSquadModal();
    showToast(`Joined squad '${data.squad.squad_name}'.`);
    STATE.currentSquad = data.squad;
    if (STATE.currentUser) STATE.currentUser.squad_id = data.squad.id;
    switchCommTab("squad");
    renderActiveSquadWorkspace(data.squad);
    startChatPolling(data.squad.id);
    refreshSquadsDirectory();
  } catch (err) {
    showToast("Network error joining squad.", "error");
  }
}

async function confirmLeaveSquad(squadId) {
  if (!confirm("Are you sure you want to leave this squad?")) return;

  try {
    const res = await fetch(`/api/squads/${squadId}/leave`, {
      method: "POST",
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Failed to leave squad.", "error");
      return;
    }

    showToast("Left squad successfully.");
    STATE.currentSquad = null;
    if (STATE.currentUser) STATE.currentUser.squad_id = null;
    stopChatPolling();
    renderNotInSquadView();
    refreshSquadsDirectory();
  } catch (err) {
    showToast("Error leaving squad.", "error");
  }
}

async function promptUpdateSprintGoal(squadId) {
  const currentGoal = document.getElementById("sprintGoalText")?.textContent?.trim() || "";
  const newGoal = prompt("Enter new sprint objective:", currentGoal);
  if (!newGoal || newGoal === currentGoal) return;

  try {
    const res = await fetch(`/api/squads/${squadId}/sprint-goal`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ message: newGoal })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Failed to update objective.", "error");
      return;
    }

    showToast("Sprint objective updated.");
    const textElem = document.getElementById("sprintGoalText");
    if (textElem) textElem.textContent = newGoal;
  } catch (err) {
    showToast("Error updating sprint objective.", "error");
  }
}

function handleClaimSeatClick(inviteCode) {
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Sign in to claim an open seat.");
    return;
  }
  openJoinSquadModal(inviteCode);
}

function handlePeerInviteClick(peerId, username) {
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Sign in to invite peers.");
    return;
  }
  if (!STATE.currentSquad) {
    showToast(`You must be in a squad to invite @${username}. Create one first.`);
    openCreateSquadModal();
    return;
  }
  if (STATE.currentSquad.open_seats <= 0) {
    showToast("Your squad is already full (4/4 members).", "error");
    return;
  }

  const inviteText = `Hey @${username}! Let's build together on FutureEra. Join my 4-person squad '${STATE.currentSquad.squad_name}' using invite code: ${STATE.currentSquad.invite_code}`;
  navigator.clipboard.writeText(inviteText);
  showToast(`Squad invite copied to clipboard for @${username}.`);
}

function copySquadCode(code) {
  navigator.clipboard.writeText(code);
  showToast(`Invite code '${code}' copied to clipboard.`);
}

function copySquadLink(code) {
  const url = `${window.location.origin}/community?join=${code}`;
  navigator.clipboard.writeText(url);
  showToast("Direct squad join link copied to clipboard.");
}

function exportSquadManifest() {
  if (!STATE.currentSquad) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(STATE.currentSquad, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `futureera-squad-${STATE.currentSquad.invite_code}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Squad manifest downloaded.");
}

// ==========================================
// TAB 3: SQUAD DIRECTORY
// ==========================================
async function refreshSquadsDirectory() {
  try {
    const res = await fetch("/api/squads/all");
    const data = await res.json();
    if (data.success) {
      renderSquadsDirectory(data.squads);
      const badgeElem = document.getElementById("tabSquadBadge");
      const statElem = document.getElementById("statActiveSquads");
      if (badgeElem) badgeElem.textContent = data.squads.length;
      if (statElem) statElem.textContent = data.squads.length;
    }
  } catch (err) {
    console.error("Directory fetch error:", err);
  }
}

function renderSquadsDirectory(squads) {
  const grid = document.getElementById("squadsDirectoryGrid");
  if (!grid) return;

  if (squads.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: #ffffff; border-radius: 14px; border: 1px dashed var(--comm-border);">
        <h3 style="color: #0f172a; font-size: 16px;">No Squads Formed Yet</h3>
        <p style="color: #64748b; font-size: 13.5px; margin-top: 4px;">Be the first! Form a 4-member squad for your capstone.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = squads.map(s => {
    const count = s.current_members_count;
    const max = s.max_members || 4;
    const pct = Math.round((count / max) * 100);
    const isOpen = s.open_seats > 0;

    return `
      <div class="squad-dir-card">
        <div class="squad-dir-top">
          <div>
            <div class="squad-dir-name">${escapeHtml(s.squad_name)}</div>
            <div class="squad-dir-track">${escapeHtml(s.track_name)}</div>
          </div>
          <span style="font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background: #f1f5f9; color: #475569;">
            ${s.stage === 'final_year' ? 'Final Year' : 'Class 12th'}
          </span>
        </div>

        <div style="font-size: 12.5px; color: #64748b; margin: 4px 0 10px;">
          Lead: <strong style="color: #0f172a;">${escapeHtml(s.created_by_username)}</strong>
        </div>

        <div class="seats-progress-bar">
          <div class="seats-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="seats-status-text">
          <span>${count} of ${max} Seats Occupied</span>
          <span style="color: ${isOpen ? '#0f766e' : '#64748b'}; font-weight: 600;">
            ${isOpen ? `${s.open_seats} Open Seat` : 'Full'}
          </span>
        </div>

        <div class="squad-goal-snippet">
          ${escapeHtml(s.sprint_goal || "Sprint 1: Architecture & System Setup")}
        </div>

        <div style="display: flex; gap: 8px; margin-top: auto;">
          <button class="btn-secondary" style="flex: 1; padding: 8px;" onclick="openJoinSquadModal('${s.invite_code}')" ${!isOpen ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
            ${isOpen ? `Claim Open Seat (${s.invite_code})` : 'Squad Full'}
          </button>
          <button class="btn-icon-subtle" onclick="copySquadCode('${s.invite_code}')" title="Copy Code">
            ${ICONS.copy}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// MODAL CONTROLS & PEER PROFILE QUICK-VIEW
// ==========================================
async function openPeerModal(peerId) {
  const modal = document.getElementById("peerModal");
  const content = document.getElementById("peerModalContent");
  if (!modal || !content) return;

  content.innerHTML = `<div style="text-align:center; padding: 40px; color: #94a3b8;">Loading profile...</div>`;
  modal.classList.add("open");

  try {
    const res = await fetch(`/api/community/user/${peerId}`);
    const u = await res.json();
    if (!res.ok) {
      content.innerHTML = `<div style="color: #ef4444;">Could not load profile.</div>`;
      return;
    }

    const stageText = u.stage === "final_year" ? "Final Year Student" : "Class 12th Graduate";
    const initials = getInitials(u.full_name);
    const color = getAvatarColor(u.full_name, u.avatar_color);

    content.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px;">
        <div style="width: 52px; height: 52px; border-radius: 12px; background-color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #ffffff;">
          ${initials}
        </div>
        <div>
          <h2 style="font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.25; margin: 0;">
            ${escapeHtml(u.full_name)}
          </h2>
          <div style="font-size: 13px; color: #64748b; font-weight: 500;">@${escapeHtml(u.username)} • ${stageText}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px;">
        <div style="background: #f8fafc; border: 1px solid var(--comm-border); padding: 10px 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Focus Role</div>
          <div style="font-size: 13px; color: #0284c7; font-weight: 600; margin-top: 2px;">
            ${escapeHtml(u.target_role || "Engineering Track")}
          </div>
        </div>
        <div style="background: #f8fafc; border: 1px solid var(--comm-border); padding: 10px 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Academic Degree</div>
          <div style="font-size: 13px; color: #0f172a; font-weight: 600; margin-top: 2px;">
            ${escapeHtml(u.stream_or_degree || "Technical Sciences")}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Bio</div>
        <p style="font-size: 13.5px; color: #334155; line-height: 1.55; margin: 0;">
          ${escapeHtml(u.bio || "No bio provided.")}
        </p>
      </div>

      <div style="margin-bottom: 22px;">
        <div style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Skills &amp; Interests (${u.interests.length})</div>
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
          ${u.interests.map(i => `<span class="tag-shared" style="cursor: default;">${escapeHtml(i)}</span>`).join("")}
        </div>
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="btn btn--solid" style="flex: 1; padding: 10px; font-size: 13px;" onclick="handlePeerInviteClick(${u.id}, '${escapeHtml(u.username)}')">
          Invite to Squad &rarr;
        </button>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div style="color: #ef4444;">Network error fetching profile.</div>`;
  }
}

function closePeerModal() {
  document.getElementById("peerModal")?.classList.remove("open");
}

function openAuthModal(mode = 'signin') {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  switchAuthTab(mode);
  modal.classList.add("open");
}

function closeAuthModal() {
  document.getElementById("authModal")?.classList.remove("open");
}

function switchAuthTab(tab) {
  const isSignIn = tab === 'signin';
  document.getElementById("authTabSignInBtn")?.classList.toggle("active", isSignIn);
  document.getElementById("authTabSignUpBtn")?.classList.toggle("active", !isSignIn);

  const signInForm = document.getElementById("signInForm");
  const signUpForm = document.getElementById("signUpForm");
  if (signInForm) signInForm.style.display = isSignIn ? "block" : "none";
  if (signUpForm) signUpForm.style.display = isSignIn ? "none" : "block";
}

function openCreateSquadModal() {
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in to form a squad.");
    return;
  }
  document.getElementById("createSquadModal")?.classList.add("open");
}

function closeCreateSquadModal() {
  document.getElementById("createSquadModal")?.classList.remove("open");
}

function openJoinSquadModal(prefillCode = '') {
  const modal = document.getElementById("joinSquadModal");
  if (!modal) return;
  const input = document.getElementById("joinCodeInput");
  if (input && prefillCode) input.value = prefillCode;
  modal.classList.add("open");
}

function closeJoinSquadModal() {
  document.getElementById("joinSquadModal")?.classList.remove("open");
}

function openMyProfileModal() {
  if (STATE.currentUser) {
    openPeerModal(STATE.currentUser.id);
  }
}

// Toast
function showToast(text, type = "success") {
  const toast = document.getElementById("toastNotice");
  const textElem = document.getElementById("toastText");
  const iconElem = document.getElementById("toastIcon");
  if (!toast || !textElem) return;

  textElem.textContent = text;
  if (iconElem) {
    iconElem.innerHTML = type === "error" 
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
      : ICONS.check;
  }

  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

// Helpers
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return "";
  }
}
