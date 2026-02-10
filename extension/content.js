// content.js — injected into pages, handles highlights + note display
// Anchoring logic lives in anchoring.js (imported at build time for tests,
// but since Chrome content scripts don't support ES modules, we inline it here
// and also export from anchoring.js for testing).

(() => {
  // Avoid running in iframes or contexts where extension APIs aren't available
  if (window !== window.top) return;
  if (!chrome?.runtime?.sendMessage) return;

  let notes = [];
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
    const response = await chrome.runtime.sendMessage({
      type: "GET_NOTES",
      url: window.location.href,
    });

    if (Array.isArray(response)) {
      notes = response;
      highlightNotes();
    }
  }

  function highlightNotes() {
    document.querySelectorAll(".cne-highlight").forEach((el) => el.remove());

    notes.forEach((note) => {
      const range = findTextRange(note);
      if (range) {
        wrapRangeWithHighlight(range, note);
      }
    });
  }

  function wrapRangeWithHighlight(range, note) {
    const highlight = document.createElement("span");
    highlight.className = "cne-highlight";
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

  function showNotePopover(anchor, note) {
    document.querySelectorAll(".cne-popover").forEach((el) => el.remove());

    const popover = document.createElement("div");
    popover.className = "cne-popover";
    popover.innerHTML = `
      <div class="cne-popover-header">
        <img src="${escapeHtml(note.author.avatar_url || "")}" class="cne-avatar" alt="" />
        <div class="cne-author-info">
          <strong>${escapeHtml(note.author.display_name)}</strong>
          <span class="cne-handle">@${escapeHtml(note.author.handle)}</span>
        </div>
        <button class="cne-close">&times;</button>
      </div>
      <div class="cne-popover-body">
        <p>${linkify(escapeHtml(note.body))}</p>
      </div>
      <div class="cne-popover-footer">
        <span class="cne-status cne-status-${note.status}">${note.status}</span>
        <div class="cne-rating-buttons">
          <button class="cne-rate-btn cne-rate-helpful" data-note-id="${note.id}" data-helpful="true">
            &#x1F44D; ${note.helpful_count}
          </button>
          <button class="cne-rate-btn cne-rate-not-helpful" data-note-id="${note.id}" data-helpful="false">
            &#x1F44E; ${note.not_helpful_count}
          </button>
        </div>
      </div>
    `;

    const rect = anchor.getBoundingClientRect();
    popover.style.top = `${window.scrollY + rect.bottom + 8}px`;
    popover.style.left = `${window.scrollX + rect.left}px`;

    document.body.appendChild(popover);

    popover
      .querySelector(".cne-close")
      .addEventListener("click", () => popover.remove());

    popover.querySelectorAll(".cne-rate-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const helpful = btn.dataset.helpful === "true";
        const result = await chrome.runtime.sendMessage({
          type: "RATE_NOTE",
          noteId: parseInt(btn.dataset.noteId),
          helpful,
        });

        if (result && !result.error) {
          popover.querySelector(
            ".cne-rate-helpful"
          ).innerHTML = `&#x1F44D; ${result.note.helpful_count}`;
          popover.querySelector(
            ".cne-rate-not-helpful"
          ).innerHTML = `&#x1F44E; ${result.note.not_helpful_count}`;
        }
      });
    });

    document.addEventListener(
      "click",
      (e) => {
        if (!popover.contains(e.target) && !anchor.contains(e.target)) {
          popover.remove();
        }
      },
      { once: true }
    );
  }

  document.addEventListener("mouseup", (e) => {
    if (e.target.closest(".cne-popover, .cne-add-note-btn, .cne-note-form"))
      return;

    removeAddNoteButton();

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

        const result = await chrome.runtime.sendMessage({
          type: "CREATE_NOTE",
          note: {
            url: window.location.href,
            body,
            selected_text: selectedText,
            text_prefix: context.textPrefix,
            text_suffix: context.textSuffix,
            css_selector: context.cssSelector,
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

  // Initialize
  loadNotes();
})();
