const API_BASE = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", async () => {
  const loginSection = document.getElementById("login-section");
  const profileSection = document.getElementById("profile-section");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  // Check if user is logged in
  const { authToken, user } = await chrome.storage.local.get([
    "authToken",
    "user",
  ]);

  if (authToken) {
    showProfile(authToken);
  } else {
    loginSection.style.display = "block";
    profileSection.style.display = "none";
  }

  // Login button
  loginBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: `${API_BASE}/auth/x` });
    window.close();
  });

  // Logout button
  logoutBtn.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "LOGOUT" });
    loginSection.style.display = "block";
    profileSection.style.display = "none";
  });

  async function showProfile(token) {
    loginSection.style.display = "none";
    profileSection.style.display = "block";

    // Fetch full profile
    const me = await chrome.runtime.sendMessage({ type: "GET_ME" });

    if (me && !me.error) {
      document.getElementById("display-name").textContent = me.display_name;
      document.getElementById("handle").textContent = `@${me.twitter_handle}`;
      document.getElementById("avatar").src = me.avatar_url || "";
      document.getElementById("reputation").textContent = Math.round(
        me.reputation_score
      );
      document.getElementById("notes-count").textContent = me.notes_count;
      document.getElementById("ratings-count").textContent = me.ratings_count;
    }

    // Load notes for current tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.url) {
      const notes = await chrome.runtime.sendMessage({
        type: "GET_NOTES",
        url: tab.url,
      });

      const notesList = document.getElementById("notes-list");

      if (Array.isArray(notes) && notes.length > 0) {
        notesList.innerHTML = notes
          .map(
            (note) => `
          <div class="note-item">
            <div class="note-text">${escapeHtml(note.body)}</div>
            <div class="note-meta">
              @${escapeHtml(note.author.handle)} &middot;
              ${note.helpful_count} helpful &middot;
              ${note.status}
            </div>
          </div>
        `
          )
          .join("");
      } else {
        notesList.innerHTML =
          '<div class="no-notes">No notes on this page yet.</div>';
      }
    }
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
