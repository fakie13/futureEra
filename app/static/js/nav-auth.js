/**
 * FutureEra Global Navigation Auth Sync
 * Hydrates top header across all pages with user session avatar & squad status.
 */
(function() {
  async function syncNavAuth() {
    const token = localStorage.getItem("fe_session_token");
    const container = document.getElementById("headerAuthContainer");
    if (!container || !token) return;

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
        const squadBadge = u.squad_name
          ? `<span class="nav-user-squad">🛡️ ${escapeNavHtml(u.squad_name)}</span>`
          : `<span class="nav-user-squad" style="color: #64748b; background: #f1f5f9; border-color: #e2e8f0;">No Squad</span>`;

        container.innerHTML = `
          <a href="/community?tab=squad" class="nav-user-pill" title="Open Your 4-Member Squad War Room">
            <div class="nav-user-avatar" style="background-color: ${u.avatar_color || '#0d9488'};">
              ${u.avatar_emoji || '🚀'}
            </div>
            <span>${firstName}</span>
            ${squadBadge}
          </a>
        `;
      }
    } catch (err) {
      // Keep default CTA on network error or offline
    }
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
