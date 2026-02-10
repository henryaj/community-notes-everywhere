// Text anchoring module — finds and highlights text on a page
// Exported for testing, consumed by content.js

export function normalizeWs(str) {
  return str.replace(/\s+/g, " ").trim();
}

// Collect text nodes from a DOM subtree
export function collectTextNodes(node) {
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

// Build a Range from a start/end index into concatenated text nodes
export function buildRange(textNodes, start, end) {
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

// Find text within a DOM node and return a Range (exact match)
export function findTextInNode(node, searchText) {
  if (!searchText) return null;

  const { fullText, textNodes } = collectTextNodes(node);
  const index = fullText.indexOf(searchText);
  if (index === -1) return null;

  return buildRange(textNodes, index, index + searchText.length);
}

// Find text with normalized whitespace — collapses whitespace in both
// the page text and search text, then maps back to original positions
export function findTextNormalized(node, searchText) {
  if (!searchText) return null;

  const { fullText, textNodes } = collectTextNodes(node);

  // Build a mapping from normalized-index → original-index
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

// Find text using surrounding context
export function findTextWithContext(text, prefix, suffix) {
  const bodyText = document.body.innerText || document.body.textContent;
  const searchString = (prefix || "") + text + (suffix || "");

  // Try exact match first
  let index = bodyText.indexOf(searchString);
  if (index !== -1) {
    const textStart = index + (prefix || "").length;
    return findTextInNode(
      document.body,
      bodyText.substring(textStart, textStart + text.length)
    );
  }

  // Try normalized whitespace match
  const normBody = normalizeWs(bodyText);
  const normSearch = normalizeWs(searchString);
  index = normBody.indexOf(normSearch);
  if (index !== -1) {
    return findTextNormalized(document.body, text);
  }

  return null;
}

// Main entry point: find the text range for a note using anchoring strategy
export function findTextRange(note) {
  // Strategy 1: Try to find in specific CSS selector
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

  // Strategy 2: Find exact text anywhere in the document
  const exactRange = findTextInNode(document.body, note.selected_text);
  if (exactRange) return exactRange;

  // Strategy 3: Fuzzy match using prefix/suffix context
  if (note.text_prefix || note.text_suffix) {
    const contextRange = findTextWithContext(
      note.selected_text,
      note.text_prefix,
      note.text_suffix
    );
    if (contextRange) return contextRange;
  }

  // Strategy 4: Normalized whitespace search — handles text that spans
  // multiple elements where browsers insert whitespace differently
  const normalizedRange = findTextNormalized(document.body, note.selected_text);
  if (normalizedRange) return normalizedRange;

  return null;
}
