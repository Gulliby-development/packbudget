import { describe, expect, test } from "bun:test";
import { MemIo } from "../src/io";
import { readIgnoreFile, readRankFile, weightOf } from "../src/listfile";
import { parseArgs, USAGE } from "../src/options";
import { Failure } from "../src/text";

function failure(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof Failure ? error.message : "not a Failure";
  }
  return "no failure";
}

function ignoreLines(text: string): string[] {
  return readIgnoreFile(new MemIo({ i: text }), "i");
}

function rankWeights(text: string): number[] {
  return readRankFile(new MemIo({ r: text }), "r").map((rule) => rule.weight);
}

function rankWeightOf(text: string, path: string): number {
  return weightOf(readRankFile(new MemIo({ r: text }), "r"), path);
}

describe("readIgnoreFile", () => {
  test.each([
    ["# c\n\n  a.txt \t\n", ["a.txt"]],
    ["\u00a0x\n", ["\u00a0x"]],
    ["\uFEFFa\r\nb\r\n", ["a", "b"]],
    ["a\rb", ["a\rb"]],
    ["", []],
    ["a\n\n\n", ["a"]],
    [" #x\n", []],
    ["a b\n", ["a b"]],
    ["\t\t\n  \n", []],
  ])("text %j gives lines", (text, expected) => {
    expect(ignoreLines(text)).toEqual(expected);
  });

  test.each([
    ["absent", "absent: cannot read the file"],
    ["bin", "bin: file is not valid UTF-8"],
    ["nul", "nul: file is not valid UTF-8"],
    ["lone", "lone: file is not valid UTF-8"],
    ["unread", "unread: cannot read the file"],
    ["dir", "dir: cannot read the file"],
  ])("list file %j fails with %j", (path, message) => {
    const io = new MemIo({
      bin: new Uint8Array([0xff]),
      nul: "a\u0000b",
      lone: new Uint8Array([0xed, 0xa0, 0x80]),
      unread: "x",
      "dir/f": "x",
    });
    io.unreadable.add("unread");
    expect(failure(() => readIgnoreFile(io, path))).toBe(message);
    expect(failure(() => readRankFile(io, path))).toBe(message);
  });
});

describe("readRankFile", () => {
  test.each([
    ["5 a", [5]],
    ["5\ta b", [5]],
    ["0005 x", [5]],
    ["0 a", [0]],
    ["9999 a", [9999]],
    ["# c\n\n  7  /x  ", [7]],
    ["9 *.md\n2 *\n", [9, 2]],
    ["\uFEFF3 a\r\n4 b\r\n", [3, 4]],
    ["", []],
  ])("rank text %j gives weights %j", (text, expected) => {
    expect(rankWeights(text)).toEqual(expected);
  });

  test.each([
    ["12345 x", "r:1: expected WEIGHT PATTERN"],
    ["5", "r:1: expected WEIGHT PATTERN"],
    ["5 ", "r:1: expected WEIGHT PATTERN"],
    ["a 5", "r:1: expected WEIGHT PATTERN"],
    ["-1 a", "r:1: expected WEIGHT PATTERN"],
    ["5a", "r:1: expected WEIGHT PATTERN"],
    ["5\u00a0a", "r:1: expected WEIGHT PATTERN"],
    ["\u0663 a", "r:1: expected WEIGHT PATTERN"],
    ["1 a\n\nzz\n", "r:3: expected WEIGHT PATTERN"],
    ["# c\n2 b\r\n\r\nq\n", "r:4: expected WEIGHT PATTERN"],
  ])("rank text %j fails with %j", (text, message) => {
    expect(failure(() => readRankFile(new MemIo({ r: text }), "r"))).toBe(message);
  });

  test.each([
    ["9 README.md\n5 src/*.ts\n7 *\n", "README.md", 9],
    ["9 README.md\n5 src/*.ts\n7 *\n", "src/a.ts", 5],
    ["9 README.md\n5 src/*.ts\n7 *\n", "z.txt", 7],
    ["9 README.md\n5 src/*.ts\n7 *\n", "src/x.md", 7],
    ["7 *\n9 README.md\n", "README.md", 7],
    ["3 /x\n", "y", 0],
    ["3 /x\n", "x", 3],
    ["4 //\n", "a", 0],
    ["5 a b\n", "a b", 5],
    ["", "a", 0],
  ])("rank %j gives path %j weight %j", (text, path, expected) => {
    expect(rankWeightOf(text, path)).toBe(expected);
  });
});

describe("parseArgs", () => {
  test.each([
    [[], "missing command (pack or plan)"],
    [["list", "d"], "unknown command list"],
    [["--help", "x"], "unknown command --help"],
    [["pack"], "missing DIR"],
    [["pack", "d"], "missing --budget"],
    [["pack", "d", "--budget"], "--budget needs a value"],
    [["pack", "d", "--budget", "0"], "--budget needs a whole number of 1 or more, got 0"],
    [["pack", "d", "--budget", "0000"], "--budget needs a whole number of 1 or more, got 0000"],
    [["pack", "d", "--budget", "12x"], "--budget needs a whole number of 1 or more, got 12x"],
    [["pack", "d", "--budget", ""], "--budget needs a whole number of 1 or more, got "],
    [["pack", "d", "--budget", "\u0663"], "--budget needs a whole number of 1 or more, got \u0663"],
    [
      ["pack", "d", "--budget", "1234567890123456"],
      "--budget needs a whole number of 1 or more, got 1234567890123456",
    ],
    [["pack", "d", "--budget", "1", "--budget", "2"], "--budget given twice"],
    [["pack", "d", "--rank", "r", "--rank", "s", "--budget", "1"], "--rank given twice"],
    [["pack", "d", "--ignore-file", "a", "--ignore-file", "b"], "--ignore-file given twice"],
    [["pack", "d", "--budget", "1", "--ignore"], "--ignore needs a value"],
    [["pack", "d", "--budget", "1", "--color"], "unknown option --color"],
    [["pack", "d", "--budget=1"], "unknown option --budget=1"],
    [["pack", "d", "e", "--budget", "1"], "unexpected argument e"],
    [["pack", "--color"], "unknown option --color"],
    [["pack", "d", "--color", "--budget"], "unknown option --color"],
    [["pack", "d", "--budget", "x", "--color"], "unknown option --color"],
    [["plan", "--budget", "x"], "missing DIR"],
    [["plan", "d", "--budget", "x", "--ignore"], "--ignore needs a value"],
  ])("arguments %j fail with %j", (argv, message) => {
    expect(failure(() => parseArgs(argv))).toBe(message);
  });

  test.each([
    [
      ["pack", "d", "--budget", "999999999999999"],
      { dir: "d", budget: 999999999999999, command: "pack", ignores: [] },
    ],
    [["plan", "-", "--budget", "007"], { dir: "-", budget: 7, command: "plan", ignores: [] }],
    [["pack", "-x", "--budget", "1"], { dir: "-x", budget: 1, command: "pack", ignores: [] }],
    [
      ["pack", "d", "--budget", "1", "--ignore", "--budget"],
      { dir: "d", budget: 1, command: "pack", ignores: ["--budget"] },
    ],
    [
      ["pack", "d", "--ignore", "a", "--ignore", " b ", "--budget", "1"],
      { dir: "d", budget: 1, command: "pack", ignores: ["a", " b "] },
    ],
    [["plan", "--budget", "5", "d"], { dir: "d", budget: 5, command: "plan", ignores: [] }],
    [
      ["pack", "d", "--budget", "1", "--ignore", ""],
      { dir: "d", budget: 1, command: "pack", ignores: [""] },
    ],
  ])("arguments %j parse", (argv, expected) => {
    expect(parseArgs(argv)).toMatchObject({
      kind: "run",
      rank: null,
      ignoreFile: null,
      ...expected,
    });
  });

  test("rank and ignore file are kept and help is recognised", () => {
    expect(parseArgs(["plan", "d", "--rank", "r", "--ignore-file", "i", "--budget", "2"])).toEqual({
      kind: "run",
      command: "plan",
      dir: "d",
      budget: 2,
      rank: "r",
      ignores: [],
      ignoreFile: "i",
    });
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
    expect(USAGE).toBe(
      "usage: packbudget pack DIR --budget N [--rank FILE] [--ignore PATTERN]... [--ignore-file FILE]\n" +
        "       packbudget plan DIR --budget N [--rank FILE] [--ignore PATTERN]... [--ignore-file FILE]\n" +
        "       packbudget --help\n",
    );
  });
});
