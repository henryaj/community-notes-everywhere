const API_BASE = "http://localhost:3000";

// Watch for auth callback tabs — grab the token from the URL hash
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url) return;

  try {
    const url = new URL(tab.url);
    if (!url.origin.startsWith(API_BASE)) return;
    if (!url.hash.includes("cne_auth=")) return;

    const encoded = url.hash.split("cne_auth=")[1];
    if (!encoded) return;

    const data = JSON.parse(decodeURIComponent(encoded));
    if (data.token) {
      chrome.storage.local.set({
        authToken: data.token,
        user: data.user,
      });
      // Close the auth tab after a short delay
      setTimeout(() => chrome.tabs.remove(tabId), 1500);
    }
  } catch {
    // Not an auth URL, ignore
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_TOKEN") {
    chrome.storage.local.set({
      authToken: message.token,
      user: message.user,
    });
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "GET_NOTES") {
    fetchNotes(message.url).then(sendResponse);
    return true;
  }

  if (message.type === "CREATE_NOTE") {
    createNote(message.note).then(sendResponse);
    return true;
  }

  if (message.type === "RATE_NOTE") {
    rateNote(message.noteId, message.helpfulness).then(sendResponse);
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
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    return {
      error: error.error || error.errors?.join(", ") || "Request failed",
    };
  }

  return response.json();
}

async function fetchNotes(url) {
  const response = await apiFetch(`/api/notes?url=${encodeURIComponent(url)}`);
  if (response.error) return response;
  return { notes: response.notes, canRate: response.can_rate, canWrite: response.can_write };
}

async function createNote(note) {
  return apiFetch("/api/notes", {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

async function rateNote(noteId, helpfulness) {
  return apiFetch(`/api/notes/${noteId}/ratings`, {
    method: "POST",
    body: JSON.stringify({ helpfulness }),
  });
}

async function fetchMe() {
  return apiFetch("/api/me");
}
