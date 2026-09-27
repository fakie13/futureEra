/**
 * FutureEra Global Navigation Auth Sync
 * Hydrates top header across all pages with user session avatar, squad status, and Sign Out action.
 */
(function() {
  window.feGlobalSignOut = async function() {
    const token = localStorage.getItem("fe_session_token");
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "X-Session-Token": token
          }
        });
      } catch (e) {
        // ignore network error
      }
      localStorage.removeItem("fe_session_token");
    }
    window.location.reload();
  };

  async function syncNavAuth() {
    const container = document.getElementById("headerAuthContainer");
    if (!container) return;

    const token = localStorage.getItem("fe_session_token");
    if (!token) {
      renderLoggedOutState(container);
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Session-Token": token
        }
      });
      const data = await res.json();
      if (data.authenticated && data.user) {
        const u = data.user;
        const firstName = escapeNavHtml((u.full_name || "Engineer").split(" ")[0]);
        const initials = getNavInitials(u.full_name);
        const color = u.avatar_color && u.avatar_color.startsWith("#") ? u.avatar_color : "#0f766e";
        const squadBadge = u.squad_name
          ? `<span class="nav-user-squad">${escapeNavHtml(u.squad_name)}</span>`
          : `<span class="nav-user-squad" style="color: #64748b; background: #f1f5f9; border-color: #e2e8f0;">No Squad</span>`;

        container.innerHTML = `
          <div class="nav-auth-user-wrap">
            <a href="/community?tab=squad" class="nav-user-pill" title="Open Your Squad Workspace">
              <div class="nav-user-avatar" style="background-color: ${color}; font-size: 11px; font-weight: 700; letter-spacing: -0.02em;">
                ${initials}
              </div>
              <span>${firstName}</span>
              ${squadBadge}
            </a>
            <button type="button" class="nav-signout-btn" onclick="feGlobalSignOut()" title="Sign Out of FutureEra">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        `;
      } else {
        localStorage.removeItem("fe_session_token");
        renderLoggedOutState(container);
      }
    } catch (err) {
      // Keep default CTA on network error or offline
    }
  }

  function renderLoggedOutState(container) {
    if (!container.innerHTML.trim()) {
      container.innerHTML = `
        <div style="display: inline-flex; align-items: center; gap: 8px;">
          <a href="/signin" class="nav-signin-link">Sign In</a>
          <a href="/stage" class="btn btn--solid" style="padding: 8px 16px; font-size: 12px;">Get Started &rarr;</a>
        </div>
      `;
    } else if (!container.querySelector(".nav-signin-link") && !container.querySelector(".nav-signout-btn")) {
      const currentContent = container.innerHTML;
      container.innerHTML = `
        <div style="display: inline-flex; align-items: center; gap: 8px;">
          <a href="/signin" class="nav-signin-link">Sign In</a>
          ${currentContent}
        </div>
      `;
    }
  }

  function getNavInitials(name) {
    if (!name) return "FE";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  function escapeNavHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncNavAuth);
  } else {
    syncNavAuth();
  }
})();
