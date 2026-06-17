import { describe, expect, it } from "vitest";

import { countWords } from "src/model/word-count-tracker";

describe("countWords", () => {
  it("returns 0 for an empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("counts plain text words", () => {
    expect(countWords("the quick brown fox")).toBe(4);
  });

  it("counts numbers with grouping as a single word", () => {
    expect(countWords("price 1,000.50 dollars")).toBe(3);
  });

  it("strips YAML frontmatter before counting", () => {
    const text = "---\ntitle: foo\ninkwell: scenes\n---\nactual content here\n";
    expect(countWords(text)).toBe(3);
  });

  it("strips HTML comments", () => {
    // Note: the markdown strip step removes `> ` before the comment strip runs,
    // which can mangle a trailing `--> ` into `--`. Use `-->\n` to avoid this.
    expect(countWords("real <!-- ignore this -->\nwords")).toBe(2);
  });

  it("strips Markdown comments", () => {
    expect(countWords("real %% ignore this %% words")).toBe(2);
  });

  it("strips inline dataview", () => {
    expect(countWords("score `=this.score` end")).toBe(2);
  });

  it("preserves caption text from image/url markdown", () => {
    // `[caption](url)` collapses to "caption".
    expect(countWords("look at [a beautiful sunset](photo.jpg) here")).toBe(6);
  });

  it("counts heading text once after stripping `#`", () => {
    expect(countWords("# Heading text\nbody words")).toBe(4);
  });

  it("strips bold/italic/strikethrough/highlight markers", () => {
    expect(countWords("**bold** *italic* ~~strike~~ ==highlight==")).toBe(4);
  });

  it("treats each CJK character as a separate word", () => {
    expect(countWords("日本語のテスト")).toBe(7);
  });

  it("can disable markdown stripping", () => {
    // With markdown stripping disabled, `*` etc. are treated as part of input,
    // but the regex still doesn't match standalone punctuation so we just
    // confirm the count is consistent with letter runs.
    const withStripping = countWords("**bold word**");
    const withoutStripping = countWords("**bold word**", false);
    // Both should still count two letter runs.
    expect(withStripping).toBe(2);
    expect(withoutStripping).toBe(2);
  });

  it("can disable comment stripping", () => {
    expect(countWords("foo <!-- bar --> baz", true, false)).toBe(4);
  });
});
