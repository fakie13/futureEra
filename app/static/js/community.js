/**
 * FutureEra Community & Project Squad Engine
 * Human-crafted peer matchmaking and 4-member squad collaboration.
 */

// Global State
const STATE = {
  token: localStorage.getItem("fe_session_token") || "",
  currentUser: null,
  allPeers: [],
  userFriends: [],
  friendIds: new Set(),
  guestInterests: ["Coding & Tech", "AI & Machine Learning"],
  currentSquad: null,
  activeTab: "matchmaking",
  chatPollTimer: null,
  regInterests: new Set(),
  activeSkillFilter: "all",
  mentionMatches: [],
  mentionIndex: -1
};

// ==========================================
// SVG ICON HELPERS
// ==========================================
const ICONS = {
  search: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  target: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
  academic: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>`,
  userPlus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>`,
  userCheck: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>`,
  userMinus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="23" y1="11" x2="17" y2="11"></line></svg>`,
  userFriends: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  share: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
  video: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`,
  compass: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  send: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  upload: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
  film: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`,
  image: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
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
    renderLoggedOutSquadView();
    return;
  }

  try {
    const res = await fetch("/api/auth/me", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.authenticated && data.user) {
      STATE.currentUser = data.user;
      renderUserHeaderLoggedIn(data.user);
      await loadUserFriends(false);
      if (data.user.squad_id) {
        if (STATE.activeTab === "squad") {
          loadUserSquad();
        }
      } else {
        renderNotInSquadView();
      }
      if (STATE.activeTab === "friends") {
        renderFriendsList();
      }
    } else {
      logout(false);
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    renderUserHeaderLoggedOut();
    renderLoggedOutSquadView();
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
        ${user.squad_name ? `<span style="font-size: 12.5px; background: #f0fdfa; color: #0f766e; border: 1px solid #ccfbf1; padding: 3px 8px; border-radius: 4px; font-weight: 600;">${escapeHtml(user.squad_name)}</span>` : ''}
      </button>
      <button class="nav-signout-btn" onclick="logout(true)" title="Sign Out">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        <span>Sign Out</span>
      </button>
    </div>
  `;
}

function renderUserHeaderLoggedOut() {
  const container = document.getElementById("userHeaderArea");
  if (!container) return;

  container.innerHTML = `
    <button id="authModalTriggerBtn" class="btn btn--solid" style="padding: 9px 20px; font-size: 14.5px;" onclick="openAuthModal('signin')">
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

    await loadUserFriends(false);
    await refreshPeers();
    if (data.user.squad_id) {
      await loadUserSquad();
    }
    if (STATE.activeTab === "friends") {
      renderFriendsList();
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

    await loadUserFriends(false);
    await refreshPeers();
    if (STATE.activeTab === "friends") {
      renderFriendsList();
    }
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
  STATE.userFriends = [];
  if (STATE.friendIds) STATE.friendIds.clear();
  updateFriendsBadge();
  stopChatPolling();
  localStorage.removeItem("fe_session_token");
  renderUserHeaderLoggedOut();
  renderLoggedOutSquadView();
  if (STATE.activeTab === "friends") {
    renderLoggedOutFriendsView();
  }
  if (showNotice) showToast("Signed out successfully.");
  refreshPeers();
}
window.logout = logout;
window.feGlobalSignOut = logout;

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
    if (!STATE.token || !STATE.currentUser) {
      stopChatPolling();
      renderLoggedOutSquadView();
    } else if (STATE.currentUser.squad_id) {
      loadUserSquad();
    } else {
      stopChatPolling();
      renderNotInSquadView();
    }
  } else {
    stopChatPolling();
  }

  if (tabKey === "directory") {
    refreshSquadsDirectory();
  }

  if (tabKey === "friends") {
    if (!STATE.token || !STATE.currentUser) {
      renderLoggedOutFriendsView();
    } else {
      loadUserFriends(true);
    }
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

  const authParam = urlParams.get("auth");
  if (authParam && ["signin", "signup"].includes(authParam)) {
    openAuthModal(authParam);
  }
}

// ==========================================
// TAB 1: PEER DISCOVERY & MATCHMAKING
// ==========================================
function initRegistrationChips() {
  const chips = document.querySelectorAll("#regInterestChips .skill-pill-btn, #regInterestChips .interest-select-card");
  const counter = document.getElementById("regInterestCounter");

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const val = chip.getAttribute("data-interest");
      if (STATE.regInterests.has(val)) {
        STATE.regInterests.delete(val);
        chip.classList.remove("selected");
        chip.classList.remove("active");
      } else {
        STATE.regInterests.add(val);
        chip.classList.add("selected");
        chip.classList.add("active");
      }
      const count = STATE.regInterests.size;
      if (counter) {
        if (count >= 3) {
          counter.textContent = `✓ ${count} selected • Matching active`;
          counter.style.color = "#0f766e";
        } else {
          counter.textContent = `${count} / 3 selected`;
          counter.style.color = "var(--comm-amber, #f59e0b)";
        }
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
        <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">No Matching Peers Found</h3>
        <p style="font-size: 15px; color: #64748b; max-width: 480px; margin: 0 auto 18px; line-height: 1.55;">
          Try expanding your search terms, selecting "All Academic Stages", or switching to "All Match Levels".
        </p>
        <button class="btn-secondary" style="padding: 9px 18px; font-size: 14px; border-radius: 8px;" onclick="resetPeerFilters()">
          Reset Search Filters
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = peers.map(peer => {
    const stageLabel = peer.stage === "final_year" ? "Final Year" : "Class 12th";
    const initials = getInitials(peer.full_name);
    const color = getAvatarColor(peer.full_name, peer.avatar_color);

    // Teaser: show at most 2 top skills as preview
    const allSkills = (peer.shared_interests && peer.shared_interests.length > 0)
      ? [...peer.shared_interests, ...peer.interests.filter(i => !peer.shared_interests.includes(i))]
      : (peer.interests || []);
    const previewSkills = allSkills.slice(0, 2);
    const extraSkillsCount = Math.max(0, allSkills.length - previewSkills.length);

    const isSelfPeer = (STATE.currentUser && String(STATE.currentUser.id) === String(peer.id)) ||
      (STATE.currentUser && STATE.currentUser.username && peer.username && STATE.currentUser.username.toLowerCase() === peer.username.toLowerCase());

    const peerActionBtn = isSelfPeer
      ? `<button class="btn-secondary" style="color: #0f766e; border-color: #99f6e4; background: #f0fdfa;" onclick="openPeerModal(${peer.id})">Edit Profile</button>`
      : `<button class="btn-primary-action" onclick="handlePeerInviteClick(${peer.id}, '${escapeHtml(peer.username)}')">
           ${ICONS.userPlus}
           <span>Invite</span>
         </button>`;

    return `
      <div class="peer-card">
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
          ${peer.is_strong_match ? `
            <span class="peer-match-pill strong" title="${peer.overlap_count} shared interests">
              <span class="match-indicator-dot"></span>
              <span>Match</span>
            </span>
          ` : (peer.in_squad ? `
            <span class="peer-match-pill" style="color: #0284c7; background: #f0f9ff; border-color: #bae6fd;">
              <span>In Squad</span>
            </span>
          ` : '')}
        </div>

        <div class="peer-focus-row">
          <span class="peer-focus-label">Focus:</span>
          <span class="peer-focus-text">${escapeHtml(peer.target_role || "Engineering Track")}</span>
        </div>

        <div class="peer-teaser-skills">
          ${previewSkills.map(s => `
            <span class="tag-teaser" onclick="filterByInterestTag('${escapeHtml(s)}')" title="Filter by ${escapeHtml(s)}">
              ${escapeHtml(s)}
            </span>
          `).join("")}
          ${extraSkillsCount > 0 ? `
            <span class="tag-more-pill" onclick="openPeerModal(${peer.id})" title="Click to view full skills in profile">
              +${extraSkillsCount} more
            </span>
          ` : ''}
        </div>

        <div class="peer-card-actions">
          <button class="btn-secondary" onclick="openPeerModal(${peer.id})">
            View Profile
          </button>
          ${peerActionBtn}
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
  if (!STATE.token || !STATE.currentUser) {
    stopChatPolling();
    renderLoggedOutSquadView();
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
      STATE.currentSquad = null;
      stopChatPolling();
      renderNotInSquadView();
    }
  } catch (err) {
    console.error("Failed to load user squad:", err);
    STATE.currentSquad = null;
    stopChatPolling();
    renderNotInSquadView();
  }
}

function renderLoggedOutSquadView() {
  stopChatPolling();
  STATE.currentSquad = null;
  const container = document.getElementById("squadViewContainer");
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; max-width: 540px; margin: 36px auto 50px; padding: 40px 32px; background: #ffffff; border: 1.5px solid var(--comm-border); border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);">
      <div style="width: 56px; height: 56px; border-radius: 16px; background: #f0fdfa; border: 1.5px solid #ccfbf1; color: #0f766e; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 18px;">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>

      <h2 style="font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 10px;">
        Squad Workspaces are Private to Teams
      </h2>
      <p style="font-size: 15.5px; color: #64748b; line-height: 1.6; margin: 0 0 24px;">
        Sign in or join FutureEra to access your 4-person squad workspace, track sprint goals, share demo recordings, and collaborate in real-time.
      </p>

      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <button class="btn btn--solid" style="padding: 11px 26px; font-size: 15px;" onclick="openAuthModal('signin')">
          Sign In / Join Squad &rarr;
        </button>
        <button class="btn btn--outline" style="padding: 11px 22px; font-size: 15px;" onclick="switchCommTab('directory')">
          Browse Squad Directory
        </button>
      </div>
    </div>
  `;
}

function renderActiveSquadWorkspace(squad) {
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
            <span style="font-size: 12.5px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Invite Code</span>
            <span class="squad-code-val">${escapeHtml(squad.invite_code)}</span>
            <button class="btn-icon-subtle" onclick="copySquadCode('${escapeHtml(squad.invite_code)}')">
              ${ICONS.copy}
              <span>Copy</span>
            </button>
            <button class="btn-icon-subtle" onclick="copySquadLink('${escapeHtml(squad.invite_code)}')">
              ${ICONS.share}
              <span>Share Link</span>
            </button>
            <button class="btn-icon-subtle" style="color: #dc2626; border-color: #fecaca;" onclick="confirmLeaveSquad(${squad.id})">
              Leave Squad
            </button>
          </div>
        </div>

        <div>
          <div style="font-size: 13.5px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; display: flex; justify-content: space-between;">
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
            <button class="btn-icon-subtle" style="font-size: 13px; padding: 5px 10px;" onclick="promptUpdateSprintGoal(${squad.id})">
              Edit Objective
            </button>
          </div>

          <div class="sprint-goal-box">
            <div class="sprint-goal-content" id="sprintGoalText">
              ${escapeHtml(squad.sprint_goal || "Sprint 1: Architecture & API Gateway Scaffold")}
            </div>
          </div>

          <div style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;">
            Team Workspace Tools
          </div>
          <div class="tools-grid">
            <button type="button" class="tool-link-card" onclick="openProgressUploadModal(${squad.id})" title="Upload project demo video or screenshot (Max 300MB)">
              ${ICONS.upload}
              <span>Upload Progress</span>
            </button>
            <button type="button" class="tool-link-card" onclick="openProgressGalleryModal(${squad.id})" title="View squad progress gallery & media showcase">
              ${ICONS.film}
              <span>Progress Gallery</span>
            </button>
            <a href="/stage" class="tool-link-card" title="Explore stages & architect career roadmap">
              ${ICONS.compass}
              <span>Career Roadmap</span>
            </a>
            <button type="button" class="tool-link-card" onclick="exportSquadManifest()">
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
            <span style="font-size: 12.5px; color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              <span class="meta-dot green"></span> Live
            </span>
          </div>

          <div class="chat-scroll-area" id="squadChatMessages">
            <div style="color: #64748b; font-size: 14.5px; text-align: center; margin-top: 40px;">
              Loading conversation...
            </div>
          </div>

          <form class="chat-compose-form" onsubmit="handleSendChatMessage(event, ${squad.id})">
            <!-- Autocomplete dropdown for @mentions -->
            <div class="mention-dropdown" id="mentionDropdown"></div>

            <button type="button" class="tool-link-card" onclick="openProgressUploadModal(${squad.id})" title="Attach progress image or video (Max 300MB)" style="padding: 0 10px; height: 38px; border-radius: 8px; flex-shrink: 0; background: #f1f5f9; display: flex; align-items: center; justify-content: center; gap: 4px; border: 1px solid var(--comm-border);">
              ${ICONS.upload}
              <span style="font-size: 13px; font-weight: 600;">Media</span>
            </button>
            <input type="text" id="squadChatInput" placeholder="Message teammates (type @ to tag someone)..." autocomplete="off" required oninput="handleChatInput(event, ${squad.id})" onkeydown="handleChatKeyDown(event, ${squad.id})" />
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
      <h2 style="font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 26px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
        Join or Create a 4-Person Squad
      </h2>
      <p style="font-size: 15.5px; color: #64748b; line-height: 1.6;">
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
        <button class="btn btn--solid" style="width: 100%; padding: 11px; font-size: 14.5px;" onclick="openJoinSquadModal()">
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
        <button class="btn btn--solid" style="width: 100%; padding: 11px; font-size: 14.5px; background: #0f766e;" onclick="openCreateSquadModal()">
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
      <div style="color: #64748b; font-size: 14.5px; text-align: center; margin-top: 60px;">
        No messages yet. Send the first update to your squad.
      </div>
    `;
    return;
  }

  const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 40;

  container.innerHTML = messages.map(m => {
    const initials = getInitials(m.sender_name);
    const color = getAvatarColor(m.sender_name, m.sender_avatar_color);

    let mediaSnippet = "";
    if (m.media_url) {
      if (m.media_type === "video") {
        mediaSnippet = `
          <div class="chat-media-card">
            <video src="${escapeHtml(m.media_url)}" controls preload="metadata"></video>
          </div>
        `;
      } else {
        mediaSnippet = `
          <div class="chat-media-card">
            <a href="${escapeHtml(m.media_url)}" target="_blank" rel="noopener noreferrer" title="Click to view full image">
              <img src="${escapeHtml(m.media_url)}" alt="Progress snapshot" loading="lazy" />
            </a>
          </div>
        `;
      }
    }

    const isMentioned = STATE.currentUser && m.message && new RegExp(`@${STATE.currentUser.username}\\b`, "i").test(m.message);
    const bubbleClass = `chat-msg-bubble${isMentioned ? " chat-bubble-mentioned" : ""}`;

    return `
      <div class="chat-msg-row">
        <div class="chat-sender-avatar" style="background-color: ${color};">
          ${initials}
        </div>
        <div class="${bubbleClass}">
          <div class="chat-meta-row">
            <span class="chat-sender-name">${escapeHtml(m.sender_name)}</span>
            <span class="chat-timestamp">${formatTime(m.created_at)}</span>
          </div>
          <div class="chat-text">${formatChatMessage(m.message)}</div>
          ${mediaSnippet}
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
  closeMentionDropdown();
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

// ==========================================
// CHAT MENTIONS & AUTOCOMPLETE ENGINE
// ==========================================
function formatChatMessage(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  // Match @username (letters, digits, underscores, dashes)
  return escaped.replace(/@([a-zA-Z0-9_-]+)/g, (match, username) => {
    const isMe = STATE.currentUser && STATE.currentUser.username.toLowerCase() === username.toLowerCase();
    const cls = isMe ? "chat-mention mention-me" : "chat-mention";
    return `<span class="${cls}" onclick="handleMentionClick('${escapeHtml(username)}')" title="View @${escapeHtml(username)}'s profile">@${username}</span>`;
  });
}

async function handleMentionClick(username) {
  if (!username) return;
  // If in current squad members:
  if (STATE.currentSquad && STATE.currentSquad.members) {
    const m = STATE.currentSquad.members.find(x => x.username.toLowerCase() === username.toLowerCase());
    if (m) {
      openPeerModal(m.user_id);
      return;
    }
  }

  // Lookup user by username from peers search
  try {
    const res = await fetch(`/api/community/peers?search=${encodeURIComponent(username)}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.peers && data.peers.length > 0) {
      const match = data.peers.find(p => p.username.toLowerCase() === username.toLowerCase()) || data.peers[0];
      openPeerModal(match.id);
    } else {
      showToast(`User @${username}`);
    }
  } catch (err) {
    showToast(`User @${username}`);
  }
}

function handleChatInput(e, squadId) {
  const input = e.target;
  const val = input.value;
  const cursor = input.selectionStart;
  const textBeforeCursor = val.slice(0, cursor);

  // Look for @tag right before cursor
  const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  if (!match) {
    closeMentionDropdown();
    return;
  }

  const query = match[1].toLowerCase();
  const members = (STATE.currentSquad && STATE.currentSquad.members) ? STATE.currentSquad.members : [];
  
  // Filter squad members matching query
  const matches = members.filter(m => {
    return m.username.toLowerCase().includes(query) || m.full_name.toLowerCase().includes(query);
  });

  if (matches.length === 0) {
    closeMentionDropdown();
    return;
  }

  STATE.mentionMatches = matches;
  STATE.mentionIndex = 0;
  renderMentionDropdown(matches);
}

function handleChatKeyDown(e, squadId) {
  const dropdown = document.getElementById("mentionDropdown");
  if (!dropdown || !dropdown.classList.contains("open")) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (STATE.mentionMatches && STATE.mentionMatches.length > 0) {
      STATE.mentionIndex = (STATE.mentionIndex + 1) % STATE.mentionMatches.length;
      updateActiveMentionItem();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (STATE.mentionMatches && STATE.mentionMatches.length > 0) {
      STATE.mentionIndex = (STATE.mentionIndex - 1 + STATE.mentionMatches.length) % STATE.mentionMatches.length;
      updateActiveMentionItem();
    }
  } else if (e.key === "Enter" || e.key === "Tab") {
    if (STATE.mentionMatches && STATE.mentionMatches.length > 0) {
      e.preventDefault();
      const selected = STATE.mentionMatches[STATE.mentionIndex] || STATE.mentionMatches[0];
      selectMention(selected.username);
    }
  } else if (e.key === "Escape") {
    closeMentionDropdown();
  }
}

function selectMention(username) {
  const input = document.getElementById("squadChatInput");
  if (!input) return;

  const val = input.value;
  const cursor = input.selectionStart;
  const textBeforeCursor = val.slice(0, cursor);
  const textAfterCursor = val.slice(cursor);

  // Replace @query immediately before cursor with @username + ' '
  const replacedBefore = textBeforeCursor.replace(/(?:^|\s)@([a-zA-Z0-9_-]*)$/, (match) => {
    const leading = match.startsWith(" ") ? " " : "";
    return `${leading}@${username} `;
  });

  input.value = replacedBefore + textAfterCursor;
  const newPos = replacedBefore.length;
  input.focus();
  input.setSelectionRange(newPos, newPos);

  closeMentionDropdown();
}

function renderMentionDropdown(matches) {
  const dropdown = document.getElementById("mentionDropdown");
  if (!dropdown) return;

  dropdown.innerHTML = `
    <div class="mention-dropdown-header">
      <span>Tag Teammate</span>
      <span style="font-size: 11px; font-weight: 500; color: #94a3b8;">Tab or &crarr; to select</span>
    </div>
    <div style="max-height: 180px; overflow-y: auto;">
      ${matches.map((m, idx) => {
        const initials = getInitials(m.full_name);
        const color = getAvatarColor(m.full_name, m.avatar_color);
        const isActive = idx === STATE.mentionIndex;
        return `
          <div class="mention-item ${isActive ? 'active' : ''}" data-idx="${idx}" onclick="selectMention('${escapeHtml(m.username)}')">
            <div class="mention-avatar" style="background-color: ${color};">
              ${initials}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div class="mention-name">${escapeHtml(m.full_name)}</div>
              <div class="mention-username">@${escapeHtml(m.username)}</div>
            </div>
            <span style="font-size: 11px; padding: 2px 7px; border-radius: 999px; background: ${m.role === 'leader' ? '#fef3c7; color: #b45309;' : '#f1f5f9; color: #64748b;'} font-weight: 600;">
              ${m.role === 'leader' ? 'Leader' : 'Pod'}
            </span>
          </div>
        `;
      }).join("")}
    </div>
  `;

  dropdown.classList.add("open");
}

function updateActiveMentionItem() {
  document.querySelectorAll(".mention-item").forEach((item, idx) => {
    item.classList.toggle("active", idx === STATE.mentionIndex);
  });
}

function closeMentionDropdown() {
  const dropdown = document.getElementById("mentionDropdown");
  if (dropdown) dropdown.classList.remove("open");
  STATE.mentionMatches = [];
  STATE.mentionIndex = -1;
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".chat-compose-form")) {
    closeMentionDropdown();
  }
});

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
    showToast(data.message || `Joined squad '${data.squad.squad_name}'.`);
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
  if (STATE.currentSquad || (STATE.currentUser && STATE.currentUser.squad_id)) {
    showToast("You are already in a team.");
    return;
  }
  openJoinSquadModal(inviteCode);
}

function handlePeerInviteClick(peerId, username) {
  if (STATE.currentUser && (
    String(STATE.currentUser.id) === String(peerId) ||
    (STATE.currentUser.username && username && STATE.currentUser.username.toLowerCase() === username.toLowerCase())
  )) {
    showToast("You cannot invite yourself to a squad.", "error");
    return;
  }
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

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
  } catch (e) {
    console.warn("Fallback copy failed:", e);
  }
  document.body.removeChild(ta);
}

function copySquadCode(code) {
  copyToClipboard(code);
  showToast(`Invite code '${code}' copied to clipboard.`);
}

function copySquadLink(code) {
  const url = `${window.location.origin}/community?join=${code}`;
  copyToClipboard(url);
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
        <h3 style="color: #0f172a; font-size: 18px;">No Squads Formed Yet</h3>
        <p style="color: #64748b; font-size: 15px; margin-top: 6px;">Be the first! Form a 4-member squad for your capstone.</p>
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
          <span style="font-size: 12.5px; font-weight: 600; padding: 3px 8px; border-radius: 4px; background: #f1f5f9; color: #475569;">
            ${s.stage === 'final_year' ? 'Final Year' : 'Class 12th'}
          </span>
        </div>

        <div style="font-size: 14px; color: #64748b; margin: 6px 0 12px;">
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
          <button class="btn-secondary" style="flex: 1; padding: 10px 14px; font-size: 14px;" onclick="handleClaimSeatClick('${s.invite_code}')" ${!isOpen ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
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

  content.innerHTML = `<div style="text-align:center; padding: 60px 20px; color: #94a3b8; font-size: 15px;">Loading profile...</div>`;
  modal.classList.add("open");

  try {
    const res = await fetch(`/api/community/user/${peerId}`, {
      headers: getAuthHeaders()
    });
    const u = await res.json();
    if (!res.ok) {
      content.innerHTML = `<div style="color: #ef4444; padding: 40px; text-align: center; font-size: 15px;">Could not load profile.</div>`;
      return;
    }

    const currentId = STATE.currentUser ? String(STATE.currentUser.id) : null;
    const currentUsername = STATE.currentUser && STATE.currentUser.username ? STATE.currentUser.username.trim().toLowerCase() : null;
    const targetId = String(u.id);
    const targetUsername = u.username ? u.username.trim().toLowerCase() : "";

    const isOwnProfile = Boolean(u.is_self) || 
      (currentId && currentId === targetId) || 
      (currentUsername && currentUsername === targetUsername);

    const stageText = u.stage === "final_year" ? "Final Year Student" : "Class 12th Graduate";
    const initials = getInitials(u.full_name);
    const color = getAvatarColor(u.full_name, u.avatar_color);

    if (isOwnProfile) {
      STATE.editingProfile = u;
    }

    let actionsHtml = "";
    if (isOwnProfile) {
      actionsHtml = `
        <div style="display: flex; gap: 12px; width: 100%; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--comm-border);">
          <button type="button" class="btn btn--solid" style="flex: 1; padding: 13px 22px; font-size: 15px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px;" onclick="openEditProfileView()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>Edit Profile</span>
          </button>
          <button type="button" class="btn-secondary" style="padding: 13px 22px; font-size: 15px;" onclick="closePeerModal()">
            Close
          </button>
        </div>
      `;
    } else {
      const isFriend = (STATE.friendIds && STATE.friendIds.has(u.id)) || u.is_friend;
      const friendBtn = isFriend
        ? `<button type="button" id="modalFriendActionBtn" class="btn-remove-friend" style="flex: 1; padding: 13px; font-size: 15px; justify-content: center;" onclick="handleToggleFriendFromModal(${u.id}, '${escapeHtml(u.username)}', true)">
             ${ICONS.userCheck}
             <span>Remove Friend</span>
           </button>`
        : `<button type="button" id="modalFriendActionBtn" class="btn-friend-action" style="flex: 1; padding: 13px; font-size: 15px; justify-content: center;" onclick="handleToggleFriendFromModal(${u.id}, '${escapeHtml(u.username)}', false)">
             ${ICONS.userPlus}
             <span>+ Add Friend</span>
           </button>`;

      actionsHtml = `
        <div style="display: flex; gap: 12px; width: 100%; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--comm-border);">
          ${friendBtn}
          <button class="btn btn--solid" style="flex: 1; padding: 13px; font-size: 15px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px;" onclick="handlePeerInviteClick(${u.id}, '${escapeHtml(u.username)}')">
            <span>Invite to Squad</span>
            <span>&rarr;</span>
          </button>
        </div>
      `;
    }

    content.innerHTML = `
      ${isOwnProfile ? `
        <div style="margin-bottom: 16px;">
          <span class="profile-own-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Your Engineer Profile
          </span>
        </div>
      ` : ''}

      <div style="display: flex; align-items: center; gap: 18px; margin-bottom: 24px;">
        <div style="width: 68px; height: 68px; border-radius: 16px; background-color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; color: #ffffff; flex-shrink: 0; box-shadow: 0 4px 14px rgba(0,0,0,0.12);">
          ${initials}
        </div>
        <div style="flex: 1; min-width: 0;">
          <h2 style="font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 26px; font-weight: 700; color: #0f172a; line-height: 1.2; margin: 0; word-break: break-word;">
            ${escapeHtml(u.full_name)}
          </h2>
          <div style="font-size: 15px; color: #64748b; font-weight: 500; margin-top: 5px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 600; color: #0284c7;">@${escapeHtml(u.username)}</span>
            <span>&bull;</span>
            <span style="background: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 5px; font-size: 13px; font-weight: 600;">${stageText}</span>
            ${u.squad_name ? `<span>&bull;</span> <span style="background: #f0fdfa; color: #0f766e; border: 1px solid #ccfbf1; padding: 2px 8px; border-radius: 5px; font-size: 13px; font-weight: 600;">${escapeHtml(u.squad_name)}</span>` : ''}
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 22px;">
        <div style="background: #f8fafc; border: 1px solid var(--comm-border); padding: 14px 18px; border-radius: 12px;">
          <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Focus / Target Role</div>
          <div style="font-size: 16px; color: #0284c7; font-weight: 700; margin-top: 4px; line-height: 1.3;">
            ${escapeHtml(u.target_role || "Engineering Track")}
          </div>
        </div>
        <div style="background: #f8fafc; border: 1px solid var(--comm-border); padding: 14px 18px; border-radius: 12px;">
          <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Academic Degree / Stream</div>
          <div style="font-size: 16px; color: #0f172a; font-weight: 700; margin-top: 4px; line-height: 1.3;">
            ${escapeHtml(u.stream_or_degree || "Technical Sciences")}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 22px;">
        <div style="font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Bio &amp; Engineering Focus</div>
        <div style="font-size: 15.5px; color: #334155; line-height: 1.65; background: #fbfcfe; padding: 14px 18px; border-radius: 12px; border: 1px solid var(--comm-border);">
          ${escapeHtml(u.bio || "No personal bio provided yet.")}
        </div>
      </div>

      <div style="margin-bottom: 8px;">
        <div style="font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;">
          Skills &amp; Interests (${(u.interests || []).length})
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${(u.interests && u.interests.length > 0)
            ? u.interests.map(i => `<span class="tag-shared" style="cursor: default; padding: 6px 14px; font-size: 13.5px; border-radius: 8px;">${escapeHtml(i)}</span>`).join("")
            : `<span style="color: #94a3b8; font-size: 14px;">No skills added yet.</span>`
          }
        </div>
      </div>

      ${actionsHtml}
    `;
  } catch (err) {
    content.innerHTML = `<div style="color: #ef4444; padding: 40px; text-align: center;">Network error fetching profile.</div>`;
  }
}

function closePeerModal() {
  document.getElementById("peerModal")?.classList.remove("open");
}

function openEditProfileView() {
  const content = document.getElementById("peerModalContent");
  if (!content) return;

  const u = STATE.editingProfile || STATE.currentUser;
  if (!u) return;

  STATE.editSelectedInterests = new Set(u.interests || []);
  STATE.editSelectedColor = u.avatar_color || "#0d9488";

  const colorPalette = [
    { label: "Teal", hex: "#0d9488" },
    { label: "Indigo", hex: "#4f46e5" },
    { label: "Sky", hex: "#0284c7" },
    { label: "Emerald", hex: "#059669" },
    { label: "Violet", hex: "#7c3aed" },
    { label: "Rose", hex: "#e11d48" },
    { label: "Amber", hex: "#d97706" },
    { label: "Slate", hex: "#475569" }
  ];

  const popularInterests = [
    "Coding & Tech", "AI & Machine Learning", "Python", "Full Stack", 
    "Distributed Systems", "Cloud & DevOps", "Next.js", "Docker", 
    "Data Structures", "Cybersecurity", "TypeScript", "Mobile Apps"
  ];

  content.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid var(--comm-border);">
      <div>
        <h2 style="font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 22px; font-weight: 700; color: #0f172a; margin: 0;">
          Edit Profile
        </h2>
        <p style="font-size: 14px; color: #64748b; margin: 3px 0 0 0;">
          Update your public profile details, role focus, academic stage, and skills.
        </p>
      </div>
      <button type="button" class="btn-secondary" style="font-size: 13.5px; padding: 6px 12px;" onclick="openPeerModal(${u.id})">
        &larr; Back
      </button>
    </div>

    <form id="editProfileForm" onsubmit="handleSaveProfile(event)">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 14px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Full Name *</label>
          <input type="text" id="editFullName" class="form-input" value="${escapeHtml(u.full_name || '')}" placeholder="Your full name" required />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Academic Stage *</label>
          <select id="editStage" class="form-select">
            <option value="12th_pass" ${u.stage === "12th_pass" ? "selected" : ""}>Class 12th Graduate</option>
            <option value="final_year" ${u.stage === "final_year" ? "selected" : ""}>Final Year Student</option>
          </select>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 14px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Target / Focus Role</label>
          <input type="text" id="editTargetRole" class="form-input" value="${escapeHtml(u.target_role || '')}" placeholder="e.g. Full Stack Engineer, AI Engineer" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Degree or Stream</label>
          <input type="text" id="editStreamOrDegree" class="form-input" value="${escapeHtml(u.stream_or_degree || '')}" placeholder="e.g. B.Tech Computer Science" />
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label">Bio (Brief Summary)</label>
        <textarea id="editBio" class="form-textarea" rows="3" placeholder="Tell peers about your background, projects, and career goals...">${escapeHtml(u.bio || '')}</textarea>
      </div>

      <!-- Avatar Color Picker -->
      <div class="form-group" style="margin-bottom: 16px;">
        <label class="form-label">Avatar Color</label>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;" id="colorPickerContainer">
          ${colorPalette.map(c => `
            <div 
              class="edit-color-swatch ${c.hex.toLowerCase() === (STATE.editSelectedColor || '').toLowerCase() ? 'active' : ''}" 
              style="background-color: ${c.hex};" 
              title="${c.label}"
              onclick="selectEditColor('${c.hex}', this)"
            ></div>
          `).join("")}
        </div>
      </div>

      <!-- Skills & Interests -->
      <div class="form-group" style="margin-bottom: 20px;">
        <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Skills &amp; Interests (at least 1 required)</span>
          <span style="font-size: 13px; font-weight: 500; color: #64748b;" id="editInterestsCount">${STATE.editSelectedInterests.size} selected</span>
        </label>
        
        <!-- Active Selected Chips -->
        <div id="editSelectedChipsList" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; min-height: 34px;">
          ${renderEditSelectedChips()}
        </div>

        <!-- Add Custom Skill Input -->
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <input type="text" id="newSkillInput" class="form-input" placeholder="Type a skill and click Add..." style="flex: 1;" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomEditSkill();}" />
          <button type="button" class="btn-secondary" style="padding: 0 16px; font-weight: 600;" onclick="addCustomEditSkill()">
            + Add
          </button>
        </div>

        <!-- Suggestions / quick toggles -->
        <div style="font-size: 12.5px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Popular Suggestions</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${popularInterests.map(item => `
            <span 
              class="edit-interest-chip ${STATE.editSelectedInterests.has(item) ? 'selected' : ''}" 
              onclick="toggleEditInterest('${escapeHtml(item)}', this)"
            >
              ${escapeHtml(item)}
            </span>
          `).join("")}
        </div>
      </div>

      <div id="editProfileError" style="color: #ef4444; font-size: 14px; font-weight: 500; margin-bottom: 14px; display: none; padding: 10px; background: #fef2f2; border-radius: 8px; border: 1px solid #fee2e2;"></div>

      <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid var(--comm-border);">
        <button type="button" class="btn-secondary" style="padding: 12px 20px; font-size: 15px;" onclick="openPeerModal(${u.id})">
          Cancel
        </button>
        <button type="submit" id="btnSaveProfile" class="btn btn--solid" style="padding: 12px 24px; font-size: 15px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Save Changes</span>
        </button>
      </div>
    </form>
  `;
}

function selectEditColor(hex, elem) {
  STATE.editSelectedColor = hex;
  document.querySelectorAll(".edit-color-swatch").forEach(el => el.classList.remove("active"));
  if (elem) elem.classList.add("active");
}

function renderEditSelectedChips() {
  if (!STATE.editSelectedInterests || STATE.editSelectedInterests.size === 0) {
    return `<span style="font-size: 13.5px; color: #94a3b8; font-style: italic;">No skills selected yet. Click suggestions or add your own above.</span>`;
  }
  return Array.from(STATE.editSelectedInterests).map(skill => `
    <span class="tag-shared" style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font-size: 13.5px; border-radius: 999px;">
      <span>${escapeHtml(skill)}</span>
      <span style="cursor: pointer; font-size: 15px; line-height: 1; opacity: 0.7; font-weight: bold;" onclick="removeEditInterest('${escapeHtml(skill)}')" title="Remove">&times;</span>
    </span>
  `).join("");
}

function updateEditChipsView() {
  const container = document.getElementById("editSelectedChipsList");
  const countLabel = document.getElementById("editInterestsCount");
  if (container) container.innerHTML = renderEditSelectedChips();
  if (countLabel) countLabel.textContent = `${STATE.editSelectedInterests.size} selected`;
}

function toggleEditInterest(item, elem) {
  if (!STATE.editSelectedInterests) STATE.editSelectedInterests = new Set();
  if (STATE.editSelectedInterests.has(item)) {
    STATE.editSelectedInterests.delete(item);
    if (elem) elem.classList.remove("selected");
  } else {
    STATE.editSelectedInterests.add(item);
    if (elem) elem.classList.add("selected");
  }
  updateEditChipsView();
}

function removeEditInterest(item) {
  if (!STATE.editSelectedInterests) return;
  STATE.editSelectedInterests.delete(item);
  updateEditChipsView();
  document.querySelectorAll(".edit-interest-chip").forEach(el => {
    if (el.textContent.trim() === item) {
      el.classList.remove("selected");
    }
  });
}

function addCustomEditSkill() {
  const input = document.getElementById("newSkillInput");
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  if (!STATE.editSelectedInterests) STATE.editSelectedInterests = new Set();
  STATE.editSelectedInterests.add(val);
  input.value = "";
  updateEditChipsView();
}

async function handleSaveProfile(event) {
  if (event) event.preventDefault();
  const btn = document.getElementById("btnSaveProfile");
  const errDiv = document.getElementById("editProfileError");
  if (errDiv) {
    errDiv.textContent = "";
    errDiv.style.display = "none";
  }

  const fullName = document.getElementById("editFullName")?.value.trim();
  const stage = document.getElementById("editStage")?.value;
  const targetRole = document.getElementById("editTargetRole")?.value.trim();
  const streamOrDegree = document.getElementById("editStreamOrDegree")?.value.trim();
  const bio = document.getElementById("editBio")?.value.trim();
  const avatarColor = STATE.editSelectedColor || (STATE.currentUser && STATE.currentUser.avatar_color) || "#0d9488";

  if (!fullName) {
    if (errDiv) {
      errDiv.textContent = "Full name cannot be empty.";
      errDiv.style.display = "block";
    }
    return;
  }

  const interests = Array.from(STATE.editSelectedInterests || []);
  if (interests.length === 0) {
    if (errDiv) {
      errDiv.textContent = "Please select or add at least 1 skill or interest.";
      errDiv.style.display = "block";
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 6px;">Saving...</span>`;
  }

  try {
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        full_name: fullName,
        stage: stage,
        target_role: targetRole,
        stream_or_degree: streamOrDegree,
        bio: bio,
        interests: interests,
        avatar_color: avatarColor
      })
    });
    const data = await res.json();
    if (!res.ok) {
      if (errDiv) {
        errDiv.textContent = data.detail || data.message || "Failed to update profile.";
        errDiv.style.display = "block";
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Save Changes</span>`;
      }
      return;
    }

    // Success! Update state
    STATE.currentUser = data.user;
    STATE.editingProfile = data.user;
    renderUserHeaderLoggedIn(data.user);
    showToast("Profile updated successfully!");

    // Refresh peer cards and friends
    refreshPeers();
    if (STATE.activeTab === "friends") {
      loadUserFriends(false);
    }

    // Reopen updated profile modal view
    await openPeerModal(data.user.id);
  } catch (err) {
    if (errDiv) {
      errDiv.textContent = "Network error updating profile. Please try again.";
      errDiv.style.display = "block";
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Save Changes</span>`;
    }
  }
}

// ==========================================
// FRIEND MANAGEMENT & NETWORKING HANDLERS
// ==========================================
async function handleToggleFriendFromModal(friendId, username, isAlreadyFriend) {
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Sign in to add friends.");
    return;
  }

  const btn = document.getElementById("modalFriendActionBtn");
  if (btn) btn.disabled = true;

  if (isAlreadyFriend) {
    try {
      const res = await fetch(`/api/friends/${friendId}/remove`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Failed to remove friend.", "error");
        return;
      }
      showToast(`Removed @${username} from your friends.`);
      if (STATE.friendIds) STATE.friendIds.delete(friendId);
      if (STATE.userFriends) {
        STATE.userFriends = STATE.userFriends.filter(f => f.id !== friendId);
      }
      updateFriendsBadge();
      if (btn) {
        btn.className = "btn-friend-action";
        btn.innerHTML = `${ICONS.userPlus} <span>+ Add Friend</span>`;
        btn.onclick = () => handleToggleFriendFromModal(friendId, username, false);
      }
      if (STATE.activeTab === "friends") renderFriendsList();
    } catch (err) {
      showToast("Network error removing friend.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  } else {
    try {
      const res = await fetch("/api/friends/add", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ friend_id: friendId })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Failed to add friend.", "error");
        return;
      }
      showToast(data.message || `Added @${username} to your friends!`);
      if (!STATE.friendIds) STATE.friendIds = new Set();
      STATE.friendIds.add(friendId);
      updateFriendsBadge();
      if (btn) {
        btn.className = "btn-remove-friend";
        btn.innerHTML = `${ICONS.userCheck} <span>Remove Friend</span>`;
        btn.onclick = () => handleToggleFriendFromModal(friendId, username, true);
      }
      loadUserFriends(false);
    } catch (err) {
      showToast("Network error adding friend.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}

async function loadUserFriends(renderIfActive = true) {
  if (!STATE.token || !STATE.currentUser) {
    if (renderIfActive && STATE.activeTab === "friends") {
      renderLoggedOutFriendsView();
    }
    return;
  }

  try {
    const res = await fetch("/api/friends", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      STATE.userFriends = data.friends || [];
      STATE.friendIds = new Set(STATE.userFriends.map(f => f.id));
      updateFriendsBadge();
      if (renderIfActive && STATE.activeTab === "friends") {
        renderFriendsList();
      }
    }
  } catch (err) {
    console.error("Failed to load friends list:", err);
  }
}

function updateFriendsBadge() {
  const badge = document.getElementById("tabFriendsBadge");
  if (!badge) return;
  const count = STATE.userFriends ? STATE.userFriends.length : 0;
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

function renderFriendsList() {
  const grid = document.getElementById("friendsGrid");
  if (!grid) return;

  const friends = STATE.userFriends || [];
  if (friends.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: #ffffff; border-radius: 14px; border: 1px dashed var(--comm-border-strong);">
        <div style="width: 52px; height: 52px; border-radius: 50%; background: #f0fdfa; color: #0f766e; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; font-size: 22px;">
          ${ICONS.userFriends}
        </div>
        <h3 style="font-size: 19px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">No Friends Added Yet</h3>
        <p style="font-size: 14.5px; color: #64748b; max-width: 480px; margin: 0 auto 18px; line-height: 1.55;">
          Add peers by entering their username above, or explore peers in the <strong>Find Peers</strong> tab to grow your circle.
        </p>
        <button class="btn btn--solid" style="padding: 10px 20px; font-size: 14px; border-radius: 8px;" onclick="switchCommTab('matchmaking')">
          Explore Peers &rarr;
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = friends.map(friend => {
    const stageLabel = friend.stage === "final_year" ? "Final Year" : "Class 12th";
    const initials = getInitials(friend.full_name);
    const color = getAvatarColor(friend.full_name, friend.avatar_color);

    const allSkills = friend.interests || [];
    const previewSkills = allSkills.slice(0, 2);
    const extraSkillsCount = Math.max(0, allSkills.length - previewSkills.length);

    return `
      <div class="peer-card">
        <div class="peer-card-top">
          <div class="peer-header">
            <div class="peer-avatar-initials" style="background-color: ${color};">
              ${initials}
              <span class="peer-status-dot"></span>
            </div>
            <div class="peer-name-group">
              <div class="peer-full-name">${escapeHtml(friend.full_name)}</div>
              <div class="peer-meta-sub">
                <span>@${escapeHtml(friend.username)}</span>
                <span>•</span>
                <span class="peer-stage-tag">${stageLabel}</span>
              </div>
            </div>
          </div>
          ${friend.squad_name ? `
            <span class="peer-match-pill" style="color: #0f766e; background: #f0fdfa; border-color: #ccfbf1;">
              ${escapeHtml(friend.squad_name)}
            </span>
          ` : ''}
        </div>

        <div class="peer-focus-row">
          <span class="peer-focus-label">Focus:</span>
          <span class="peer-focus-text">${escapeHtml(friend.target_role || "Engineering Track")}</span>
        </div>

        <div class="peer-teaser-skills">
          ${previewSkills.map(s => `
            <span class="tag-teaser" style="cursor: default;">
              ${escapeHtml(s)}
            </span>
          `).join("")}
          ${extraSkillsCount > 0 ? `
            <span class="tag-more-pill" onclick="openPeerModal(${friend.id})" title="Click to view full skills in profile">
              +${extraSkillsCount} more
            </span>
          ` : ''}
        </div>

        <div class="peer-card-actions">
          <button class="btn-secondary" onclick="openPeerModal(${friend.id})">
            View Profile
          </button>
          <button class="btn-remove-friend" style="padding: 10px 14px;" onclick="handleRemoveFriendFromList(${friend.id}, '${escapeHtml(friend.username)}')" title="Remove from friends">
            ${ICONS.userMinus}
            <span>Remove</span>
          </button>
          <button class="btn-primary-action" onclick="handlePeerInviteClick(${friend.id}, '${escapeHtml(friend.username)}')">
            ${ICONS.userPlus}
            <span>Invite</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderLoggedOutFriendsView() {
  const grid = document.getElementById("friendsGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #ffffff; border-radius: 16px; border: 1px dashed var(--comm-border-strong); max-width: 580px; margin: 20px auto;">
      <div style="width: 56px; height: 56px; border-radius: 50%; background: #f0fdfa; color: #0f766e; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;">
        ${ICONS.userFriends}
      </div>
      <h3 style="font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
        Sign In to View Friends
      </h3>
      <p style="font-size: 15px; color: #64748b; line-height: 1.6; margin: 0 auto 20px;">
        Create your engineer profile or log in to manage your friends list, add classmates by username, and form 4-member project squads.
      </p>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button class="btn btn--solid" style="padding: 11px 24px; font-size: 14.5px;" onclick="openAuthModal('signin')">
          Sign In
        </button>
        <button class="btn btn--outline" style="padding: 11px 24px; font-size: 14.5px;" onclick="openAuthModal('signup')">
          Join Community
        </button>
      </div>
    </div>
  `;
}

async function handleAddFriendSubmit(e) {
  e.preventDefault();
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Sign in to add friends.");
    return;
  }
  const input = document.getElementById("addFriendUsernameInput");
  const username = input?.value.trim();
  if (!username) return;

  const btn = document.getElementById("addFriendSubmitBtn");
  if (btn) btn.disabled = true;

  try {
    const res = await fetch("/api/friends/add", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Failed to add friend.", "error");
      return;
    }
    showToast(data.message || `Added @${username} to your friends!`);
    if (input) input.value = "";
    if (data.friend) {
      if (!STATE.friendIds) STATE.friendIds = new Set();
      STATE.friendIds.add(data.friend.id);
    }
    await loadUserFriends(true);
  } catch (err) {
    showToast("Network error adding friend.", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleRemoveFriendFromList(friendId, username) {
  if (!confirm(`Are you sure you want to remove @${username} from your friend list?`)) return;
  try {
    const res = await fetch(`/api/friends/${friendId}/remove`, {
      method: "POST",
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Failed to remove friend.", "error");
      return;
    }
    showToast(`Removed @${username} from your friends.`);
    if (STATE.friendIds) STATE.friendIds.delete(friendId);
    if (STATE.userFriends) {
      STATE.userFriends = STATE.userFriends.filter(f => f.id !== friendId);
    }
    updateFriendsBadge();
    renderFriendsList();
  } catch (err) {
    showToast("Network error removing friend.", "error");
  }
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

  const modalTitle = document.getElementById("modalAuthTitle");
  const modalSub = document.getElementById("modalAuthSub");
  if (modalTitle) {
    modalTitle.textContent = isSignIn ? "Welcome back" : "Create an account";
  }
  if (modalSub) {
    modalSub.textContent = isSignIn 
      ? "Please enter your details"
      : "Start your journey with student developer squads";
  }
}

function fillModalDemoCredentials() {
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  if (usernameInput) usernameInput.value = "aarav_dev";
  if (passwordInput) passwordInput.value = "Password@123";
  showToast("Loaded Aarav Sharma's credentials (@aarav_dev). Click Sign In!");
}

function toggleModalPasswordView(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
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
  if (STATE.currentSquad || (STATE.currentUser && STATE.currentUser.squad_id)) {
    showToast("You are already in a team.");
    return;
  }
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

// ==========================================
// SQUAD PROGRESS MEDIA UPLOAD & SHOWCASE
// ==========================================
const MAX_PROGRESS_BYTES = 300 * 1024 * 1024; // 300 MB

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function openProgressUploadModal(squadId) {
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in to upload progress.", "error");
    return;
  }
  const squadInput = document.getElementById("progressSquadId");
  if (squadInput) {
    squadInput.value = squadId || (STATE.currentSquad ? STATE.currentSquad.id : "");
  }

  // Clear inputs & errors
  const titleInput = document.getElementById("progressTitleInput");
  if (titleInput) titleInput.value = "";
  
  clearSelectedProgressFile();

  const errEl = document.getElementById("progressFileError");
  if (errEl) {
    errEl.style.display = "none";
    errEl.textContent = "";
  }

  const barContainer = document.getElementById("progressUploadBarContainer");
  if (barContainer) barContainer.style.display = "none";

  const submitBtn = document.getElementById("btnSubmitProgress");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <span>Share with Squad</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
    `;
  }

  document.getElementById("progressUploadModal")?.classList.add("open");
}

function closeProgressUploadModal() {
  document.getElementById("progressUploadModal")?.classList.remove("open");
  clearSelectedProgressFile();
}

function handleProgressFileSelected(e) {
  const file = e.target.files?.[0];
  const errEl = document.getElementById("progressFileError");
  if (!file) {
    clearSelectedProgressFile();
    return;
  }

  // Strict 300 MB limit validation
  if (file.size > MAX_PROGRESS_BYTES) {
    if (errEl) {
      errEl.textContent = `File size (${formatBytes(file.size)}) exceeds the strict 300MB limit. Please choose a file under 300MB.`;
      errEl.style.display = "block";
    }
    showToast(`File exceeds 300MB limit (${formatBytes(file.size)}).`, "error");
    clearSelectedProgressFile();
    return;
  }

  if (errEl) {
    errEl.style.display = "none";
    errEl.textContent = "";
  }

  // Update dropzone UI
  const defaultState = document.getElementById("dropzoneDefaultState");
  const selectedState = document.getElementById("dropzoneSelectedState");
  const nameEl = document.getElementById("selectedFileName");
  const sizeEl = document.getElementById("selectedFileSize");
  const iconEl = document.getElementById("selectedFileIcon");

  if (defaultState) defaultState.style.display = "none";
  if (selectedState) selectedState.style.display = "block";
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = `${formatBytes(file.size)} (Limit: 300MB)`;

  const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi|ogv)$/i.test(file.name);
  if (iconEl) {
    iconEl.innerHTML = isVideo ? ICONS.film : ICONS.image;
    iconEl.style.color = isVideo ? "#6366f1" : "#059669";
    iconEl.style.background = isVideo ? "#eef2ff" : "#ecfdf5";
  }
}

function clearSelectedProgressFile(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const fileInput = document.getElementById("progressFileInput");
  if (fileInput) fileInput.value = "";

  const defaultState = document.getElementById("dropzoneDefaultState");
  const selectedState = document.getElementById("dropzoneSelectedState");
  if (defaultState) defaultState.style.display = "block";
  if (selectedState) selectedState.style.display = "none";

  const errEl = document.getElementById("progressFileError");
  if (errEl) {
    errEl.style.display = "none";
    errEl.textContent = "";
  }
}

function handleProgressUploadSubmit(e) {
  e.preventDefault();
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in to upload progress.", "error");
    return;
  }

  const squadId = document.getElementById("progressSquadId")?.value;
  if (!squadId) {
    showToast("Squad identifier missing.", "error");
    return;
  }

  const fileInput = document.getElementById("progressFileInput");
  const file = fileInput?.files?.[0];
  const errEl = document.getElementById("progressFileError");

  if (!file) {
    if (errEl) {
      errEl.textContent = "Please select an image or video to upload.";
      errEl.style.display = "block";
    }
    return;
  }

  if (file.size > MAX_PROGRESS_BYTES) {
    if (errEl) {
      errEl.textContent = `File exceeds strict 300MB limit (${formatBytes(file.size)}).`;
      errEl.style.display = "block";
    }
    return;
  }

  const title = (document.getElementById("progressTitleInput")?.value || "").trim();

  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);

  const barContainer = document.getElementById("progressUploadBarContainer");
  const progressBar = document.getElementById("uploadProgressBar");
  const percentText = document.getElementById("uploadPercentText");
  const statusText = document.getElementById("uploadStatusText");
  const submitBtn = document.getElementById("btnSubmitProgress");

  if (barContainer) barContainer.style.display = "block";
  if (progressBar) progressBar.style.width = "0%";
  if (percentText) percentText.textContent = "0%";
  if (statusText) statusText.textContent = "Uploading to squad...";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Uploading...</span>`;
  }

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `/api/squads/${squadId}/upload-progress`, true);
  xhr.setRequestHeader("Authorization", `Bearer ${STATE.token}`);
  xhr.setRequestHeader("X-Session-Token", STATE.token);

  xhr.upload.onprogress = (evt) => {
    if (evt.lengthComputable) {
      const pct = Math.round((evt.loaded / evt.total) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (percentText) percentText.textContent = `${pct}%`;
      if (pct >= 100 && statusText) {
        statusText.textContent = "Processing & saving artifact...";
      }
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      showToast("Progress artifact shared with squad!", "success");
      closeProgressUploadModal();
      fetchChatMessages(squadId);
    } else {
      let errorMsg = "Upload failed.";
      try {
        const res = JSON.parse(xhr.responseText);
        if (res.detail) errorMsg = res.detail;
      } catch (err) {}
      if (errEl) {
        errEl.textContent = errorMsg;
        errEl.style.display = "block";
      }
      showToast(errorMsg, "error");
      if (barContainer) barContainer.style.display = "none";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <span>Share with Squad</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        `;
      }
    }
  };

  xhr.onerror = () => {
    showToast("Network error during file upload.", "error");
    if (barContainer) barContainer.style.display = "none";
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Share with Squad</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      `;
    }
  };

  xhr.send(formData);
}

async function openProgressGalleryModal(squadId) {
  const targetSquadId = squadId || (STATE.currentSquad ? STATE.currentSquad.id : null);
  if (!targetSquadId) {
    showToast("No active squad selected.");
    return;
  }

  const modal = document.getElementById("progressGalleryModal");
  if (!modal) return;
  modal.classList.add("open");

  const container = document.getElementById("progressGalleryContainer");
  if (!container) return;
  container.innerHTML = `<div style="text-align: center; color: #64748b; padding: 40px 0;">Loading squad progress reel...</div>`;

  try {
    const res = await fetch(`/api/squads/${targetSquadId}/progress`);
    const data = await res.json();
    if (!data.success || !data.uploads || data.uploads.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 50px 20px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: #f1f5f9; color: #94a3b8; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
            ${ICONS.film}
          </div>
          <h4 style="font-size: 17px; font-weight: 600; color: #1e293b; margin: 0 0 6px;">No Progress Artifacts Yet</h4>
          <p style="font-size: 14.5px; color: #64748b; margin: 0 0 18px;">
            Share your latest architecture diagram, UI screenshot, or demo screen recording.
          </p>
          <button type="button" class="btn btn--solid" style="padding: 10px 20px; font-size: 14px;" onclick="switchFromGalleryToUpload()">
            Upload First Progress Artifact &rarr;
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="progress-gallery-grid">
        ${data.uploads.map(item => {
          const isVideo = item.file_type === "video";
          const mediaHtml = isVideo
            ? `<video src="${escapeHtml(item.file_url)}" controls preload="metadata"></video>`
            : `<a href="${escapeHtml(item.file_url)}" target="_blank" rel="noopener noreferrer" title="Click to view full image" style="width: 100%; height: 100%; display: block;"><img src="${escapeHtml(item.file_url)}" alt="Progress snapshot" loading="lazy" /></a>`;

          return `
            <div class="progress-gallery-card">
              <div class="progress-media-thumb">
                ${mediaHtml}
              </div>
              <div class="progress-card-info">
                <div style="font-weight: 600; font-size: 15px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(item.title || item.original_filename)}">
                  ${escapeHtml(item.title || item.original_filename)}
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #64748b;">
                  <span style="font-weight: 500;">By ${escapeHtml(item.full_name || item.username)}</span>
                  <span>${formatBytes(item.file_size)}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-top: 3px;">
                  <span class="progress-limit-badge" style="font-size: 11.5px; padding: 2px 7px;">
                    ${isVideo ? "VIDEO DEMO" : "SCREENSHOT"}
                  </span>
                  <span>${formatTime(item.created_at)}</span>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } catch (err) {
    console.error("Gallery fetch error:", err);
    container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 30px;">Failed to load progress uploads.</div>`;
  }
}

function closeProgressGalleryModal() {
  document.getElementById("progressGalleryModal")?.classList.remove("open");
}

function switchFromGalleryToUpload() {
  closeProgressGalleryModal();
  if (STATE.currentSquad) {
    openProgressUploadModal(STATE.currentSquad.id);
  } else {
    openProgressUploadModal();
  }
}

