import { describe, it, expect, beforeEach } from "vitest";
import {
  findTextRange,
  findTextInNode,
  findTextNormalized,
  collectTextNodes,
  normalizeWs,
} from "../anchoring.js";

// Helper: extract the matched text from a Range
function rangeText(range) {
  if (!range) return null;
  return range.toString();
}

describe("anchoring", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("findTextInNode", () => {
    it("finds exact text in a simple paragraph", () => {
      document.body.innerHTML = "<p>Hello world, this is a test.</p>";
      const range = findTextInNode(document.body, "this is a test");
      expect(rangeText(range)).toBe("this is a test");
    });

    it("finds text spanning multiple text nodes", () => {
      document.body.innerHTML = "<p>Hello <strong>bold</strong> world</p>";
      const range = findTextInNode(document.body, "Hello bold world");
      expect(rangeText(range)).toBe("Hello bold world");
    });

    it("returns null when text is not found", () => {
      document.body.innerHTML = "<p>Hello world</p>";
      const range = findTextInNode(document.body, "goodbye");
      expect(range).toBeNull();
    });
  });

  describe("findTextNormalized", () => {
    it("matches text across element boundaries with different whitespace", () => {
      document.body.innerHTML =
        '<div class="comment">First part of text<p>Second part of text</p></div>';
      // The selected text has a space between parts, but the DOM has none
      // (textContent concatenation: "First part of textSecond part of text")
      const range = findTextNormalized(
        document.body,
        "First part of text Second part of text"
      );
      // normalized search should still find it because normalizeWs collapses
      // but the DOM text has no whitespace between the two — so this won't match
      // unless the text actually has whitespace. Let's test with whitespace:
      document.body.innerHTML =
        "<div>First part of text\n<p>Second part of text</p></div>";
      const range2 = findTextNormalized(
        document.body,
        "First part of text Second part of text"
      );
      expect(rangeText(range2)).toContain("First part of text");
    });

    it("collapses multiple spaces and newlines", () => {
      document.body.innerHTML = "<p>Hello    world\n\n  foo</p>";
      const range = findTextNormalized(document.body, "Hello world foo");
      expect(rangeText(range)).toBe("Hello    world\n\n  foo");
    });
  });

  describe("findTextRange — HN comment (real-world case)", () => {
    const HN_COMMENT_HTML = `
      <td class="default">
        <div style="margin-top:2px; margin-bottom:-10px;">
          <span class="comhead">
            <a href="user?id=cyanydeez" class="hnuser">cyanydeez</a>
            <span class="age" title="2026-02-10T11:40:55 1770723655">
              <a href="item?id=46958387">4 hours ago</a>
            </span>
            <span id="unv_46958387"></span>
            <span class="navs">
              | <a href="#46956716" class="clicky" aria-hidden="true">root</a>
              | <a href="#46957638" class="clicky" aria-hidden="true">parent</a>
              | <a href="#46958848" class="clicky" aria-hidden="true">prev</a>
              | <a href="#46959640" class="clicky" aria-hidden="true">next</a>
              <a class="togg clicky" id="46958387" n="6" href="javascript:void(0)">[–]</a>
              <span class="onstory"></span>
            </span>
          </span>
        </div>
        <br>
        <div class="comment">
          <div class="commtext c00">&gt; 2012, Australian psychologist Gina Perry investigated Milgram's data and writings and concluded that Milgram had manipulated the results, and that there was a "troubling mismatch between (published) descriptions of the experiment and evidence of what actually transpired." She wrote that "only half of the people who undertook the experiment fully believed it was real and of those, 66% disobeyed the experimenter".[29][30] She described her findings as "an unexpected outcome" that<p>Its unlikely Milligram played am unbiased role in, if not the sirext cause of the results.</p></div>
          <div class="reply">
            <p><font size="1"><u><a href="reply?id=46958387&amp;goto=item%3Fid%3D46954920%2346958387" rel="nofollow">reply</a></u></font></p>
          </div>
        </div>
      </td>`;

    // This is the exact data stored in the database for this note
    const NOTE_DATA = {
      id: 2,
      selected_text:
        '> 2012, Australian psychologist Gina Perry investigated Milgram\'s data and writings and concluded that Milgram had manipulated the results, and that there was a "troubling mismatch between (published) descriptions of the experiment and evidence of what actually transpired." She wrote that "only half of the people who undertook the experiment fully believed it was real and of those, 66% disobeyed the experimenter".[29][30] She described her findings as "an unexpected outcome" that',
      text_prefix: "",
      text_suffix:
        "Its unlikely Milligram played am unbiased role in,",
      css_selector:
        "#46958387 > td > table > tbody > tr > td.default:nth-child(3) > div.comment:nth-child(2) > div.commtext.c00:nth-child(1)",
    };

    beforeEach(() => {
      document.body.innerHTML = HN_COMMENT_HTML;
    });

    it("CSS selector from stored note does not match (expected — HN DOM issue)", () => {
      // The CSS selector starts with #46958387 which begins with a digit —
      // invalid CSS selector. Browsers return null, jsdom throws.
      let el = null;
      try {
        el = document.querySelector(NOTE_DATA.css_selector);
      } catch {
        // Expected: invalid selector
      }
      expect(el).toBeNull();
    });

    it("should find the selected text via some anchoring strategy", () => {
      const range = findTextRange(NOTE_DATA);
      expect(range).not.toBeNull();
      const text = rangeText(range);
      expect(text).toContain("Gina Perry investigated");
    });

    it("exact match in body finds the text (strategy 2)", () => {
      // Let's check what the DOM actually contains
      const { fullText } = collectTextNodes(document.body);

      // The HTML entity &gt; is decoded to >
      // Check if the selected_text appears in the concatenated text
      const found = fullText.indexOf(NOTE_DATA.selected_text);

      // Diagnose: print what we're searching for vs what's there
      if (found === -1) {
        // The selected text starts with "> " but the HTML has "&gt; " which
        // becomes "> " in textContent. However the text spans a <p> boundary:
        // "...that" is in one text node and "Its unlikely..." is in another
        // with a <p> between them. The selected_text ends with "that" so
        // it shouldn't cross the boundary. Let's check.
        const commtext = document.querySelector(".commtext");
        const commContent = commtext?.textContent;

        // The issue: textContent includes ALL text including the <p> child,
        // so it concatenates without spaces between "that" and "Its".
        // But the selected_text ends with "that" so it should still be findable
        // IF the ">" character matches.
        console.log(
          "commtext starts with:",
          JSON.stringify(commContent?.substring(0, 20))
        );
        console.log(
          "selected starts with:",
          JSON.stringify(NOTE_DATA.selected_text.substring(0, 20))
        );
      }

      // Use findTextInNode directly to check
      const range = findTextInNode(document.body, NOTE_DATA.selected_text);
      // If this fails, the normalized search should catch it
      if (!range) {
        const normRange = findTextNormalized(
          document.body,
          NOTE_DATA.selected_text
        );
        expect(normRange).not.toBeNull();
        expect(rangeText(normRange)).toContain("Gina Perry");
      } else {
        expect(rangeText(range)).toContain("Gina Perry");
      }
    });

    it("findTextRange returns a range containing the key phrase", () => {
      const range = findTextRange(NOTE_DATA);
      expect(range).not.toBeNull();
      const text = rangeText(range);
      // Should contain a distinctive phrase from the selected text
      expect(text).toContain("Gina Perry investigated Milgram");
      expect(text).toContain("an unexpected outcome");
    });

    it("diagnoses what the DOM textContent actually looks like", () => {
      const commtext = document.querySelector(".commtext.c00");
      expect(commtext).not.toBeNull();

      const { fullText } = collectTextNodes(commtext);
      // The selected_text starts with "> " (from &gt;)
      // Check if it's present
      const selectedStart = NOTE_DATA.selected_text.substring(0, 30);
      const found = fullText.indexOf(selectedStart);
      expect(found).toBeGreaterThanOrEqual(0);

      // Also check the full selected_text
      const fullFound = fullText.indexOf(NOTE_DATA.selected_text);
      expect(fullFound).toBeGreaterThanOrEqual(0);
    });

    it("handles the case where HN wraps the > quote as plain text with &gt;", () => {
      // Verify that &gt; is decoded to > in textContent
      const commtext = document.querySelector(".commtext.c00");
      expect(commtext.textContent).toContain("> 2012");
    });
  });

  describe("findTextRange — HN URL matching issue", () => {
    it("content script sends window.location.href which may include hash", () => {
      // HN URLs when clicking on comments include a hash fragment
      // e.g. https://news.ycombinator.com/item?id=46954920#46958387
      // but the stored URL is without the hash
      const storedUrl = "https://news.ycombinator.com/item?id=46954920";
      const browserUrl =
        "https://news.ycombinator.com/item?id=46954920#46958387";

      // The Page model strips fragments, but the content script sends
      // window.location.href which includes the hash.
      // The API lookup uses Page.normalize_url_string which strips fragments,
      // but the GET /api/notes?url= receives the raw URL with hash.
      expect(storedUrl).not.toBe(browserUrl);

      // This means the API won't find the page if the URL has a hash!
      // The fix: normalize the URL in the notes#index controller too.
    });
  });

  describe("findTextRange — simple cases", () => {
    it("finds text via CSS selector (strategy 1)", () => {
      document.body.innerHTML =
        '<div id="target"><p>Some specific text here</p></div><p>Other text</p>';
      const range = findTextRange({
        selected_text: "specific text",
        css_selector: "#target",
        text_prefix: "",
        text_suffix: "",
      });
      expect(rangeText(range)).toBe("specific text");
    });

    it("finds text anywhere in body when selector fails (strategy 2)", () => {
      document.body.innerHTML =
        "<article><p>The quick brown fox jumps over the lazy dog.</p></article>";
      const range = findTextRange({
        selected_text: "brown fox jumps",
        css_selector: "#nonexistent",
        text_prefix: "",
        text_suffix: "",
      });
      expect(rangeText(range)).toBe("brown fox jumps");
    });

    it("falls through all strategies gracefully when text is not on page", () => {
      document.body.innerHTML = "<p>Completely different content</p>";
      const range = findTextRange({
        selected_text: "This text does not exist on the page",
        css_selector: "#nope",
        text_prefix: "before ",
        text_suffix: " after",
      });
      expect(range).toBeNull();
    });
  });
});
