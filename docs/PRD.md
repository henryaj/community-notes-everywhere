# Community Notes Everywhere — Product Requirements Document

## Overview

Community Notes Everywhere is a Chrome extension that lets users annotate any webpage with contextual notes, similar to Twitter/X's Community Notes but for the entire web. Notes are anchored to specific text selections, rated by the community, and surfaced inline via highlights.

The system uses Twitter OAuth for identity, a reputation system to gate participation, and a consensus-based rating mechanism to surface helpful notes.

## Architecture

- **Backend:** Rails API (JSON-only, no server-side sessions)
- **Frontend:** Chrome Extension (Manifest V3) with content script, background service worker, and popup
- **Auth:** Twitter OAuth 2.0 via OmniAuth; token stored in `chrome.storage.local`
- **Database:** PostgreSQL with four core tables: users, pages, notes, ratings

## Core concepts

### Pages

A **page** is a normalized URL. URLs are canonicalized by stripping fragments and trailing slashes. Pages are created automatically when the first note is submitted for a URL.

### Notes

A **note** is a piece of context attached to a text selection on a page. Each note stores:

- The note **body** (freeform text; URLs are auto-linkified in the UI)
- The **selected text** being annotated
- Anchoring data: **text prefix/suffix** (50 chars each) and a **CSS selector** for the containing element
- A **sources linked** self-declaration (boolean) — authors confirm whether they linked trustworthy sources
- A **status** that updates automatically based on community ratings: `pending`, `helpful`, or `not_helpful`
- Rating counters: `helpful_count`, `somewhat_count`, `not_helpful_count`

### Ratings

Ratings are three-way: **Yes**, **Somewhat**, or **No**. Each user can rate a note once (upsert on re-rate). Rating counters and note status update automatically after each rating.

**Status determination:**

| Status | Condition |
|--------|-----------|
| Helpful | `(helpful + somewhat >= 3)` AND `(helpful + somewhat > not_helpful * 2)` |
| Not helpful | `(not_helpful >= 3)` AND `(not_helpful > (helpful + somewhat) * 2)` |
| Pending | Otherwise |

## Reputation system

Reputation determines what a user can do. It's calculated from three signals:

| Signal | Formula | Max points |
|--------|---------|------------|
| Account age | 4 pts/year | 20 |
| Follower count | `log10(followers) * 10` | 30 |
| Note quality | `(helpful_notes / total_notes) * 50` | 50 |

**Maximum possible score: 100**

Reputation is recalculated on each OAuth login.

### Permission thresholds

| Action | Required reputation | Constant |
|--------|-------------------|----------|
| Read notes | 0 (anyone, no auth needed) | — |
| Write notes | 25 | `MIN_WRITING_REPUTATION` |
| Rate notes | 25 | `MIN_RATING_REPUTATION` |

Writing and rating thresholds are defined as separate constants so they can diverge as the user base grows.

### Example reputation calculations

| Profile | Age pts | Follower pts | Note pts | Total | Can write/rate? |
|---------|---------|-------------|----------|-------|-----------------|
| New account, 10 followers, no notes | 0 | 10.0 | 0 | 10.0 | No |
| 2-year account, 100 followers | 8.0 | 20.0 | 0 | 28.0 | Yes |
| 18-year account, 406 followers ([@henryaj](https://x.com/henryaj)) | 20.0 | 26.1 | 0 | 46.1 | Yes |
| 5-year account, 10k followers, 80% helpful notes | 20.0 | 30.0 (cap) | 40.0 | 90.0 | Yes |

## API

All endpoints return JSON. Authentication is via `Authorization: Bearer <token>` header.

### Endpoints

| Method | Path | Auth | Rep gate | Description |
|--------|------|------|----------|-------------|
| `GET` | `/api/notes?url=URL` | Optional | — | Fetch notes for a URL. Returns `can_rate` and `can_write` flags. |
| `POST` | `/api/notes` | Required | Writing (25) | Create a note on a page. |
| `POST` | `/api/notes/:note_id/ratings` | Required | Rating (25) | Rate a note (yes/somewhat/no). Upserts. |
| `GET` | `/api/me` | Required | — | Current user profile with stats and permissions. |
| `GET` | `/auth/x/callback` | — | — | Twitter OAuth callback. |
| `GET` | `/auth/dev` | — | — | Dev-only login (`?user=handle` to impersonate). |

### Error responses

| Status | Meaning |
|--------|---------|
| 400 | Missing required parameter (e.g. `url`) |
| 401 | Not authenticated |
| 403 | Insufficient reputation |
| 422 | Validation failure (empty body, etc.) |

## Extension

### Content script (`content.js`)

Injected into every page. Responsibilities:

1. **Load notes** — sends `GET_NOTES` to background worker on page load
2. **Highlight notes** — wraps matched text in colored `<span>` elements using a multi-strategy text anchoring system (CSS selector, exact match, prefix/suffix context, normalized whitespace)
3. **Note popover** — click a highlight to see author info, note body (with linkified URLs), status badge, and rating pills (if `canRate`)
4. **"+ Add Note" button** — appears on text selection if `canWrite` is true; opens the note creation form
5. **Note creation form** — textarea for body, source self-check radio buttons, submit/cancel

### Background service worker (`background.js`)

- Captures OAuth tokens from auth callback tabs
- Routes messages between content scripts/popup and the API
- Manages auth state in `chrome.storage.local`

### Popup (`popup.html`)

- Shows login button when unauthenticated
- Shows user profile (avatar, handle, reputation, note/rating counts) and notes on the current page when authenticated

### Visual design

Highlights are color-coded by status:

- **Pending** — amber/yellow
- **Helpful** — green
- **Not helpful** — grey

Rating pills show current counts and highlight the user's selection in blue.

## Text anchoring

Notes are re-anchored to page content on each load using a fallback chain:

1. **CSS selector** — try `document.querySelector(selector)`, then exact match within that element
2. **Exact match** — search `document.body` for the selected text verbatim
3. **Context match** — search for `prefix + text + suffix` in the page's inner text
4. **Normalized match** — collapse whitespace and retry

This handles DOM changes, minor edits, and reformatting between when a note was created and when it's viewed.

## Authentication flow

1. User clicks "Sign in" in the popup
2. Extension opens a tab to `/auth/dev` (local) or `/auth/x` (production)
3. Backend processes OAuth, creates/updates user, recalculates reputation
4. Backend renders an HTML page that sets `window.location.hash = "cne_auth=<token+user JSON>"`
5. Background worker detects the hash, extracts token, stores it, closes the tab
6. All subsequent API calls include the Bearer token

Tokens don't expire. Logout clears `chrome.storage.local`.

## Development

### Dev login

`GET /auth/dev` creates a default `dev_tester` user (3-year account, 500 followers, ~38 reputation). Pass `?user=<handle>` to log in as any existing user.

### Test suite

- **Rails specs:** `bundle exec rspec` — request specs for all API endpoints
- **Extension tests:** `cd extension && npx vitest run` — unit tests for text anchoring logic
