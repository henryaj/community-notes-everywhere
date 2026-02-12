// content.js — injected into pages, handles highlights + note display
// Anchoring logic lives in anchoring.js (imported at build time for tests,
// but since Chrome content scripts don't support ES modules, we inline it here
// and also export from anchoring.js for testing).

(() => {
  // Avoid running in iframes or contexts where extension APIs aren't available
  if (window !== window.top) return;
  if (!chrome?.runtime?.sendMessage) return;

  let notes = [];
  let canRate = false;
  let canWrite = false;
  let showAllNotes = false;
  let addNoteButton = null;

  // ── Anchoring functions (mirrored in anchoring.js for testing) ──

  function normalizeWs(str) {
    return str.replace(/\s+/g, " ").trim();
  }

  function collectTextNodes(node) {
    const treeWalker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_TEXT,
      null
    );
    let currentNode;
    let fullText = "";
    const textNodes = [];

    while ((currentNode = treeWalker.nextNode())) {
      textNodes.push({ node: currentNode, start: fullText.length });
      fullText += currentNode.textContent;
    }

    return { fullText, textNodes };
  }

  function buildRange(textNodes, start, end) {
    const range = document.createRange();
    let startSet = false;

    for (let i = 0; i < textNodes.length; i++) {
      const tn = textNodes[i];
      const nodeEnd = tn.start + tn.node.textContent.length;

      if (!startSet && start < nodeEnd) {
        range.setStart(tn.node, start - tn.start);
        startSet = true;
      }

      if (startSet && end <= nodeEnd) {
        range.setEnd(tn.node, end - tn.start);
        return range;
      }
    }

    return null;
  }

  function findTextInNode(node, searchText) {
    if (!searchText) return null;

    const { fullText, textNodes } = collectTextNodes(node);
    const index = fullText.indexOf(searchText);
    if (index === -1) return null;

    return buildRange(textNodes, index, index + searchText.length);
  }

  function findTextNormalized(node, searchText) {
    if (!searchText) return null;

    const { fullText, textNodes } = collectTextNodes(node);

    const normalizedChars = [];
    const origIndexMap = [];
    let inSpace = false;

    for (let i = 0; i < fullText.length; i++) {
      if (/\s/.test(fullText[i])) {
        if (!inSpace && normalizedChars.length > 0) {
          normalizedChars.push(" ");
          origIndexMap.push(i);
        }
        inSpace = true;
      } else {
        normalizedChars.push(fullText[i]);
        origIndexMap.push(i);
        inSpace = false;
      }
    }

    const normalizedFull = normalizedChars.join("");
    const normalizedSearch = normalizeWs(searchText);
    const idx = normalizedFull.indexOf(normalizedSearch);
    if (idx === -1) return null;

    const origStart = origIndexMap[idx];
    const origEnd = origIndexMap[idx + normalizedSearch.length - 1] + 1;

    return buildRange(textNodes, origStart, origEnd);
  }

  function findTextWithContext(text, prefix, suffix) {
    const bodyText = document.body.innerText || document.body.textContent;
    const searchString = (prefix || "") + text + (suffix || "");

    let index = bodyText.indexOf(searchString);
    if (index !== -1) {
      const textStart = index + (prefix || "").length;
      return findTextInNode(
        document.body,
        bodyText.substring(textStart, textStart + text.length)
      );
    }

    const normBody = normalizeWs(bodyText);
    const normSearch = normalizeWs(searchString);
    index = normBody.indexOf(normSearch);
    if (index !== -1) {
      return findTextNormalized(document.body, text);
    }

    return null;
  }

  function findTextRange(note) {
    if (note.css_selector) {
      try {
        const container = document.querySelector(note.css_selector);
        if (container) {
          const range = findTextInNode(container, note.selected_text);
          if (range) return range;
        }
      } catch {
        // Invalid selector, skip
      }
    }

    const exactRange = findTextInNode(document.body, note.selected_text);
    if (exactRange) return exactRange;

    if (note.text_prefix || note.text_suffix) {
      const contextRange = findTextWithContext(
        note.selected_text,
        note.text_prefix,
        note.text_suffix
      );
      if (contextRange) return contextRange;
    }

    const normalizedRange = findTextNormalized(
      document.body,
      note.selected_text
    );
    if (normalizedRange) return normalizedRange;

    return null;
  }

  // ── Page interaction ──

  async function loadNotes() {
    // Restore toggle preference from storage
    const stored = await chrome.storage.local.get("cne_show_all_notes");
    if (stored.cne_show_all_notes === true) showAllNotes = true;

    const response = await chrome.runtime.sendMessage({
      type: "GET_NOTES",
      url: window.location.href,
    });

    if (response && response.notes) {
      notes = response.notes;
      canRate = response.canRate || false;
      canWrite = response.canWrite || false;
      highlightNotes();
    }
  }

  function highlightNotes() {
    document.querySelectorAll(".cne-highlight").forEach((el) => {
      el.replaceWith(...el.childNodes);
    });

    const visibleNotes = showAllNotes
      ? notes
      : notes.filter((note) => note.status === "helpful");

    visibleNotes.forEach((note) => {
      const range = findTextRange(note);
      if (range) {
        wrapRangeWithHighlight(range, note);
      }
    });

    updateToggleButton();
  }

  function updateToggleButton() {
    let btn = document.querySelector(".cne-toggle-btn");
    const hiddenCount = notes.filter((n) => n.status !== "helpful").length;

    if (hiddenCount === 0) {
      if (btn) btn.remove();
      return;
    }

    if (!btn) {
      btn = document.createElement("button");
      btn.className = "cne-toggle-btn";
      document.body.appendChild(btn);
      btn.addEventListener("click", () => {
        showAllNotes = !showAllNotes;
        chrome.storage.local.set({ cne_show_all_notes: showAllNotes });
        highlightNotes();
      });
    }

    btn.textContent = showAllNotes
      ? "Hide unrated notes"
      : `Show ${hiddenCount} unrated note${hiddenCount === 1 ? "" : "s"}`;
  }

  function wrapRangeWithHighlight(range, note) {
    const highlight = document.createElement("span");
    highlight.className = "cne-highlight";
    highlight.classList.add("cne-highlight-" + note.status);
    highlight.dataset.noteId = note.id;
    highlight.title = `Community Note by @${note.author.handle}`;

    try {
      range.surroundContents(highlight);
    } catch {
      const contents = range.extractContents();
      highlight.appendChild(contents);
      range.insertNode(highlight);
    }

    highlight.addEventListener("click", (e) => {
      e.stopPropagation();
      showNotePopover(highlight, note);
    });
  }

  function formatStatusBadge(note) {
    const totalRatings = (note.helpful_count || 0) + (note.somewhat_count || 0) + (note.not_helpful_count || 0);
    const ratingsText = totalRatings === 1 ? '1 rating' : `${totalRatings} ratings`;

    if (note.status === 'helpful') {
      return `<span class="cne-status-badge cne-badge-helpful">&#x2713; Currently rated helpful</span><span class="cne-ratings-count">${ratingsText}</span>`;
    } else if (note.status === 'not_helpful') {
      return `<span class="cne-status-badge cne-badge-not-helpful">&#x2717; Currently not rated helpful</span><span class="cne-ratings-count">${ratingsText}</span>`;
    } else {
      return `<span class="cne-status-badge cne-badge-pending">&#x25CB; Needs more ratings</span><span class="cne-ratings-count">${ratingsText}</span>`;
    }
  }

  const POPOVER_WIDTH = 360;
  const GAP = 8;

  function computePopoverPosition(anchorRect) {
    const viewportWidth = window.innerWidth;
    const effectiveWidth = Math.min(POPOVER_WIDTH, viewportWidth * 0.9);
    const spaceRight = viewportWidth - anchorRect.right;
    const spaceLeft = anchorRect.left;

    if (spaceRight >= effectiveWidth + GAP) {
      return { placement: "right",
               top: window.scrollY + anchorRect.top,
               left: window.scrollX + anchorRect.right + GAP };
    } else if (spaceLeft >= effectiveWidth + GAP) {
      return { placement: "left",
               top: window.scrollY + anchorRect.top,
               left: window.scrollX + anchorRect.left - effectiveWidth - GAP };
    } else {
      return { placement: "below",
               top: window.scrollY + anchorRect.bottom + GAP,
               left: window.scrollX + anchorRect.left };
    }
  }

  async function showNotePopover(anchor, note) {
    document.querySelectorAll(".cne-popover").forEach((el) => el.remove());

    // Get current user to check ownership
    const storage = await chrome.storage.local.get("user");
    const currentUser = storage.user;
    const isOwner = currentUser && note.author && note.author.id === currentUser.id;

    const popover = document.createElement("div");
    popover.className = "cne-popover";
    popover.innerHTML = `
      <div class="cne-popover-header">
        <div class="cne-author-info">
          <strong>${escapeHtml(note.author.display_name)}</strong>
          <span class="cne-handle-line">
            <a href="https://x.com/${encodeURIComponent(note.author.handle)}" target="_blank" rel="noopener noreferrer" class="cne-handle">@${escapeHtml(note.author.handle)}</a>
            ${note.author.karma != null ? `<span class="cne-karma" style="color: ${note.author.karma > 0 ? '#00b450' : note.author.karma < 0 ? '#f4212e' : '#536471'}">&middot; ${note.author.karma} karma</span>` : ''}
          </span>
        </div>
        ${!isOwner && !note.current_user_reported ? `<button class="cne-report-btn" title="Report this note">&#x2691;</button>` : ''}
        ${!isOwner && note.current_user_reported ? `<span class="cne-reported-label">Reported</span>` : ''}
        <button class="cne-close">&times;</button>
      </div>
      <div class="cne-popover-body">
        <p>${linkify(escapeHtml(note.body))}</p>
        ${note.edited_at ? `<span class="cne-edited-label">edited</span>` : ''}
      </div>
      <div class="cne-popover-status">
        ${formatStatusBadge(note)}
      </div>
      ${isOwner ? (() => {
        const editWindowEnd = new Date(note.edit_window_closes_at || (new Date(note.created_at).getTime() + 10 * 60 * 1000));
        const now = new Date();
        const canEdit = now < editWindowEnd;
        const minutesLeft = Math.max(0, Math.ceil((editWindowEnd - now) / 60000));
        return `<div class="cne-owner-actions">
          ${canEdit
            ? `<button class="cne-edit-btn">Edit <span class="cne-edit-timer">(${minutesLeft}m left)</span></button>`
            : `<span class="cne-edit-expired" title="Edit window closed">Edit window closed</span>`}
          <button class="cne-delete-btn">Delete</button>
        </div>`;
      })() : ''}
      ${canRate ? `<div class="cne-popover-footer">
        <span class="cne-rating-label">Is this note helpful? <span class="cne-info-icon">&#x24D8;<span class="cne-info-tooltip"><strong>Consider whether this note:</strong><ul><li>Cites high-quality sources</li><li>Is accurate and up to date</li><li>Provides important context</li><li>Is easy to understand</li><li>Would be useful to people across different viewpoints</li><li>Is neutral and non-inflammatory</li></ul></span></span></span>
        <div class="cne-rating-pills">
          <button class="cne-pill-btn${note.current_user_rating === 'yes' ? ' cne-pill-selected' : ''}" data-note-id="${note.id}" data-helpfulness="yes">Yes</button>
          <button class="cne-pill-btn${note.current_user_rating === 'somewhat' ? ' cne-pill-selected' : ''}" data-note-id="${note.id}" data-helpfulness="somewhat">Somewhat</button>
          <button class="cne-pill-btn${note.current_user_rating === 'no' ? ' cne-pill-selected' : ''}" data-note-id="${note.id}" data-helpfulness="no">No</button>
        </div>
      </div>` : ''}
    `;

    const rect = anchor.getBoundingClientRect();
    const position = computePopoverPosition(rect);
    popover.style.top = `${position.top}px`;
    popover.style.left = `${position.left}px`;
    popover.dataset.placement = position.placement;

    document.body.appendChild(popover);

    // Clamp vertical overflow for side-positioned popovers
    if (position.placement !== "below") {
      const popoverRect = popover.getBoundingClientRect();
      const overflow = popoverRect.bottom - window.innerHeight;
      if (overflow > 0) {
        popover.style.top = `${Math.max(window.scrollY, position.top - overflow - GAP)}px`;
      }
    }

    popover
      .querySelector(".cne-close")
      .addEventListener("click", () => popover.remove());

    // ── Edit button handler ──
    const editBtn = popover.querySelector(".cne-edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const body = popover.querySelector(".cne-popover-body");
        body.innerHTML = `
          <textarea class="cne-edit-textarea">${escapeHtml(note.body)}</textarea>
          <div class="cne-edit-actions">
            <button class="cne-edit-cancel">Cancel</button>
            <button class="cne-edit-save">Save</button>
          </div>
        `;
        const textarea = body.querySelector(".cne-edit-textarea");
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        body.querySelector(".cne-edit-cancel").addEventListener("click", () => {
          body.innerHTML = `<p>${linkify(escapeHtml(note.body))}</p>`;
        });

        body.querySelector(".cne-edit-save").addEventListener("click", async () => {
          const newBody = textarea.value.trim();
          if (!newBody) return;

          const saveBtn = body.querySelector(".cne-edit-save");
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving...";

          const result = await chrome.runtime.sendMessage({
            type: "UPDATE_NOTE",
            noteId: note.id,
            note: { body: newBody },
          });

          if (result && !result.error) {
            note.body = result.body || newBody;
            body.innerHTML = `<p>${linkify(escapeHtml(note.body))}</p>`;
            // Update the note in the local array
            const idx = notes.findIndex((n) => n.id === note.id);
            if (idx !== -1) notes[idx] = { ...notes[idx], body: note.body };
          } else {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save";
            alert(result?.error || "Failed to update note.");
          }
        });
      });
    }

    // ── Delete button handler ──
    const deleteBtn = popover.querySelector(".cne-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        const ownerActions = popover.querySelector(".cne-owner-actions");
        ownerActions.innerHTML = `
          <span class="cne-delete-confirm-text">Delete this note?</span>
          <button class="cne-delete-yes">Yes</button>
          <button class="cne-delete-cancel">Cancel</button>
        `;

        ownerActions.querySelector(".cne-delete-cancel").addEventListener("click", () => {
          ownerActions.innerHTML = `
            <button class="cne-edit-btn">Edit</button>
            <button class="cne-delete-btn">Delete</button>
          `;
          // Re-attach listeners for the restored buttons
          ownerActions.querySelector(".cne-edit-btn").addEventListener("click", () => {
            editBtn.click();
          });
          ownerActions.querySelector(".cne-delete-btn").addEventListener("click", () => {
            deleteBtn.click();
          });
        });

        ownerActions.querySelector(".cne-delete-yes").addEventListener("click", async () => {
          const yesBtn = ownerActions.querySelector(".cne-delete-yes");
          yesBtn.disabled = true;
          yesBtn.textContent = "Deleting...";

          const result = await chrome.runtime.sendMessage({
            type: "DELETE_NOTE",
            noteId: note.id,
          });

          if (result && !result.error) {
            // Remove from local array
            const idx = notes.findIndex((n) => n.id === note.id);
            if (idx !== -1) notes.splice(idx, 1);
            // Remove highlight span
            const highlight = document.querySelector(`.cne-highlight[data-note-id="${note.id}"]`);
            if (highlight) highlight.replaceWith(...highlight.childNodes);
            popover.remove();
          } else {
            yesBtn.disabled = false;
            yesBtn.textContent = "Yes";
            alert(result?.error || "Failed to delete note.");
          }
        });
      });
    }

    // ── Report button handler ──
    const reportBtn = popover.querySelector(".cne-report-btn");
    if (reportBtn) {
      reportBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Remove existing dropdown if open
        const existing = popover.querySelector(".cne-report-dropdown");
        if (existing) { existing.remove(); return; }

        const dropdown = document.createElement("div");
        dropdown.className = "cne-report-dropdown";
        dropdown.innerHTML = `
          <div class="cne-report-option" data-reason="spam">Spam</div>
          <div class="cne-report-option" data-reason="harassment">Harassment</div>
          <div class="cne-report-option" data-reason="misleading">Misleading</div>
          <div class="cne-report-option" data-reason="other">Other</div>
        `;
        reportBtn.parentElement.style.position = "relative";
        reportBtn.after(dropdown);

        dropdown.querySelectorAll(".cne-report-option").forEach((opt) => {
          opt.addEventListener("click", async () => {
            const reason = opt.dataset.reason;
            dropdown.remove();

            const result = await chrome.runtime.sendMessage({
              type: "REPORT_NOTE",
              noteId: note.id,
              reason,
            });

            if (result && !result.error) {
              reportBtn.replaceWith(Object.assign(document.createElement("span"), {
                className: "cne-reported-label",
                textContent: "Reported",
              }));
            }
          });
        });
      });
    }

    // ── Rating pill handlers ──
    popover.querySelectorAll(".cne-pill-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const helpfulness = btn.dataset.helpfulness;
        const result = await chrome.runtime.sendMessage({
          type: "RATE_NOTE",
          noteId: parseInt(btn.dataset.noteId),
          helpfulness,
        });

        if (result && !result.error) {
          popover.querySelectorAll(".cne-pill-btn").forEach((b) => {
            b.classList.remove("cne-pill-selected");
          });
          btn.classList.add("cne-pill-selected");

          const pills = popover.querySelectorAll(".cne-pill-btn");
          pills[0].textContent = 'Yes';
          pills[1].textContent = 'Somewhat';
          pills[2].textContent = 'No';

          const statusEl = popover.querySelector(".cne-popover-status");
          if (statusEl) {
            note.status = result.note.status;
            note.helpful_count = result.note.helpful_count;
            note.somewhat_count = result.note.somewhat_count;
            note.not_helpful_count = result.note.not_helpful_count;
            note.current_user_rating = helpfulness;
            statusEl.innerHTML = formatStatusBadge(note);
          }
        }
      });
    });

    function onClickOutside(e) {
      if (!popover.contains(e.target) && !anchor.contains(e.target)) {
        popover.remove();
        document.removeEventListener("click", onClickOutside, true);
      }
    }

    setTimeout(() => {
      document.addEventListener("click", onClickOutside, true);
    }, 0);
  }

  document.addEventListener("mouseup", (e) => {
    if (e.target.closest(".cne-popover, .cne-add-note-btn, .cne-note-form"))
      return;

    removeAddNoteButton();

    if (!canWrite) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim())
      return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    addNoteButton = document.createElement("button");
    addNoteButton.className = "cne-add-note-btn";
    addNoteButton.textContent = "+ Add Note";
    addNoteButton.style.top = `${window.scrollY + rect.bottom + 4}px`;
    addNoteButton.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;

    addNoteButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const selectedText = selection.toString();
      const context = getCaptureContext(range, selectedText);
      removeAddNoteButton();
      showNoteForm(rect, selectedText, context);
    });

    document.body.appendChild(addNoteButton);
  });

  function removeAddNoteButton() {
    if (addNoteButton) {
      addNoteButton.remove();
      addNoteButton = null;
    }
  }

  function getCaptureContext(range, selectedText) {
    const container = range.commonAncestorContainer;
    const element =
      container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : container;

    const cssSelector = getCssSelector(element);

    const fullText = element.textContent || "";
    const textIndex = fullText.indexOf(selectedText);

    let textPrefix = "";
    let textSuffix = "";

    if (textIndex >= 0) {
      textPrefix = fullText.substring(Math.max(0, textIndex - 50), textIndex);
      textSuffix = fullText.substring(
        textIndex + selectedText.length,
        textIndex + selectedText.length + 50
      );
    }

    return { cssSelector, textPrefix, textSuffix };
  }

  function getCssSelector(element) {
    if (element.id) return `#${element.id}`;

    const parts = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        parts.unshift(`#${current.id}`);
        break;
      }

      if (current.className && typeof current.className === "string") {
        const classes = current.className
          .trim()
          .split(/\s+/)
          .filter((c) => !c.startsWith("cne-"))
          .slice(0, 2);
        if (classes.length) {
          selector += `.${classes.join(".")}`;
        }
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (s) => s.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(" > ");
  }

  function showNoteForm(rect, selectedText, context) {
    document.querySelectorAll(".cne-note-form").forEach((el) => el.remove());

    const form = document.createElement("div");
    form.className = "cne-note-form";
    form.innerHTML = `
      <div class="cne-form-header">
        <strong>Add Community Note</strong>
        <button class="cne-close">&times;</button>
      </div>
      <div class="cne-form-selected">
        <em>"${escapeHtml(selectedText.substring(0, 100))}${selectedText.length > 100 ? "..." : ""}"</em>
      </div>
      <div class="cne-form-guidance">
        Write a note with context that you believe should be shown with the post to keep others informed.
        Be precise — providing links to outside sources is required.
      </div>
      <textarea class="cne-form-textarea" placeholder="Add context and link to trustworthy sources..." rows="4"></textarea>
      <div class="cne-source-check">
        <p class="cne-source-question">Did you link to sources you believe most people would consider trustworthy?</p>
        <label class="cne-radio-label">
          <input type="radio" name="cne-sources-linked" value="true" class="cne-radio" />
          Yes
        </label>
        <label class="cne-radio-label">
          <input type="radio" name="cne-sources-linked" value="false" class="cne-radio" />
          No
        </label>
      </div>
      <div class="cne-form-actions">
        <button class="cne-form-cancel">Cancel</button>
        <button class="cne-form-submit">Submit Note</button>
      </div>
    `;

    form.style.top = `${window.scrollY + rect.bottom + 8}px`;
    form.style.left = `${window.scrollX + Math.max(rect.left, 10)}px`;

    document.body.appendChild(form);

    const textarea = form.querySelector(".cne-form-textarea");
    textarea.focus();

    form
      .querySelector(".cne-close")
      .addEventListener("click", () => form.remove());
    form
      .querySelector(".cne-form-cancel")
      .addEventListener("click", () => form.remove());

    form
      .querySelector(".cne-form-submit")
      .addEventListener("click", async () => {
        const body = textarea.value.trim();
        if (!body) return;

        const submitBtn = form.querySelector(".cne-form-submit");
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        const sourcesRadio = form.querySelector('input[name="cne-sources-linked"]:checked');
        const sourcesLinked = sourcesRadio ? sourcesRadio.value === "true" : null;

        const result = await chrome.runtime.sendMessage({
          type: "CREATE_NOTE",
          note: {
            url: window.location.href,
            body,
            selected_text: selectedText,
            text_prefix: context.textPrefix,
            text_suffix: context.textSuffix,
            css_selector: context.cssSelector,
            sources_linked: sourcesLinked,
          },
        });

        if (result && !result.error) {
          form.remove();
          notes.push(result);
          highlightNotes();
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Note";
          const errorMsg =
            result?.error || "Failed to create note. Are you logged in?";
          alert(errorMsg);
        }
      });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Convert URLs in already-escaped HTML text into clickable links
  function linkify(escapedHtml) {
    return escapedHtml.replace(
      /https?:\/\/[^\s<"']+/g,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="cne-link">${url}</a>`
    );
  }

  async function maybeShowOnboarding() {
    const { cne_onboarded } = await chrome.storage.local.get("cne_onboarded");
    if (cne_onboarded) return;

    const firstHighlight = document.querySelector(".cne-highlight");
    if (!firstHighlight) return;

    const card = document.createElement("div");
    card.className = "cne-onboarding";

    card.innerHTML = `
      <div class="cne-onboarding-title">Welcome to Community Notes Everywhere!</div>
      <div class="cne-onboarding-text">
        Highlighted text has community-written context notes. Click any highlight to read the note and rate whether it's helpful.
      </div>
      <button class="cne-onboarding-dismiss">Got it</button>
    `;

    const rect = firstHighlight.getBoundingClientRect();
    card.style.top = `${window.scrollY + rect.bottom + GAP}px`;
    card.style.left = `${window.scrollX + rect.left}px`;
    document.body.appendChild(card);

    card.querySelector(".cne-onboarding-dismiss").addEventListener("click", () => {
      chrome.storage.local.set({ cne_onboarded: true });
      card.remove();
    });
  }

  // ── Sidebar ──

  function createSidebar() {
    // Don't create duplicate sidebar
    if (document.querySelector('.cne-sidebar')) return;

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'cne-sidebar-toggle';
    toggleBtn.innerHTML = '&#x2630;'; // hamburger icon
    toggleBtn.title = 'Toggle notes sidebar';
    document.body.appendChild(toggleBtn);

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'cne-sidebar-backdrop';
    document.body.appendChild(backdrop);

    // Sidebar panel
    const sidebar = document.createElement('div');
    sidebar.className = 'cne-sidebar';
    sidebar.innerHTML = `
      <div class="cne-sidebar-header">
        <h3>${notes.length} note${notes.length === 1 ? '' : 's'} on this page</h3>
        <button class="cne-sidebar-close">&times;</button>
      </div>
      <ul class="cne-sidebar-list"></ul>
    `;
    document.body.appendChild(sidebar);

    function populateSidebar() {
      const list = sidebar.querySelector('.cne-sidebar-list');
      list.innerHTML = '';

      const header = sidebar.querySelector('.cne-sidebar-header h3');
      header.textContent = `${notes.length} note${notes.length === 1 ? '' : 's'} on this page`;

      if (notes.length === 0) {
        list.innerHTML = '<li class="cne-sidebar-empty">No notes on this page yet.</li>';
        return;
      }

      notes.forEach(note => {
        const li = document.createElement('li');
        li.className = 'cne-sidebar-item';
        const bodyPreview = note.body.length > 80 ? note.body.substring(0, 80) + '...' : note.body;
        const totalRatings = (note.helpful_count || 0) + (note.somewhat_count || 0) + (note.not_helpful_count || 0);

        li.innerHTML = `
          <div class="cne-sidebar-item-header">
            <span class="cne-sidebar-status-dot ${note.status}"></span>
            <span class="cne-sidebar-author">@${escapeHtml(note.author.handle)}</span>
          </div>
          <div class="cne-sidebar-body">${escapeHtml(bodyPreview)}</div>
          <div class="cne-sidebar-ratings">${totalRatings} rating${totalRatings === 1 ? '' : 's'} &middot; ${note.status.replace('_', ' ')}</div>
        `;

        li.addEventListener('click', () => {
          const highlight = document.querySelector(`.cne-highlight[data-note-id="${note.id}"]`);
          if (highlight) {
            highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => showNotePopover(highlight, note), 400);
          }
          closeSidebar();
        });

        list.appendChild(li);
      });
    }

    function openSidebar() {
      populateSidebar();
      sidebar.classList.add('cne-sidebar-open');
      backdrop.classList.add('cne-sidebar-backdrop-visible');
    }

    function closeSidebar() {
      sidebar.classList.remove('cne-sidebar-open');
      backdrop.classList.remove('cne-sidebar-backdrop-visible');
    }

    toggleBtn.addEventListener('click', () => {
      if (sidebar.classList.contains('cne-sidebar-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    sidebar.querySelector('.cne-sidebar-close').addEventListener('click', closeSidebar);
    backdrop.addEventListener('click', closeSidebar);
  }

  // Initialize
  loadNotes().then(() => {
    maybeShowOnboarding();
    if (notes.length > 0) createSidebar();
  });
})();
