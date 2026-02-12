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
  let canRequestAiNotes = false;
  let showAllNotes = false;
  let addNoteButton = null;
  let apiBase = '';

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
      canRequestAiNotes = response.canRequestAiNotes || false;
      apiBase = response.apiBase || '';
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
      return `<span class="cne-status-badge cne-badge-helpful">&#x2713; Currently rated helpful</span><span class="cne-ratings-count">${ratingsText}</span><button class="cne-why-btn" title="Why is this note rated this way?">Why?</button>`;
    } else if (note.status === 'not_helpful') {
      return `<span class="cne-status-badge cne-badge-not-helpful">&#x2717; Currently not rated helpful</span><span class="cne-ratings-count">${ratingsText}</span><button class="cne-why-btn" title="Why is this note rated this way?">Why?</button>`;
    } else {
      return `<span class="cne-status-badge cne-badge-pending">&#x25CB; Needs more ratings</span><span class="cne-ratings-count">${ratingsText}</span><button class="cne-why-btn" title="Why is this note rated this way?">Why?</button>`;
    }
  }

  const POPOVER_WIDTH = 360;
  const GAP = 14;

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

  function dismissPopover(popover, onDone) {
    popover.classList.add("cne-popover-closing");
    popover.addEventListener("animationend", () => {
      popover.remove();
      if (onDone) onDone();
    }, { once: true });
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
          <a href="${apiBase}${note.author.profile_url || '/u/' + encodeURIComponent(note.author.handle)}" target="_blank" rel="noopener noreferrer" class="cne-profile-link"><strong>${escapeHtml(note.author.display_name)}</strong></a>
          <span class="cne-handle-line">
            <a href="https://x.com/${encodeURIComponent(note.author.handle)}" target="_blank" rel="noopener noreferrer" class="cne-handle">@${escapeHtml(note.author.handle)}</a>
            ${note.author.karma != null ? `<span class="cne-karma" style="color: ${note.author.karma > 0 ? '#00b450' : note.author.karma < 0 ? '#f4212e' : '#536471'}">&middot; ${note.author.karma} karma</span>` : ''}
          </span>
        </div>
        ${note.short_url ? `<button class="cne-share-btn" title="Copy link to note">&#x1F517;</button>` : ''}
        ${!isOwner && !note.current_user_reported ? `<button class="cne-report-btn" title="Report this note">&#x2691;</button>` : ''}
        ${!isOwner && note.current_user_reported ? `<span class="cne-reported-label">Reported</span>` : ''}
        <button class="cne-close">&times;</button>
      </div>
      <div class="cne-popover-body">
        <p>${linkify(escapeHtml(note.body).replace(/\n/g, '<br>'))}</p>
        ${note.edited_at ? `<span class="cne-edited-label">edited</span>` : ''}
        ${note.ai_generated ? `<span class="cne-ai-label" title="${escapeHtml(note.ai_model || '')}">AI-generated</span>` : ''}
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
      ${canRate && !isOwner ? `<div class="cne-popover-footer">
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

    // Add transparency panel after status section
    const statusEl = popover.querySelector('.cne-popover-status');
    if (statusEl) {
      statusEl.insertAdjacentHTML('afterend', buildTransparencyPanel(note));
    }

    // Wire up Why button
    const whyBtn = popover.querySelector('.cne-why-btn');
    if (whyBtn) {
      whyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const panel = popover.querySelector('.cne-transparency');
        if (panel) {
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    // Wire up status history link
    const historyLink = popover.querySelector('.cne-history-link');
    if (historyLink) {
      historyLink.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const timelineEl = popover.querySelector('.cne-status-timeline');
        if (timelineEl.children.length > 0) {
          timelineEl.style.display = timelineEl.style.display === 'none' ? 'block' : 'none';
          return;
        }
        historyLink.textContent = 'Loading...';
        const changes = await chrome.runtime.sendMessage({ type: 'GET_STATUS_HISTORY', noteId: note.id });
        historyLink.textContent = 'View status history';
        if (Array.isArray(changes) && changes.length > 0) {
          timelineEl.innerHTML = buildStatusTimeline(changes);
          timelineEl.style.display = 'block';
        } else {
          timelineEl.innerHTML = '<p class="cne-timeline-empty">No status changes yet.</p>';
          timelineEl.style.display = 'block';
        }
      });
    }

    // Clamp vertical overflow for side-positioned popovers
    if (position.placement !== "below") {
      const popoverRect = popover.getBoundingClientRect();
      const overflow = popoverRect.bottom - window.innerHeight;
      if (overflow > 0) {
        popover.style.top = `${Math.max(window.scrollY, position.top - overflow - GAP)}px`;
      }
    }

    trackScrollPosition(popover, () => anchor.getBoundingClientRect());

    popover
      .querySelector(".cne-close")
      .addEventListener("click", () => dismissPopover(popover));

    // ── Share button handler ──
    const shareBtn = popover.querySelector(".cne-share-btn");
    if (shareBtn) {
      shareBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const shortUrl = `${apiBase}${note.short_url}`;
        try {
          await navigator.clipboard.writeText(shortUrl);
          const label = document.createElement("span");
          label.className = "cne-copied-label";
          label.textContent = "Copied!";
          shareBtn.after(label);
          setTimeout(() => label.remove(), 1500);
        } catch {
          // Fallback for contexts where clipboard API is unavailable
          prompt("Copy this link:", shortUrl);
        }
      });
    }

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
          body.innerHTML = `<p>${linkify(escapeHtml(note.body).replace(/\n/g, '<br>'))}</p>`;
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
            body.innerHTML = `<p>${linkify(escapeHtml(note.body).replace(/\n/g, '<br>'))}</p>`;
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

          // Refresh transparency panel if data available
          if (result.transparency) {
            note.transparency = result.transparency;
            const oldPanel = popover.querySelector('.cne-transparency');
            if (oldPanel) {
              const wasVisible = oldPanel.style.display !== 'none';
              const statusEl2 = popover.querySelector('.cne-popover-status');
              oldPanel.remove();
              statusEl2.insertAdjacentHTML('afterend', buildTransparencyPanel(note));
              const newPanel = popover.querySelector('.cne-transparency');
              if (newPanel && wasVisible) newPanel.style.display = 'block';
              // Re-wire why button
              const whyBtn2 = popover.querySelector('.cne-why-btn');
              if (whyBtn2) {
                whyBtn2.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                  const p = popover.querySelector('.cne-transparency');
                  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
                });
              }
            }
          }
        }
      });
    });

    function onClickOutside(e) {
      if (!popover.contains(e.target) && !anchor.contains(e.target)) {
        dismissPopover(popover, () => {
          document.removeEventListener("click", onClickOutside, true);
        });
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
    addNoteButton.textContent = "+ Note";
    addNoteButton.style.top = `${window.scrollY + rect.top}px`;
    addNoteButton.style.left = `${window.scrollX + rect.right + 6}px`;

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
    // Allow multiple forms to stay open — don't remove existing ones

    let aiDraft = null;
    const formId = `cne-form-${Date.now()}`;

    const form = document.createElement("div");
    form.className = "cne-note-form";
    form.innerHTML = `
      <div class="cne-form-header">
        <strong>Add Community Note</strong>
        <span class="cne-info-icon">&#x24D8;<span class="cne-info-tooltip"><strong>Tips for writing a good note:</strong><ul><li>Cite high-quality, trustworthy sources</li><li>Be accurate, specific, and up to date</li><li>Provide important context others may be missing</li><li>Write clearly and concisely</li><li>Be neutral and non-inflammatory</li><li>Consider whether people across different viewpoints would find it useful</li></ul></span></span>
        ${canRequestAiNotes ? '<button class="cne-ai-draft-btn">AI Context</button>' : ''}
        <button class="cne-close">&times;</button>
      </div>
      <textarea class="cne-form-textarea" placeholder="Add context and link to trustworthy sources..." rows="4"></textarea>
      <div class="cne-source-check">
        <p class="cne-source-question">Did you link to sources you believe most people would consider trustworthy?</p>
        <label class="cne-radio-label">
          <input type="radio" name="${formId}-sources" value="true" class="cne-radio" />
          Yes
        </label>
        <label class="cne-radio-label">
          <input type="radio" name="${formId}-sources" value="false" class="cne-radio" />
          No
        </label>
      </div>
      <div class="cne-form-actions">
        <button class="cne-form-cancel">Cancel</button>
        <button class="cne-form-submit">Submit Note</button>
      </div>
    `;

    // Insert an invisible anchor marker at the selection position for scroll tracking
    const marker = document.createElement("span");
    marker.className = "cne-form-marker";
    marker.style.cssText = "display:inline;width:0;height:0;overflow:hidden;position:relative;";
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        r.collapse(false);
        r.insertNode(marker);
      }
    } catch { /* selection may be gone */ }

    const getFormAnchorRect = () => {
      if (marker.isConnected) return marker.getBoundingClientRect();
      return rect;
    };

    const formPosition = computePopoverPosition(getFormAnchorRect());
    form.style.top = `${formPosition.top}px`;
    form.style.left = `${formPosition.left}px`;
    form.dataset.placement = formPosition.placement;

    document.body.appendChild(form);
    trackScrollPosition(form, getFormAnchorRect);

    // Clean up marker when form is removed
    const origRemove = form.remove.bind(form);
    form.remove = () => { if (marker.isConnected) marker.remove(); origRemove(); };

    const textarea = form.querySelector(".cne-form-textarea");
    textarea.addEventListener("input", () => autoResizeTextarea(textarea));
    textarea.focus();

    // AI Context button handler
    const aiBtn = form.querySelector(".cne-ai-draft-btn");
    if (aiBtn) {
      aiBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        aiBtn.disabled = true;
        aiBtn.textContent = "Generating...";

        // Create or reuse preview area
        let previewArea = form.querySelector(".cne-ai-preview");
        if (!previewArea) {
          previewArea = document.createElement("div");
          previewArea.className = "cne-ai-preview";
          previewArea.innerHTML = `
            <div class="cne-ai-preview-text"></div>
            <div class="cne-ai-preview-actions" style="display:none;">
              <button class="cne-ai-use-draft">Use this draft</button>
            </div>
          `;
          textarea.parentNode.insertBefore(previewArea, textarea);
        }

        const previewText = previewArea.querySelector(".cne-ai-preview-text");
        const previewActions = previewArea.querySelector(".cne-ai-preview-actions");
        previewText.textContent = "";
        previewActions.style.display = "none";
        previewArea.style.display = "none";

        const result = await chrome.runtime.sendMessage({
          type: "GENERATE_AI_DRAFT",
          selectedText,
          url: window.location.href,
          surroundingText: context.textPrefix + context.textSuffix,
        });

        if (result && !result.error) {
          aiDraft = { aiModel: result.model };

          // Stream text word by word
          const words = result.body.split(/(\s+)/);
          let i = 0;
          function showNextWord() {
            if (i < words.length) {
              if (i === 0) previewArea.style.display = "block";
              previewText.textContent += words[i];
              i++;
              requestAnimationFrame(showNextWord);
            } else {
              // Done streaming — show action button
              previewActions.style.display = "flex";
              aiBtn.textContent = "Regenerate";
              aiBtn.disabled = false;
            }
          }
          showNextWord();

          // Wire up "Use this draft" button
          const useBtn = previewActions.querySelector(".cne-ai-use-draft");
          useBtn.onclick = () => {
            textarea.value = result.body;
            autoResizeTextarea(textarea);
            previewArea.style.display = "none";
            textarea.focus();
          };
        } else {
          previewText.textContent = result?.error || "Failed to generate AI draft.";
          previewText.classList.add("cne-ai-preview-error");
          aiBtn.textContent = "AI Context";
          aiBtn.disabled = false;
        }
      });
    }

    function confirmClose() {
      if (textarea.value.trim()) {
        let bar = form.querySelector(".cne-confirm-discard");
        if (bar) return; // already showing
        bar = document.createElement("div");
        bar.className = "cne-confirm-discard";
        bar.innerHTML = `
          <span>Discard your note?</span>
          <button class="cne-discard-yes" type="button">Discard</button>
          <button class="cne-discard-no" type="button">Keep editing</button>
        `;
        form.querySelector(".cne-form-actions").before(bar);
        bar.querySelector(".cne-discard-yes").addEventListener("click", () => form.remove());
        bar.querySelector(".cne-discard-no").addEventListener("click", () => {
          bar.remove();
          textarea.focus();
        });
      } else {
        form.remove();
      }
    }

    form
      .querySelector(".cne-close")
      .addEventListener("click", confirmClose);
    form
      .querySelector(".cne-form-cancel")
      .addEventListener("click", confirmClose);

    form
      .querySelector(".cne-form-submit")
      .addEventListener("click", async () => {
        const body = textarea.value.trim();
        if (!body) return;

        const sourcesRadio = form.querySelector(`input[name="${formId}-sources"]:checked`);
        if (!sourcesRadio || sourcesRadio.value !== "true") {
          const sourceCheck = form.querySelector(".cne-source-check");
          sourceCheck.classList.add("cne-source-check-error");
          return;
        }

        const submitBtn = form.querySelector(".cne-form-submit");
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        const sourcesLinked = true;

        const notePayload = {
            url: window.location.href,
            body,
            selected_text: selectedText,
            text_prefix: context.textPrefix,
            text_suffix: context.textSuffix,
            css_selector: context.cssSelector,
            sources_linked: sourcesLinked,
        };
        if (aiDraft) {
          notePayload.ai_generated = true;
          notePayload.ai_model = aiDraft.aiModel;
        }

        const result = await chrome.runtime.sendMessage({
          type: "CREATE_NOTE",
          note: notePayload,
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

  function buildTransparencyPanel(note) {
    const t = note.transparency;
    if (!t) return '';

    let explanation = '';
    if (note.status === 'helpful') {
      explanation = 'This note is rated helpful because it received enough positive ratings with a strong consensus.';
    } else if (note.status === 'not_helpful') {
      explanation = 'This note is rated not helpful because it received enough negative ratings with a strong consensus.';
    } else {
      explanation = 'This note needs more ratings before a status can be determined.';
    }

    return `
      <div class="cne-transparency" style="display:none;">
        <p class="cne-transparency-explanation">${explanation}</p>
        <div class="cne-transparency-section">
          <div class="cne-threshold-item">
            <span class="${t.meets_positive_threshold ? 'cne-threshold-check' : 'cne-threshold-cross'}">${t.meets_positive_threshold ? '&#x2713;' : '&#x2717;'}</span>
            <span>3+ positive ratings (${t.positive_progress}/3)</span>
            <div class="cne-progress-bar"><div class="cne-progress-fill cne-progress-green" style="width:${(t.positive_progress / 3) * 100}%"></div></div>
          </div>
          <div class="cne-threshold-item">
            <span class="${t.meets_helpful_ratio ? 'cne-threshold-check' : 'cne-threshold-cross'}">${t.meets_helpful_ratio ? '&#x2713;' : '&#x2717;'}</span>
            <span>2:1 positive-to-negative ratio</span>
          </div>
          <div class="cne-threshold-item">
            <span class="${t.meets_not_helpful_threshold ? 'cne-threshold-check' : 'cne-threshold-cross'}">${t.meets_not_helpful_threshold ? '&#x2713;' : '&#x2717;'}</span>
            <span>3+ negative ratings (${t.negative_progress}/3)</span>
            <div class="cne-progress-bar"><div class="cne-progress-fill cne-progress-red" style="width:${(t.negative_progress / 3) * 100}%"></div></div>
          </div>
          <div class="cne-threshold-item">
            <span class="${t.meets_not_helpful_ratio ? 'cne-threshold-check' : 'cne-threshold-cross'}">${t.meets_not_helpful_ratio ? '&#x2713;' : '&#x2717;'}</span>
            <span>2:1 negative-to-positive ratio</span>
          </div>
        </div>
        <div class="cne-transparency-counts">
          Positive: ${t.positive_count} &middot; Negative: ${note.not_helpful_count || 0} &middot; Total: ${t.total_ratings}
        </div>
        <a href="#" class="cne-history-link">View status history</a>
        <div class="cne-status-timeline" style="display:none;"></div>
      </div>
    `;
  }

  function buildStatusTimeline(changes) {
    return changes.map((c, i) => `
      <div class="cne-timeline-item">
        <div class="cne-timeline-dot"></div>
        <div class="cne-timeline-content">
          <span>${statusMiniLabel(c.from_status)}</span>
          <span class="cne-timeline-arrow">&rarr;</span>
          <span>${statusMiniLabel(c.to_status)}</span>
          <span class="cne-timeline-meta">
            ${c.helpful_count}&#x2191; ${c.somewhat_count}&#x2194; ${c.not_helpful_count}&#x2193;
            &middot; ${c.trigger}
            &middot; ${formatTimeAgo(c.changed_at)}
          </span>
        </div>
      </div>
    `).join('');
  }

  function statusMiniLabel(status) {
    const labels = {
      pending: ['Pending', 'cne-mini-pending'],
      helpful: ['Helpful', 'cne-mini-helpful'],
      not_helpful: ['Not Helpful', 'cne-mini-not-helpful']
    };
    const [text, cls] = labels[status] || ['Unknown', 'cne-mini-pending'];
    return `<span class="cne-mini-badge ${cls}">${text}</span>`;
  }

  function formatTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  function trackScrollPosition(el, getAnchorRect) {
    function reposition() {
      if (!el.isConnected) {
        window.removeEventListener("scroll", reposition, true);
        return;
      }
      const rect = getAnchorRect();
      const pos = computePopoverPosition(rect);
      el.style.top = `${pos.top}px`;
      el.style.left = `${pos.left}px`;
      el.dataset.placement = pos.placement;
    }
    window.addEventListener("scroll", reposition, true);
  }

  function autoResizeTextarea(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
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

  function handleDeeplink() {
    const hashMatch = window.location.hash.match(/cne-note=(\d+)/);
    if (!hashMatch) return;

    const noteId = parseInt(hashMatch[1]);
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const highlight = document.querySelector(`.cne-highlight[data-note-id="${noteId}"]`);
      if (highlight) {
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => showNotePopover(highlight, note), 500);
      }
    }
    // Clean up hash without triggering navigation
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // Initialize
  loadNotes().then(() => {
    maybeShowOnboarding();
    if (notes.length > 0) createSidebar();
    handleDeeplink();
  });
})();
