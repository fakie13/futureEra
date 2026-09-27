/**
 * FutureEra Community & 4-Member Squad War Room
 * High-performance peer matchmaking and pod collaboration engine.
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
  regInterests: new Set()
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  initSimulatorChips();
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

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <button class="user-pill-btn" onclick="openMyProfileModal()">
        <div class="user-avatar-sm" style="background-color: ${user.avatar_color || '#0d9488'};">
          ${user.avatar_emoji || '🚀'}
        </div>
        <span>${escapeHtml(user.full_name.split(' ')[0])}</span>
        ${user.squad_name ? `<span style="font-size: 11px; background: rgba(20,184,166,0.2); color: #2dd4bf; padding: 2px 6px; border-radius: 4px;">🛡️ ${escapeHtml(user.squad_name)}</span>` : ''}
      </button>
      <button class="btn-peer-view" style="padding: 7px 12px; font-size: 12px; border-radius: 999px;" onclick="logout(true)" title="Sign Out">
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
      showToast(data.detail || "Sign-in failed. Please check credentials.", "⚠️");
      return;
    }

    STATE.token = data.token;
    STATE.currentUser = data.user;
    localStorage.setItem("fe_session_token", data.token);

    closeAuthModal();
    renderUserHeaderLoggedIn(data.user);
    showToast(`Welcome back, ${data.user.full_name}!`, "🎉");

    await refreshPeers();
    if (data.user.squad_id) {
      await loadUserSquad();
    }
  } catch (err) {
    showToast("Network error. Please try again.", "⚠️");
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
    showToast("Please choose at least 3 core interests to enable matchmaking.", "⚠️");
    return;
  }

  const avatar_colors = ["#0d9488", "#8b5cf6", "#ef4444", "#f59e0b", "#06b6d4", "#10b981", "#ec4899"];
  const avatar_emojis = ["🚀", "💻", "🧠", "🛡️", "🎨", "🤖", "⚡", "🔬"];
  const randomColor = avatar_colors[Math.floor(Math.random() * avatar_colors.length)];
  const randomEmoji = avatar_emojis[Math.floor(Math.random() * avatar_emojis.length)];

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
        avatar_color: randomColor,
        avatar_emoji: randomEmoji
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.detail || "Registration failed.", "⚠️");
      return;
    }

    STATE.token = data.token;
    STATE.currentUser = data.user;
    localStorage.setItem("fe_session_token", data.token);

    closeAuthModal();
    renderUserHeaderLoggedIn(data.user);
    showToast(`Account created! Welcome, ${data.user.full_name}!`, "🎉");

    await refreshPeers();
  } catch (err) {
    showToast("Network error during registration.", "⚠️");
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
  if (showNotice) showToast("Signed out successfully.", "👋");
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
      // Show default preview or prompt
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
}

// ==========================================
// TAB 1: PEER MATCHMAKING ENGINE
// ==========================================
function initSimulatorChips() {
  const chips = document.querySelectorAll("#simInterestChips .interest-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const val = chip.getAttribute("data-interest");
      chip.classList.toggle("selected");
      if (chip.classList.contains("selected")) {
        if (!STATE.guestInterests.includes(val)) STATE.guestInterests.push(val);
      } else {
        STATE.guestInterests = STATE.guestInterests.filter(i => i !== val);
      }
      refreshPeers();
    });
  });
}

function initRegistrationChips() {
  const chips = document.querySelectorAll("#regInterestChips .interest-chip");
  const counter = document.getElementById("regInterestCounter");

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const val = chip.getAttribute("data-interest");
      if (STATE.regInterests.has(val)) {
        STATE.regInterests.delete(val);
        chip.classList.remove("selected");
      } else {
        STATE.regInterests.add(val);
        chip.classList.add("selected");
      }
      const count = STATE.regInterests.size;
      if (counter) {
        counter.textContent = `${count}/3 required`;
        counter.style.color = count >= 3 ? "#2dd4bf" : "#f59e0b";
      }
    });
  });
}

async function refreshPeers() {
  const search = document.getElementById("peerSearchInput")?.value || "";
  const stage = document.getElementById("stageFilterSelect")?.value || "all";
  const minOverlap = parseInt(document.getElementById("overlapFilterSelect")?.value || "0", 10);

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
  if (totalElem) totalElem.textContent = `${peers.length} Active`;
  if (badgeElem) badgeElem.textContent = peers.length;
}

function renderPeers(peers) {
  const grid = document.getElementById("peersGrid");
  if (!grid) return;

  if (peers.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #ffffff; border-radius: 18px; border: 1.5px dashed #cbd5e1; box-shadow: 0 4px 15px rgba(15,23,42,0.03);">
        <div style="font-size: 38px; margin-bottom: 12px;">🔍</div>
        <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">No Matching Peers Found</h3>
        <p style="font-size: 14px; color: #64748b; max-width: 480px; margin: 0 auto 16px;">
          Try adjusting your search criteria, switching stages, or picking more interest tags above to expand candidate overlap.
        </p>
        <button class="btn btn--solid" style="padding: 8px 18px; font-size: 13px;" onclick="resetPeerFilters()">
          Reset Search Filters
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = peers.map(peer => {
    const isStrong = peer.is_strong_match;
    const matchTag = isStrong
      ? `<div class="match-banner-tag strong">🔥 ${peer.match_percentage}% Match (${peer.overlap_count} Shared)</div>`
      : peer.overlap_count > 0
        ? `<div class="match-banner-tag partial">🌱 ${peer.match_percentage}% Match (1 Shared)</div>`
        : `<div class="match-banner-tag partial">✨ Available Peer</div>`;

    const stageLabel = peer.stage === "final_year" ? "🎓 Final Year" : "🎒 12th Pass";

    return `
      <div class="peer-card ${isStrong ? 'strong-match' : ''}">
        ${matchTag}
        
        <div class="peer-header">
          <div class="peer-avatar" style="background-color: ${peer.avatar_color || '#0d9488'};">
            ${peer.avatar_emoji || '🚀'}
          </div>
          <div>
            <div class="peer-info-title">${escapeHtml(peer.full_name)}</div>
            <div class="peer-username">@${escapeHtml(peer.username)}</div>
            <span class="peer-stage-badge">${stageLabel}</span>
          </div>
        </div>

        <div class="peer-target-role">
          <span>🎯</span> ${escapeHtml(peer.target_role || "Engineering Track")}
        </div>
        <div class="peer-degree">
          <span>📚</span> ${escapeHtml(peer.stream_or_degree || "Technical Sciences")}
        </div>

        <div class="peer-bio">
          ${escapeHtml(peer.bio || "Student engineer focused on high-yield software systems and capstone development.")}
        </div>

        <div class="shared-interests-block">
          <div class="shared-interests-label">
            <span>✨</span> Intersecting Interests (${peer.overlap_count})
          </div>
          <div class="shared-interests-tags">
            ${peer.shared_interests.map(i => `<span class="shared-tag">${escapeHtml(i)}</span>`).join("")}
            ${peer.interests.filter(i => !peer.shared_interests.includes(i)).map(i => `<span class="other-tag">${escapeHtml(i)}</span>`).join("")}
          </div>
        </div>

        <div class="peer-card-actions">
          <button class="btn-peer-view" onclick="openPeerModal(${peer.id})">
            View Profile
          </button>
          <button class="btn-peer-invite" onclick="handlePeerInviteClick(${peer.id}, '${escapeHtml(peer.username)}')">
            <span>🤝</span> Connect / Invite
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function resetPeerFilters() {
  const search = document.getElementById("peerSearchInput");
  const stage = document.getElementById("stageFilterSelect");
  const overlap = document.getElementById("overlapFilterSelect");
  if (search) search.value = "";
  if (stage) stage.value = "all";
  if (overlap) overlap.value = "0";
  refreshPeers();
}

// ==========================================
// TAB 2: 4-MEMBER SQUAD WAR ROOM ("RULE OF 4")
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
      renderActiveSquadWarRoom(data.squad);
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
  // Try to load Squad 1 (Neural Vanguard) as a public live demo war room if user not signed in
  try {
    const res = await fetch("/api/squads/1");
    if (res.ok) {
      const demoSquad = await res.json();
      renderActiveSquadWarRoom(demoSquad, true);
      startChatPolling(demoSquad.id);
      return;
    }
  } catch (e) {}

  renderNotInSquadView();
}

function renderActiveSquadWarRoom(squad, isDemoPreview = false) {
  const container = document.getElementById("squadViewContainer");
  if (!container) return;

  const currentCount = squad.members.length;
  const maxMembers = squad.max_members || 4;
  const openSeats = squad.open_seats;
  const isFull = currentCount >= maxMembers;

  const statusBadge = isFull
    ? `<span style="font-size: 12px; font-weight: 800; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(16, 185, 129, 0.35);">🟢 4/4 Squad Ready & Locked</span>`
    : `<span style="font-size: 12px; font-weight: 800; background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(245, 158, 11, 0.35); animation: pulse 2s infinite;">🟡 ${currentCount}/${maxMembers} Members (${openSeats} Open Seat remaining)</span>`;

  // Build the 4 seat cards (Rule of 4)
  let seatCardsHtml = "";
  for (let i = 0; i < maxMembers; i++) {
    if (i < currentCount) {
      const member = squad.members[i];
      const isLeader = member.role === "leader";
      seatCardsHtml += `
        <div class="seat-card ${isLeader ? 'leader' : ''}">
          <div class="seat-role-pill ${isLeader ? 'leader' : 'member'}">
            ${isLeader ? '👑 Squad Leader' : `⚡ Member Seat #${i + 1}`}
          </div>
          <div class="seat-avatar" style="background-color: ${member.avatar_color || '#0d9488'};">
            ${member.avatar_emoji || '🚀'}
          </div>
          <div class="seat-name">${escapeHtml(member.full_name)}</div>
          <div class="seat-user-tag">@${escapeHtml(member.username)}</div>
          <div class="seat-role-desc">${escapeHtml(member.target_role || "Full Stack Engineer")}</div>
          <div class="seat-skills-list">
            ${(member.interests || []).slice(0, 3).map(sk => `<span class="seat-skill-tag">${escapeHtml(sk)}</span>`).join("")}
          </div>
        </div>
      `;
    } else {
      // Empty / Open Seat
      seatCardsHtml += `
        <div class="seat-card open-seat" onclick="handleClaimSeatClick('${squad.invite_code}')">
          <div class="open-seat-icon">+</div>
          <div class="open-seat-title">Open Seat #${i + 1}</div>
          <div class="open-seat-desc">Waiting for a matching engineer (&ge; 2 shared interests)</div>
          <button class="btn-claim-seat">Claim Open Seat</button>
        </div>
      `;
    }
  }

  container.innerHTML = `
    <div class="squad-war-room-container">
      <!-- Squad Header Card -->
      <div class="squad-header-card">
        <div class="squad-header-top">
          <div class="squad-title-group">
            <h2>
              <span>🛡️</span> ${escapeHtml(squad.squad_name)}
              ${statusBadge}
            </h2>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
              <span class="squad-track-badge">🎯 ${escapeHtml(squad.track_name)}</span>
              <span class="squad-track-badge" style="color: #475569; background: #f1f5f9; border-color: #e2e8f0;">
                🎓 ${squad.stage === 'final_year' ? 'Final Year' : '12th Pass'}
              </span>
            </div>
          </div>

          <!-- Squad Invite Code Banner -->
          <div class="squad-invite-banner">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Invite Code (Max 4 Members)</div>
              <div class="invite-code-pill">${escapeHtml(squad.invite_code)}</div>
            </div>
            <button class="btn-copy-code" onclick="copySquadCode('${escapeHtml(squad.invite_code)}')">
              <span>📋</span> Copy Code
            </button>
            <button class="btn-copy-code" onclick="copySquadLink('${escapeHtml(squad.invite_code)}')">
              <span>🔗</span> Share Link
            </button>
            ${!isDemoPreview ? `
              <button class="btn-peer-view" style="color: #f87171; border-color: rgba(239,68,68,0.3);" onclick="confirmLeaveSquad(${squad.id})">
                Leave Squad
              </button>
            ` : ''}
          </div>
        </div>

        <!-- 4 Visual Seats (Rule of 4) -->
        <div>
          <div style="font-size: 12.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
            <span>The 4-Member Pod Seats (Rule of 4)</span>
            <span>${currentCount} of 4 Occupied</span>
          </div>
          <div class="pod-grid">
            ${seatCardsHtml}
          </div>
        </div>
      </div>

      <!-- Sprint Objective & War Room Chat Workspace -->
      <div class="squad-workspace-grid">
        <!-- Sprint Objective & Collaboration Tools -->
        <div class="war-room-panel">
          <div class="panel-header">
            <div class="panel-title">
              <span>🎯</span> Active Sprint Goal
            </div>
            <button class="btn-peer-view" style="padding: 5px 12px; font-size: 12px;" onclick="promptUpdateSprintGoal(${squad.id})">
              Edit Goal
            </button>
          </div>

          <div class="sprint-goal-display">
            <div class="sprint-goal-text" id="sprintGoalText">
              ${escapeHtml(squad.sprint_goal || "Sprint 1: Architecture & System Setup")}
            </div>
          </div>

          <div style="font-size: 12.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
            Rapid Collaboration Tools
          </div>
          <div class="collaboration-actions">
            <a href="https://meet.jit.si/FutureEra-${escapeHtml(squad.invite_code)}" target="_blank" class="collab-btn">
              <span style="font-size: 20px;">📹</span>
              <span>Live Video Standup</span>
            </a>
            <a href="/console" class="collab-btn">
              <span style="font-size: 20px;">📐</span>
              <span>Career Console</span>
            </a>
            <button class="collab-btn" onclick="exportSquadManifest()">
              <span style="font-size: 20px;">📦</span>
              <span>Export Manifest</span>
            </button>
          </div>
        </div>

        <!-- In-App Real-Time War Room Chat -->
        <div class="war-room-panel">
          <div class="panel-header">
            <div class="panel-title">
              <span>💬</span> Squad War Room Chat
            </div>
            <span style="font-size: 11px; color: #10b981; font-weight: 700; display: flex; align-items: center; gap: 4px;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span> Live
            </span>
          </div>

          <div class="chat-messages-container" id="squadChatMessages">
            <div style="color: #64748b; font-size: 13px; text-align: center; margin-top: 40px;">
              Loading conversation history...
            </div>
          </div>

          <form class="chat-input-bar" onsubmit="handleSendChatMessage(event, ${squad.id})">
            <input type="text" id="squadChatInput" placeholder="Message squad teammates..." required />
            <button type="submit" class="btn-send-chat">Send</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Fetch initial chat messages
  fetchChatMessages(squad.id);
}

function renderNotInSquadView() {
  const container = document.getElementById("squadViewContainer");
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; max-width: 640px; margin: 20px auto 36px;">
      <h2 style="font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
        Join or Form a 4-Member Squad
      </h2>
      <p style="font-size: 15px; color: #475569; line-height: 1.6;">
        FutureEra limits squads strictly to 4 members. Research proves 4-person engineering pods execute with the highest velocity, zero bystander effect, and equal project ownership.
      </p>
    </div>

    <div class="not-in-squad-state">
      <div class="action-join-card">
        <div class="action-join-icon">🔑</div>
        <h3 class="action-join-title">Join Existing Squad</h3>
        <p class="action-join-desc">
          Have an invite code from a squad leader (e.g. <code>NV-2026</code>)? Enter it to claim an open seat immediately.
        </p>
        <button class="btn btn--solid" style="width: 100%; padding: 12px;" onclick="openJoinSquadModal()">
          Enter Squad Code &rarr;
        </button>
      </div>

      <div class="action-join-card">
        <div class="action-join-icon" style="background: rgba(99, 102, 241, 0.12); border-color: rgba(99, 102, 241, 0.3); color: #818cf8;">🚀</div>
        <h3 class="action-join-title">Create New 4-Person Squad</h3>
        <p class="action-join-desc">
          Start your own squad, select an engineering track, set Sprint 1 goals, and recruit matching peers.
        </p>
        <button class="btn btn--solid" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #6366f1 0%, #0d9488 100%);" onclick="openCreateSquadModal()">
          Form a New Squad &rarr;
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
        No messages yet. Send the first message to your squad!
      </div>
    `;
    return;
  }

  const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 40;

  container.innerHTML = messages.map(m => `
    <div class="chat-msg-row">
      <div class="chat-msg-avatar" style="background-color: ${m.sender_avatar_color || '#0d9488'};">
        ${m.sender_avatar_emoji || '🚀'}
      </div>
      <div class="chat-msg-content">
        <div class="chat-msg-header">
          <span class="chat-msg-sender">${escapeHtml(m.sender_name)}</span>
          <span class="chat-msg-time">${formatTime(m.created_at)}</span>
        </div>
        <div class="chat-msg-body">${escapeHtml(m.message)}</div>
      </div>
    </div>
  `).join("");

  if (isScrolledToBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

async function handleSendChatMessage(e, squadId) {
  e.preventDefault();
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in to participate in squad chat.", "🔒");
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
      showToast(data.detail || "Failed to post message.", "⚠️");
      return;
    }
    fetchChatMessages(squadId);
  } catch (err) {
    showToast("Error sending message.", "⚠️");
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
    showToast("Please sign in to create a squad.", "🔒");
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
      showToast(data.detail || "Could not create squad.", "⚠️");
      return;
    }

    closeCreateSquadModal();
    showToast(`Squad '${squad_name}' created!`, "🚀");
    STATE.currentSquad = data.squad;
    if (STATE.currentUser) STATE.currentUser.squad_id = data.squad.id;
    renderActiveSquadWarRoom(data.squad);
    startChatPolling(data.squad.id);
    refreshSquadsDirectory();
  } catch (err) {
    showToast("Network error creating squad.", "⚠️");
  }
}

async function handleJoinSquadSubmit(e) {
  e.preventDefault();
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in before joining a squad.", "🔒");
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
      showToast(data.detail || "Failed to join squad.", "⚠️");
      return;
    }

    closeJoinSquadModal();
    showToast(`Joined squad '${data.squad.squad_name}'!`, "🎉");
    STATE.currentSquad = data.squad;
    if (STATE.currentUser) STATE.currentUser.squad_id = data.squad.id;
    switchCommTab("squad");
    renderActiveSquadWarRoom(data.squad);
    startChatPolling(data.squad.id);
    refreshSquadsDirectory();
  } catch (err) {
    showToast("Network error joining squad.", "⚠️");
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
      showToast(data.detail || "Failed to leave squad.", "⚠️");
      return;
    }

    showToast("Left squad successfully.", "👋");
    STATE.currentSquad = null;
    if (STATE.currentUser) STATE.currentUser.squad_id = null;
    stopChatPolling();
    renderNotInSquadView();
    refreshSquadsDirectory();
  } catch (err) {
    showToast("Error leaving squad.", "⚠️");
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
      showToast(data.detail || "Failed to update sprint goal.", "⚠️");
      return;
    }

    showToast("Sprint goal updated!", "🎯");
    const textElem = document.getElementById("sprintGoalText");
    if (textElem) textElem.textContent = newGoal;
  } catch (err) {
    showToast("Error updating sprint goal.", "⚠️");
  }
}

function handleClaimSeatClick(inviteCode) {
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Sign in to claim this seat.", "🔒");
    return;
  }
  openJoinSquadModal(inviteCode);
}

function handlePeerInviteClick(peerId, username) {
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Sign in to invite peers.", "🔒");
    return;
  }
  if (!STATE.currentSquad) {
    showToast(`You must be in a squad to invite @${username}. Create one first!`, "💡");
    openCreateSquadModal();
    return;
  }
  if (STATE.currentSquad.open_seats <= 0) {
    showToast("Your squad is already full (4/4 members).", "⚠️");
    return;
  }

  // Copy squad invite text
  const inviteText = `Hey @${username}! Let's build together on FutureEra. Join my 4-person squad '${STATE.currentSquad.squad_name}' using invite code: ${STATE.currentSquad.invite_code}`;
  navigator.clipboard.writeText(inviteText);
  showToast(`Invite copied to clipboard for @${username}!`, "📋");
}

function copySquadCode(code) {
  navigator.clipboard.writeText(code);
  showToast(`Invite Code '${code}' copied to clipboard!`, "📋");
}

function copySquadLink(code) {
  const url = `${window.location.origin}/community?join=${code}`;
  navigator.clipboard.writeText(url);
  showToast("Direct squad join link copied to clipboard!", "🔗");
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
  showToast("Squad Manifest downloaded!", "📦");
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
      if (statElem) statElem.textContent = `${data.squads.length} Active`;
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
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px;">
        <h3 style="color: #0f172a;">No squads formed yet</h3>
        <p style="color: #64748b;">Be the pioneer! Form the very first 4-member squad.</p>
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
        <div class="squad-dir-header">
          <div>
            <div class="squad-dir-name">${escapeHtml(s.squad_name)}</div>
            <div style="font-size: 13px; color: var(--comm-sky); font-weight: 700; margin-top: 2px;">
              🎯 ${escapeHtml(s.track_name)}
            </div>
          </div>
          <span style="font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 6px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
            ${s.stage === 'final_year' ? 'Final Year' : '12th Pass'}
          </span>
        </div>

        <div style="font-size: 13px; color: #64748b; margin: 8px 0;">
          👑 Leader: <strong>${escapeHtml(s.created_by_username)}</strong>
        </div>

        <div class="seats-progress-bar">
          <div class="seats-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="seats-status-text">
          <span>${count} / ${max} Seats Filled</span>
          <span style="color: ${isOpen ? 'var(--comm-teal)' : '#64748b'}; font-weight: 700;">
            ${isOpen ? `⚡ ${s.open_seats} Open Seat` : '🔒 Pod Full'}
          </span>
        </div>

        <div style="font-size: 13px; color: #78350f; background: #fffbeb; padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; border-left: 3px solid #b45309;">
          ${escapeHtml(s.sprint_goal || "Sprint 1: Architecture & System Setup")}
        </div>

        <div style="display: flex; gap: 8px; margin-top: auto;">
          <button class="btn btn--solid" style="flex: 1; padding: 9px; font-size: 12.5px;" onclick="openJoinSquadModal('${s.invite_code}')" ${!isOpen ? 'disabled style="opacity: 0.5;"' : ''}>
            ${isOpen ? `Claim Open Seat (${s.invite_code})` : 'Squad Full'}
          </button>
          <button class="btn-peer-view" style="padding: 9px 12px;" onclick="copySquadCode('${s.invite_code}')" title="Copy Code">
            📋
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

  content.innerHTML = `<div style="text-align:center; padding: 40px; color: #94a3b8;">Loading engineer profile...</div>`;
  modal.classList.add("open");

  try {
    const res = await fetch(`/api/community/user/${peerId}`);
    const u = await res.json();
    if (!res.ok) {
      content.innerHTML = `<div style="color: #f87171;">Could not load profile.</div>`;
      return;
    }

    const stageText = u.stage === "final_year" ? "Final Year Student" : "Class 12th Pass Graduate";

    content.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
        <div style="width: 64px; height: 64px; border-radius: 16px; background-color: ${u.avatar_color || '#0d9488'}; display: flex; align-items: center; justify-content: center; font-size: 32px;">
          ${u.avatar_emoji || '🚀'}
        </div>
        <div>
          <h2 style="font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.2;">
            ${escapeHtml(u.full_name)}
          </h2>
          <div style="font-size: 14px; color: #64748b; font-weight: 600;">@${escapeHtml(u.username)}</div>
          <span style="display: inline-block; margin-top: 4px; font-size: 11.5px; font-weight: 700; background: var(--comm-teal-light); color: var(--comm-teal); border: 1px solid var(--comm-teal-border); padding: 3px 8px; border-radius: 6px;">
            ${stageText}
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid var(--comm-border); padding: 12px; border-radius: 10px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Target Role</div>
          <div style="font-size: 14px; color: var(--comm-sky); font-weight: 700; margin-top: 2px;">
            ${escapeHtml(u.target_role || "Engineering Track")}
          </div>
        </div>
        <div style="background: #f8fafc; border: 1px solid var(--comm-border); padding: 12px; border-radius: 10px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Stream / Major</div>
          <div style="font-size: 14px; color: #0f172a; font-weight: 700; margin-top: 2px;">
            ${escapeHtml(u.stream_or_degree || "Technical Sciences")}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Bio</div>
        <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0;">
          ${escapeHtml(u.bio || "No bio provided.")}
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Core Interests (${u.interests.length})</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${u.interests.map(i => `<span class="shared-tag" style="font-size: 12px; padding: 4px 10px;">${escapeHtml(i)}</span>`).join("")}
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
        <button class="btn btn--solid" style="flex: 1; padding: 12px;" onclick="handlePeerInviteClick(${u.id}, '${escapeHtml(u.username)}')">
          Invite to My Squad &rarr;
        </button>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div style="color: #f87171;">Network error fetching profile.</div>`;
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
  const signInBtn = document.getElementById("authTabSignInBtn");
  const signUpBtn = document.getElementById("authTabSignUpBtn");
  const signInForm = document.getElementById("signInForm");
  const signUpForm = document.getElementById("signUpForm");

  if (tab === 'signin') {
    signInBtn?.classList.add("active");
    signUpBtn?.classList.remove("active");
    if (signInForm) signInForm.style.display = "block";
    if (signUpForm) signUpForm.style.display = "none";
  } else {
    signUpBtn?.classList.add("active");
    signInBtn?.classList.remove("active");
    if (signUpForm) signUpForm.style.display = "block";
    if (signInForm) signInForm.style.display = "none";
  }
}

function openCreateSquadModal() {
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in to form a squad.", "🔒");
    return;
  }
  document.getElementById("createSquadModal")?.classList.add("open");
}

function closeCreateSquadModal() {
  document.getElementById("createSquadModal")?.classList.remove("open");
}

function openJoinSquadModal(prefillCode = "") {
  if (!STATE.token) {
    openAuthModal("signin");
    showToast("Please sign in to join a squad.", "🔒");
    return;
  }
  const modal = document.getElementById("joinSquadModal");
  const input = document.getElementById("joinCodeInput");
  if (input && prefillCode) input.value = prefillCode;
  modal?.classList.add("open");
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
function showToast(text, icon = "✨") {
  const notice = document.getElementById("toastNotice");
  const iconElem = document.getElementById("toastIcon");
  const textElem = document.getElementById("toastText");
  if (!notice) return;

  if (iconElem) iconElem.textContent = icon;
  if (textElem) textElem.textContent = text;

  notice.classList.add("show");
  setTimeout(() => {
    notice.classList.remove("show");
  }, 4000);
}

// Utilities
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr.replace(" ", "T"));
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return isoStr;
  }
}
