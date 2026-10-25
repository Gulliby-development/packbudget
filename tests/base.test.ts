import { describe, expect, test } from "bun:test";
import { matchPart } from "../src/glob";
import { compilePattern, matchesAny, matchesPath, type Pattern } from "../src/pattern";
import { compare, isBlank, isDigit, points, shown, stripBlanks, table, tokens } from "../src/text";

describe("text", () => {
  test.each([
    ["abc", 3],
    ["", 0],
    ["a\u{1F600}b", 3],
    ["\u{1F600}\u{1F600}", 2],
  ])("points counts code points of %j", (text: string, count: number) => {
    expect(points(text).length).toBe(count);
  });

  test.each([
    ["\uFF5E", "\u{1F600}", -1],
    ["\u{1F600}", "\uFF5E", 1],
    ["a", "a", 0],
    ["", "", 0],
    ["a", "ab", -1],
    ["ab", "a", 1],
    ["a-b/x", "a/x", -1],
    ["B", "a", -1],
  ])("compare %j with %j has sign %d", (a: string, b: string, sign: number) => {
    expect(Math.sign(compare(a, b))).toBe(sign);
  });

  test.each([
    [0, 0],
    [1, 1],
    [4, 1],
    [5, 2],
    [8, 2],
    [9, 3],
  ])("tokens(%d) is %d", (count: number, expected: number) => {
    expect(tokens(count)).toBe(expected);
  });

  test.each([
    ["0", true],
    ["9", true],
    ["5", true],
    ["\u0663", false],
    ["a", false],
    ["/", false],
    [":", false],
    ["", false],
  ])("isDigit %j is %p", (ch: string, expected: boolean) => {
    expect(isDigit(ch)).toBe(expected);
  });

  test.each([
    [" ", true],
    ["\t", true],
    ["\u00a0", false],
    ["a", false],
    ["\n", false],
  ])("isBlank %j is %p", (ch: string, expected: boolean) => {
    expect(isBlank(ch)).toBe(expected);
  });

  test.each([
    ["  a b\t", "a b"],
    ["", ""],
    ["   ", ""],
    ["\u00a0a", "\u00a0a"],
    ["a", "a"],
    ["\t x \t", "x"],
  ])("stripBlanks %j gives %j", (text: string, expected: string) => {
    expect(stripBlanks(text)).toBe(expected);
  });

  test.each([
    ["a\tb", "a?b"],
    ["a\u007fb", "a?b"],
    ["a\nb", "a?b"],
    ["\u001f ", "? "],
    ["\u{1F600}\u00e9", "\u{1F600}\u00e9"],
    [" ~", " ~"],
  ])("shown %j gives %j", (text: string, expected: string) => {
    expect(shown(text)).toBe(expected);
  });

  test.each([
    [
      ["A", "BB"],
      [
        ["\u{1F600}", "x"],
        ["abc", "y"],
      ],
      "A    BB\n\u{1F600}    x\nabc  y\n",
    ],
    [["A", "B"], [["x", ""]], "A  B\nx\n"],
    [["H"], [], "H\n"],
  ])("table %j pads by code points", (header: string[], rows: string[][], expected: string) => {
    expect(table(header, rows)).toBe(expected);
  });
});

describe("glob", () => {
  test.each([
    ["a.txt", "a.txt", true],
    ["*.txt", "a.txt", true],
    ["*.txt", ".txt", true],
    ["*", "", true],
    ["?", "", false],
    ["?", "\u{1F600}", true],
    ["??", "\u{1F600}", false],
    ["?.txt", "A.txt", true],
    ["?.txt", "ab.txt", false],
    ["*.TXT", "a.txt", false],
    ["a*b*c", "axxbyyc", true],
    ["a*b*c", "axxbyy", false],
    ["*a", "ba", true],
    ["*a", "ab", false],
    ["a*", "a", true],
    ["", "", true],
    ["", "a", false],
    ["a?c", "a\u{1F600}c", true],
  ])("matchPart %j against %j is %p", (pattern: string, name: string, expected: boolean) => {
    expect(matchPart(pattern, name)).toBe(expected);
  });

  test.each([
    ["[a]", "[a]", true],
    ["[a]", "a", false],
    ["!x", "!x", true],
    ["a\\b", "a\\b", true],
    ["a\\b", "ab", false],
    ["**", "abc", true],
    ["**", "", true],
    ["a**b", "ab", true],
    ["a**b", "axyb", true],
    ["A", "a", false],
  ])("matchPart treats %j literally against %j: %p", (p: string, n: string, expected: boolean) => {
    expect(matchPart(p, n)).toBe(expected);
  });
});

describe("pattern", () => {
  test.each([
    ["a.txt", { parts: ["a.txt"], anchored: false, dirOnly: false }],
    ["/a.txt", { parts: ["a.txt"], anchored: true, dirOnly: false }],
    ["src/", { parts: ["src"], anchored: false, dirOnly: true }],
    ["src/*.ts", { parts: ["src", "*.ts"], anchored: true, dirOnly: false }],
    ["/gen/", { parts: ["gen"], anchored: true, dirOnly: true }],
    ["a/b/", { parts: ["a", "b"], anchored: true, dirOnly: true }],
    ["//", null],
    ["", null],
    ["/", null],
    ["a//b", null],
  ])("compilePattern %j", (text: string, expected: Pattern | null) => {
    expect(compilePattern(text)).toEqual(expected);
  });

  test.each([
    ["a.txt", "a.txt", true],
    ["a.txt", "src/a.txt", true],
    ["a.txt", "docs/a.txt/x", true],
    ["/a.txt", "a.txt", true],
    ["/a.txt", "src/a.txt", false],
    ["src/", "src/a.txt", true],
    ["src/", "src", false],
    ["gen/", "src/gen/c.ts", true],
    ["gen/", "gen", false],
    ["/gen/", "src/gen/c.ts", false],
    ["src/*.ts", "src/b.ts", true],
    ["src/*.ts", "src/gen/c.ts", false],
    ["src/g*", "src/gen/c.ts", true],
    ["docs/a.txt", "docs/a.txt/x", true],
    ["docs/a.txt", "docs", false],
    ["a.txt/", "docs/a.txt/x", true],
    ["a.txt/", "a.txt", false],
    ["a/b/", "a/b", false],
    ["a/b/", "a/b/c", true],
    ["build", "lib/build/p.js", true],
    ["?", "\u{1F600}/x", true],
    ["*.TXT", "a.txt", false],
  ])("matchesPath %j against %j is %p", (text: string, path: string, expected: boolean) => {
    const compiled = compilePattern(text);
    if (compiled === null) {
      throw new Error(`pattern did not compile: ${text}`);
    }
    expect(matchesPath(compiled, path)).toBe(expected);
  });

  test("matchesAny skips null patterns and needs one match", () => {
    expect(matchesAny([], "a")).toBe(false);
    expect(matchesAny([null], "a")).toBe(false);
    expect(matchesAny([compilePattern("//"), compilePattern("b")], "a/b")).toBe(true);
    expect(matchesAny([compilePattern("c")], "a/b")).toBe(false);
  });
});
