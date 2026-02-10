const API_BASE = "http://localhost:3000";

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_TOKEN") {
    // Store auth token from OAuth callback
    chrome.storage.local.set({
      authToken: message.token,
      user: message.user,
    });
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "GET_NOTES") {
    fetchNotes(message.url).then(sendResponse);
    return true; // async response
  }

  if (message.type === "CREATE_NOTE") {
    createNote(message.note).then(sendResponse);
    return true;
  }

  if (message.type === "RATE_NOTE") {
    rateNote(message.noteId, message.helpful).then(sendResponse);
    return true;
  }

  if (message.type === "GET_ME") {
    fetchMe().then(sendResponse);
    return true;
  }

  if (message.type === "LOGOUT") {
    chrome.storage.local.remove(["authToken", "user"]);
    sendResponse({ ok: true });
    return;
  }
});

// Listen for external messages (from OAuth callback page)
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    if (message.type === "AUTH_TOKEN") {
      chrome.storage.local.set({
        authToken: message.token,
        user: message.user,
      });
      sendResponse({ ok: true });
    }
  }
);

async function getAuthToken() {
  const result = await chrome.storage.local.get("authToken");
  return result.authToken;
}

async function apiFetch(path, options = {}) {
  const token = await getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    return { error: error.error || error.errors?.join(", ") || "Request failed" };
  }

  return response.json();
}

async function fetchNotes(url) {
  return apiFetch(`/api/notes?url=${encodeURIComponent(url)}`);
}

async function createNote(note) {
  return apiFetch("/api/notes", {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

async function rateNote(noteId, helpful) {
  return apiFetch(`/api/notes/${noteId}/ratings`, {
    method: "POST",
    body: JSON.stringify({ helpful }),
  });
}

async function fetchMe() {
  return apiFetch("/api/me");
}
