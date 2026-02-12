# Community Notes Everywhere

Add community context notes to any webpage — like X's Community Notes, but for the whole internet.

<!-- Badges -->
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-coming_soon-blue?logo=googlechrome)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

![Screenshot](docs/screenshot.png)

## How it works

1. **Install** the Chrome extension from the [Chrome Web Store](#) (or load it locally for development).
2. **Browse** the web as usual. Pages with community notes show inline highlights — green for helpful, amber for pending review.
3. **Contribute** by selecting text on any page, writing a note with context and sources, and rating notes from other users.

## Features

- **Text-anchored notes** — Notes attach to specific text selections and re-anchor automatically, even if the page changes.
- **Three-way ratings** — Rate notes as "Helpful", "Somewhat", or "Not helpful". Notes are promoted or demoted based on community consensus.
- **Reputation system** — Reputation is calculated from your X account age, follower count, and note quality. A minimum score is required to write and rate notes, keeping quality high.
- **Note visibility toggle** — Show or hide notes that haven't reached "helpful" status yet.
- **Edit and delete your notes** — Authors can update or remove their own notes at any time.
- **Report inappropriate notes** — Flag notes as spam, harassment, misleading, or other. Notes with enough reports are automatically hidden.
- **Works on any website** — If it loads in Chrome, you can annotate it.
- **Privacy-first** — We only store what's needed: your X profile info (for identity) and the notes you write.

## Installation

### From the Chrome Web Store

> Coming soon — [Chrome Web Store link](#)

### For development

#### Prerequisites

- Ruby 3.4
- PostgreSQL
- Node.js (for extension tests)
- Chrome or Chromium

#### Backend setup

```bash
git clone https://github.com/henryaj/community-notes-everywhere.git
cd community-notes-everywhere
bundle install
rails db:create db:migrate db:seed
rails server
```

The API runs at `http://localhost:3000`.

#### Load the extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` directory.

#### Dev login

Visit `http://localhost:3000/auth/dev` to log in as a test user. Pass `?user=<handle>` to impersonate any existing user.

#### Running tests

```bash
# Rails API specs
bundle exec rspec

# Extension unit tests
cd extension && npx vitest run
```

## Architecture

Community Notes Everywhere has two main components:

- **Rails API** — A JSON API backed by PostgreSQL. Handles authentication, notes, ratings, reputation, and moderation. Five core models: `User`, `Page`, `Note`, `Rating`, `Report`.
- **Chrome Extension** (Manifest V3) — A content script injected into every page that highlights annotated text, shows note popovers, and provides the note creation UI. A background service worker manages auth state and API communication.

### Authentication

Users sign in with their X (Twitter) account via OAuth 2.0. The extension opens a browser tab to the OAuth flow; on success, the backend passes a bearer token back to the extension via URL fragment. The token is stored in `chrome.storage.local` and included in all API requests.

### Text anchoring

Notes are re-anchored on each page load using a fallback chain: CSS selector → exact text match → prefix/suffix context match → normalized whitespace match. This makes notes resilient to minor page changes.

## Contributing

PRs welcome. Please open an issue first for major changes.

## License

[MIT](LICENSE)

## Links

- [Landing page](#) *(coming soon)*
- [Privacy policy](#) *(coming soon)*
- [Terms of service](#) *(coming soon)*
