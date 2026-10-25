import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/cli";
import { MemIo } from "../src/io";

function tree(): MemIo {
  return new MemIo({
    "d/a.txt": "a\n",
    "d/b.txt": "b\n",
    "rank.txt": "1 a\n\nzz\n",
    "bin.dat": new Uint8Array([0xff]),
    r: "1 a\n",
    s: "1 a\n",
  });
}

describe("cli argument errors", () => {
  test.each([
    [[], "packbudget: missing command (pack or plan)\n"],
    [["list", "d"], "packbudget: unknown command list\n"],
    [["--help", "x"], "packbudget: unknown command --help\n"],
    [["pack"], "packbudget: missing DIR\n"],
    [["pack", "d"], "packbudget: missing --budget\n"],
    [["pack", "d", "--budget"], "packbudget: --budget needs a value\n"],
    [
      ["pack", "d", "--budget", "0"],
      "packbudget: --budget needs a whole number of 1 or more, got 0\n",
    ],
    [
      ["pack", "d", "--budget", "12x"],
      "packbudget: --budget needs a whole number of 1 or more, got 12x\n",
    ],
    [["pack", "d", "--budget", "1", "--budget", "2"], "packbudget: --budget given twice\n"],
    [
      ["pack", "d", "--rank", "r", "--rank", "s", "--budget", "1"],
      "packbudget: --rank given twice\n",
    ],
    [["pack", "d", "--budget", "1", "--ignore"], "packbudget: --ignore needs a value\n"],
    [["pack", "d", "--budget", "1", "--color"], "packbudget: unknown option --color\n"],
    [["pack", "d", "--budget=1"], "packbudget: unknown option --budget=1\n"],
    [["pack", "d", "e", "--budget", "1"], "packbudget: unexpected argument e\n"],
    [["pack", "nope", "--budget", "1"], "packbudget: nope: not a directory\n"],
    [["pack", "a\tb", "--budget", "1"], "packbudget: a?b: not a directory\n"],
    [
      ["pack", "d", "--budget", "1", "--ignore-file", "nope.txt"],
      "packbudget: nope.txt: cannot read the file\n",
    ],
    [
      ["pack", "d", "--budget", "1", "--ignore-file", "bin.dat"],
      "packbudget: bin.dat: file is not valid UTF-8\n",
    ],
    [
      ["pack", "d", "--budget", "1", "--rank", "rank.txt"],
      "packbudget: rank.txt:3: expected WEIGHT PATTERN\n",
    ],
  ])("run %j exits 2 with %j", (args, message) => {
    const io = tree();
    expect(run(args, io)).toBe(2);
    expect(io.stdout).toBe("");
    expect(io.stderr).toBe(message);
  });
});

function ignoredPaths(stdout: string): string[] {
  return stdout
    .split("\n")
    .filter((line) => line.startsWith("ignored"))
    .map((line) => line.slice(line.lastIndexOf(" ") + 1));
}

function firstRow(stdout: string): string[] {
  return (stdout.split("\n")[2] ?? "").split(" ").filter((cell) => cell !== "");
}

describe("cli ignore patterns", () => {
  test.each([
    ["a.txt", ["a.txt", "docs/a.txt/x", "src/a.txt"]],
    ["/a.txt", ["a.txt"]],
    ["*.txt", ["A.txt", "a.txt", "docs/a.txt/x", "src/a.txt"]],
    ["?.txt", ["A.txt", "a.txt", "docs/a.txt/x", "src/a.txt"]],
    ["src/", ["src/a.txt", "src/b.ts", "src/gen/c.ts"]],
    ["gen/", ["src/gen/c.ts"]],
    ["/gen/", []],
    ["src/*.ts", ["src/b.ts"]],
    ["src/g*", ["src/gen/c.ts"]],
    ["build", ["build/o.js", "lib/build/p.js"]],
    ["docs/a.txt", ["docs/a.txt/x"]],
    ["a.txt/", ["docs/a.txt/x"]],
    ["*.TXT", []],
    [
      "**",
      [
        "A.txt",
        "a.txt",
        "b.md",
        "build/o.js",
        "docs/a.txt/x",
        "lib/build/p.js",
        "src/a.txt",
        "src/b.ts",
        "src/gen/c.ts",
      ],
    ],
    ["//", []],
    ["", []],
  ])("--ignore %j ignores %j", (pattern, expected) => {
    const io = new MemIo({
      "a.txt": "x",
      "A.txt": "x",
      "b.md": "x",
      "src/a.txt": "x",
      "src/b.ts": "x",
      "src/gen/c.ts": "x",
      "docs/a.txt/x": "x",
      "build/o.js": "x",
      "lib/build/p.js": "x",
    });
    expect(run(["plan", ".", "--budget", "100", "--ignore", pattern], io)).toBe(0);
    expect(ignoredPaths(io.stdout)).toEqual(expected);
  });
});

describe("cli token table", () => {
  const rows: [string, string | Uint8Array, string, string][] = [
    ["empty", "", "packed", "0"],
    ["abc", "abc", "packed", "1"],
    ["abcd", "abcd", "packed", "2"],
    ["abc LF", "abc\n", "packed", "1"],
    ["abc LF LF", "abc\n\n", "packed", "2"],
    ["CRLF twice", "a\r\nb\r\n", "packed", "1"],
    ["lone CR", "a\rb", "packed", "1"],
    ["BOM abc", "\uFEFFabc", "packed", "1"],
    ["two BOM x", "\uFEFF\uFEFFx", "packed", "1"],
    ["BOM only", "\uFEFF", "packed", "0"],
    ["three emoji", "\u{1F600}\u{1F600}\u{1F600}", "packed", "1"],
    ["NUL", "a\u0000b", "binary", "-"],
    ["xFF", new Uint8Array([0x61, 0x62, 0xff]), "binary", "-"],
    ["surrogate", new Uint8Array([0xed, 0xa0, 0x80]), "binary", "-"],
    ["overlong", new Uint8Array([0xc0, 0xaf]), "binary", "-"],
  ];
  test.each(rows)("file %s is %s with tokens %s", (_label, content, status, count) => {
    const io = new MemIo({ f: content });
    expect(run(["plan", ".", "--budget", "100"], io)).toBe(0);
    expect(firstRow(io.stdout).slice(0, 2)).toEqual([status, count]);
  });
});

describe("cli help", () => {
  test("--help writes the usage in one call", () => {
    const calls: string[] = [];
    const io = tree();
    io.out = (text: string) => {
      calls.push(text);
    };
    expect(run(["--help"], io)).toBe(0);
    expect(calls).toEqual([
      "usage: packbudget pack DIR --budget N [--rank FILE] [--ignore PATTERN]... [--ignore-file FILE]\n" +
        "       packbudget plan DIR --budget N [--rank FILE] [--ignore PATTERN]... [--ignore-file FILE]\n" +
        "       packbudget --help\n",
    ]);
    expect(io.stderr).toBe("");
  });
});

describe("cli rank file", () => {
  const bad = "packbudget: r:1: expected WEIGHT PATTERN\n";
  test.each([
    ["5 a", 0, ""],
    ["5\ta b", 0, ""],
    ["0005 x", 0, ""],
    ["12345 x", 2, bad],
    ["5", 2, bad],
    ["5 ", 2, bad],
    ["a 5", 2, bad],
    ["-1 a", 2, bad],
    ["5a", 2, bad],
    ["# c\n\n  7  /x  ", 0, ""],
    ["9 *.md\n2 *\n", 0, ""],
    ["5\u00A0a", 2, bad],
  ])("rank text %j exits %j with stderr %j", (text, code, message) => {
    const io = new MemIo({ f: "x", r: text });
    expect(run(["plan", ".", "--budget", "9", "--rank", "r"], io)).toBe(code);
    expect(io.stderr).toBe(message);
  });
});

describe("cli list files", () => {
  test.each([
    [["--ignore-file", "nope.txt"], "packbudget: nope.txt: cannot read the file\n"],
    [["--ignore-file", "bin.dat"], "packbudget: bin.dat: file is not valid UTF-8\n"],
    [["--ignore-file", "nul.txt"], "packbudget: nul.txt: file is not valid UTF-8\n"],
    [["--rank", "nul.txt"], "packbudget: nul.txt: file is not valid UTF-8\n"],
    [["--rank", "rank.txt"], "packbudget: rank.txt:3: expected WEIGHT PATTERN\n"],
  ])("pack with %j fails with %j", (options, message) => {
    const io = new MemIo({
      "d/a.txt": "a\n",
      "rank.txt": "1 a\n\nzz\n",
      "bin.dat": new Uint8Array([0xff]),
      "nul.txt": "a\u0000b\n",
    });
    expect(run(["pack", "d", "--budget", "1", ...options], io)).toBe(2);
    expect(io.stdout).toBe("");
    expect(io.stderr).toBe(message);
  });

  test("CRLF and BOM list files parse like LF files", () => {
    const io = new MemIo({
      "d/a.txt": "a\n",
      "d/b.txt": "b\n",
      ign: "\uFEFF# c\r\n\r\n  a.txt  \r\n",
      rk: "\uFEFF5 b.txt\r\n",
    });
    const args = ["plan", "d", "--budget", "9", "--ignore-file", "ign", "--rank", "rk"];
    expect(run(args, io)).toBe(0);
    expect(io.stderr).toBe("");
    expect(io.stdout).toBe(
      "packbudget: 1 packed, 0 left out, 1 of 9 tokens\n" +
        "STATUS   TOKENS  WEIGHT  PATH\n" +
        "ignored  -       -       a.txt\n" +
        "packed   1       5       b.txt\n",
    );
  });
});

describe("cli borderline arguments", () => {
  const wide = "packbudget: --budget needs a whole number of 1 or more, got ";
  test.each([
    [["pack", "d", "--budget", "999999999999999"], 0, ""],
    [["pack", "d", "--budget", "0000"], 2, `${wide}0000\n`],
    [["pack", "d", "--budget", "1000000000000000"], 2, `${wide}1000000000000000\n`],
    [["pack", "-", "--budget", "1"], 2, "packbudget: -: not a directory\n"],
    [["pack", "-x", "--budget", "1"], 2, "packbudget: -x: not a directory\n"],
    [["pack", "d", "--ignore", "--budget", "--budget", "9"], 0, ""],
    [["pack", "d", "--budget", "9", "--ignore", "a.txt", "--ignore", "b.txt"], 0, ""],
    [["pack", "d", "--color"], 2, "packbudget: unknown option --color\n"],
  ])("run %j exits %j with stderr %j", (args, code, message) => {
    const io = tree();
    expect(run(args, io)).toBe(code);
    expect(io.stderr).toBe(message);
  });

  test("a repeated --ignore applies both patterns", () => {
    const io = tree();
    expect(run(["pack", "d", "--budget", "9", "--ignore", "a.txt", "--ignore", "b.txt"], io)).toBe(
      0,
    );
    expect(io.stdout).toBe("packbudget: 0 packed, 0 left out, 0 of 9 tokens\n");
  });
});

describe("cli worked example", () => {
  const files = () =>
    new MemIo({
      "proj/README.md": "# demo\nUse it.\n",
      "proj/src/a.ts": "let a = 1;\n",
      "proj/src/b.ts": "let b = 22;\n",
      "proj/src/big.ts": `${"x".repeat(39)}\n`,
      "proj/logo.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00]),
      "proj/notes.txt": "todo",
      "proj/empty.txt": "",
      "proj/tmp/skip.log": "log\n",
      "proj/.git/config": "[core]\n",
      "rank.txt": "# first match wins\n9 README.md\n5 src/*.ts\n",
    });
  const summary = "packbudget: 5 packed, 1 left out, 12 of 12 tokens\n";

  test("plan prints the table and exits 1", () => {
    const io = files();
    const args = ["plan", "proj", "--budget", "12", "--rank", "rank.txt", "--ignore", "tmp/"];
    expect(run(args, io)).toBe(1);
    expect(io.stderr).toBe("");
    expect(io.stdout).toBe(
      `${summary}STATUS   TOKENS  WEIGHT  PATH\n` +
        "packed   4       9       README.md\n" +
        "packed   0       0       empty.txt\n" +
        "binary   -       -       logo.png\n" +
        "packed   2       0       notes.txt\n" +
        "packed   3       5       src/a.ts\n" +
        "packed   3       5       src/b.ts\n" +
        "budget   10      5       src/big.ts\n" +
        "ignored  -       -       tmp/skip.log\n",
    );
  });

  test("pack prints the packed files and exits 1", () => {
    const io = files();
    const args = ["pack", "proj", "--budget", "12", "--rank", "rank.txt", "--ignore", "tmp/"];
    expect(run(args, io)).toBe(1);
    expect(io.stderr).toBe("");
    expect(io.stdout).toBe(
      `${summary}=== README.md (tokens: 4) ===\n` +
        "# demo\nUse it.\n" +
        "=== empty.txt (tokens: 0) ===\n" +
        "=== notes.txt (tokens: 2) ===\n" +
        "todo\n" +
        "=== src/a.ts (tokens: 3) ===\n" +
        "let a = 1;\n" +
        "=== src/b.ts (tokens: 3) ===\n" +
        "let b = 22;\n",
    );
  });
});

describe("cli empty and all-ignored folders", () => {
  const none = "packbudget: 0 packed, 0 left out, 0 of 7 tokens\n";
  test.each([
    [
      "plan",
      {
        "d/": "",
      },
      ["--budget", "007"],
      none,
    ],
    [
      "pack",
      {
        "d/": "",
      },
      ["--budget", "007"],
      none,
    ],
    [
      "pack",
      { "d/a.txt": "a\n", "d/b.txt": "b\n" },
      ["--budget", "007", "--ignore", "*.txt"],
      none,
    ],
    [
      "plan",
      { "d/a.txt": "a\n", "d/b.txt": "b\n" },
      ["--budget", "007", "--ignore", "*.txt"],
      `${none}STATUS   TOKENS  WEIGHT  PATH\nignored  -       -       a.txt\nignored  -       -       b.txt\n`,
    ],
  ])("%s on %j with %j prints %j and exits 0", (command, files, options, output) => {
    const io = new MemIo(files);
    expect(run([command, "d", ...options], io)).toBe(0);
    expect(io.stderr).toBe("");
    expect(io.stdout).toBe(output);
  });
});

describe("cli process", () => {
  test("main.ts packs a folder with CRLF bytes", () => {
    const dir = mkdtempSync(join(tmpdir(), "packbudget-"));
    try {
      writeFileSync(join(dir, "a.txt"), new Uint8Array([0x61, 0x0d, 0x0a, 0x62, 0x0d, 0x0a]));
      writeFileSync(join(dir, "b.txt"), new Uint8Array(Buffer.from("0123456789\n")));
      const result = Bun.spawnSync(
        [process.execPath, "src/main.ts", "pack", dir, "--budget", "2"],
        { cwd: join(import.meta.dir, "..") },
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toBe("");
      expect(result.stdout.toString()).toBe(
        "packbudget: 1 packed, 1 left out, 1 of 2 tokens\n=== a.txt (tokens: 1) ===\na\nb\n",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
