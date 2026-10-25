import { describe, expect, test } from "bun:test";
import { classify, decodeStrict, packText } from "../src/classify";
import { MemIo } from "../src/io";
import { compilePattern } from "../src/pattern";
import { buildPlan } from "../src/plan";
import { discover, joinPath } from "../src/walk";

const enc = new TextEncoder();

describe("MemIo", () => {
  test("list answers root, trailing slash and missing paths", () => {
    const io = new MemIo({ "a.txt": "x", "src/b.ts": "y", "empty/": "", n: null });
    const root = io.list(".") ?? [];
    expect(root).toHaveLength(4);
    expect(root).toEqual(
      expect.arrayContaining([
        { name: "src", kind: "dir" },
        { name: "empty", kind: "dir" },
        { name: "a.txt", kind: "file" },
        { name: "n", kind: "other" },
      ]),
    );
    expect(io.list("src/")).toEqual([{ name: "b.ts", kind: "file" }]);
    expect(io.list("./src")).toEqual([{ name: "b.ts", kind: "file" }]);
    expect(io.list("empty")).toEqual([]);
    expect(io.list("nope")).toBeNull();
    expect(io.list("a.txt")).toBeNull();
  });

  test("read, unreadable and accumulated output", () => {
    const io = new MemIo({ "a.txt": "hi", "b.bin": new Uint8Array([255]), "d/c": "z", n: null });
    io.unreadable.add("d/c");
    expect(io.read("a.txt")).toEqual(enc.encode("hi"));
    expect(io.read("./a.txt")).toEqual(enc.encode("hi"));
    expect(io.read("b.bin")).toEqual(new Uint8Array([255]));
    expect(io.read("d")).toBeNull();
    expect(io.read("d/c")).toBeNull();
    expect(io.read("n")).toBeNull();
    expect(io.read("missing")).toBeNull();
    io.out("one");
    io.out("two");
    io.err("e1");
    io.err("e2");
    expect(io.stdout).toBe("onetwo");
    expect(io.stderr).toBe("e1e2");
  });
});

describe("classify", () => {
  test.each([
    ["ascii", new Uint8Array([0x68, 0xc3, 0xa9]), "h\u00e9"],
    ["emoji", new Uint8Array([0xf0, 0x9f, 0x98, 0x80]), "\u{1F600}"],
    ["empty", new Uint8Array([]), ""],
    ["nul", new Uint8Array([0]), null],
    ["truncated", new Uint8Array([0xe2, 0x82]), null],
    ["lone continuation", new Uint8Array([0x80]), null],
    ["overlong three bytes", new Uint8Array([0xe0, 0x80, 0x80]), null],
    ["above U+10FFFF", new Uint8Array([0xf4, 0x90, 0x80, 0x80]), null],
    ["surrogate", new Uint8Array([0xed, 0xa0, 0x80]), null],
  ])("decodeStrict %s", (_name, bytes, expected) => {
    expect(decodeStrict(bytes)).toBe(expected);
  });

  test.each([
    ["empty", enc.encode(""), "text", 0],
    ["abc", enc.encode("abc"), "text", 1],
    ["abcd", enc.encode("abcd"), "text", 2],
    ["abc LF", enc.encode("abc\n"), "text", 1],
    ["abc LF LF", enc.encode("abc\n\n"), "text", 2],
    ["CR LF twice", enc.encode("a\r\nb\r\n"), "text", 1],
    ["lone CR", enc.encode("a\rb"), "text", 1],
    ["BOM abc", enc.encode("\uFEFFabc"), "text", 1],
    ["two BOM x", enc.encode("\uFEFF\uFEFFx"), "text", 1],
    ["BOM only", enc.encode("\uFEFF"), "text", 0],
    ["three emoji", enc.encode("\u{1F600}\u{1F600}\u{1F600}"), "text", 1],
    ["NUL inside", new Uint8Array([0x61, 0, 0x62]), "binary", -1],
    ["raw xFF", new Uint8Array([0x61, 0x62, 0xff]), "binary", -1],
    ["surrogate", new Uint8Array([0xed, 0xa0, 0x80]), "binary", -1],
    ["overlong", new Uint8Array([0xc0, 0xaf]), "binary", -1],
  ])("rule 4 row %s", (_name, bytes, kind, count) => {
    const result = classify(bytes);
    expect<string>(result.kind).toBe(kind);
    expect(result.kind === "text" ? result.tokens : -1).toBe(count);
  });

  test.each([
    ["", ""],
    ["abc", "abc\n"],
    ["abc\n", "abc\n"],
    ["a\r\nb", "a\nb\n"],
    ["a\rb", "a\rb\n"],
    ["\uFEFF\uFEFFx", "\uFEFFx\n"],
    ["\uFEFF", ""],
    ["a\r\r\n", "a\r\n"],
  ])("packText %j", (input, expected) => {
    expect(packText(input)).toBe(expected);
  });
});

describe("walk", () => {
  test.each([
    ["d", "x", "d/x"],
    ["d/", "x", "d/x"],
    ["d\\", "x", "d\\x"],
    [".", "x", "./x"],
    ["/", "x", "/x"],
  ])("joinPath %j + %j", (dir, name, expected) => {
    expect(joinPath(dir, name)).toBe(expected);
  });

  test("discover skips .git folders and null entries, keeps a .git file", () => {
    const io = new MemIo({
      ".git/config": "x",
      "sub/.git/x": "x",
      "other/.git": "x",
      nul: null,
      "a-b/x": "x",
      "a/x": "x",
    });
    expect(discover(io, ".")).toEqual(["a-b/x", "a/x", "other/.git"]);
  });

  test("discover handles trailing slash, dot prefix and a missing folder", () => {
    const io = new MemIo({ "d/a.txt": "x", "d/sub/b.txt": "x" });
    expect(discover(io, "d/")).toEqual(["a.txt", "sub/b.txt"]);
    expect(discover(io, "./d")).toEqual(["a.txt", "sub/b.txt"]);
    expect(discover(io, "nope")).toEqual([]);
  });
});

describe("buildPlan", () => {
  test("unreadable, ignored and binary files are not candidates", () => {
    const io = new MemIo({
      "a.txt": "abcd",
      "u.txt": "zz",
      "x.log": "log",
      "b.bin": new Uint8Array([0xff]),
      n: null,
    });
    io.unreadable.add("u.txt");
    const plan = buildPlan(io, ".", [compilePattern("*.log")], [], 10);
    expect(plan.rows).toEqual([
      { path: "a.txt", status: "packed", tokens: 2, weight: 0, text: "abcd\n" },
      { path: "b.bin", status: "binary" },
      { path: "u.txt", status: "unreadable" },
      { path: "x.log", status: "ignored" },
    ]);
    expect([plan.packed, plan.leftOut, plan.used]).toEqual([1, 0, 2]);
  });

  test("rank weights: first match wins and none means 0", () => {
    const io = new MemIo({ "README.md": "x", "src/a.ts": "x", "z.txt": "x", "y.txt": "x" });
    const rules = [
      { weight: 9, pattern: compilePattern("README.md") },
      { weight: 5, pattern: compilePattern("src/*.ts") },
      { weight: 7, pattern: compilePattern("z*") },
    ];
    const ranked = buildPlan(io, ".", [], rules, 10);
    expect(ranked.rows.map((r) => [r.path, r.weight])).toEqual([
      ["README.md", 9],
      ["src/a.ts", 5],
      ["y.txt", 0],
      ["z.txt", 7],
    ]);
    const plain = buildPlan(io, ".", [], [], 10);
    expect(plain.rows.map((r) => r.weight)).toEqual([0, 0, 0, 0]);
  });

  test("budget fills in order and a smaller later file still fits", () => {
    const io = new MemIo({ a: "abcdefgh", b: "abcd", c: "ab" });
    const plan = buildPlan(io, ".", [], [], 3);
    expect(plan.rows.map((r) => r.status)).toEqual(["budget", "packed", "packed"]);
    expect([plan.packed, plan.leftOut, plan.used]).toEqual([2, 1, 3]);
  });
});
