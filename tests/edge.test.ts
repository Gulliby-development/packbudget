import { describe, expect, test } from "bun:test";
import { run } from "../src/cli";
import { MemIo } from "../src/io";
import { joinPath } from "../src/walk";

function exec(io: MemIo, args: string[]): { code: number; out: string; err: string } {
  const code = run(args, io);
  return { code, out: io.stdout, err: io.stderr };
}

const HEAD = "STATUS  TOKENS  WEIGHT  PATH\n";

describe("budget borders", () => {
  test("a tie in weight and tokens is ordered by path", () => {
    const io = new MemIo({ "d/c.txt": "x\n", "d/a.txt": "x\n", "d/b.txt": "x\n" });
    const result = exec(io, ["plan", "d", "--budget", "2"]);
    expect(result.code).toBe(1);
    expect(result.out).toBe(
      `packbudget: 2 packed, 1 left out, 2 of 2 tokens\n${HEAD}` +
        "packed  1       0       a.txt\n" +
        "packed  1       0       b.txt\n" +
        "budget  1       0       c.txt\n",
    );
  });

  test("a file of 0 tokens is packed when the total equals the budget", () => {
    const io = new MemIo({ "d/a.txt": "abc", "d/z.txt": "", r: "5 a.txt\n" });
    const result = exec(io, ["pack", "d", "--budget", "1", "--rank", "r"]);
    expect(result.code).toBe(0);
    expect(result.out).toBe(
      "packbudget: 2 packed, 0 left out, 1 of 1 tokens\n" +
        "=== a.txt (tokens: 1) ===\nabc\n" +
        "=== z.txt (tokens: 0) ===\n",
    );
  });

  test("a budget of exactly the total packs every file with exit 0", () => {
    const io = new MemIo({ "d/a.txt": "abc", "d/b.txt": "abcdefg" });
    const result = exec(io, ["plan", "d", "--budget", "3"]);
    expect(result.code).toBe(0);
    expect(result.out).toBe(
      `packbudget: 2 packed, 0 left out, 3 of 3 tokens\n${HEAD}` +
        "packed  1       0       a.txt\n" +
        "packed  2       0       b.txt\n",
    );
  });

  test("a larger candidate is left out while a smaller later one fits", () => {
    const io = new MemIo({ "d/big.txt": "xxxxxxx\n", "d/small.txt": "y\n", r: "5 big.txt\n" });
    const result = exec(io, ["plan", "d", "--budget", "1", "--rank", "r"]);
    expect(result.code).toBe(1);
    expect(result.out).toBe(
      `packbudget: 1 packed, 1 left out, 1 of 1 tokens\n${HEAD}` +
        "budget  2       5       big.txt\n" +
        "packed  1       0       small.txt\n",
    );
  });
});

describe("path order and display", () => {
  test("a-b/x comes before a/x", () => {
    const io = new MemIo({ "d/a/x": "x\n", "d/a-b/x": "x\n" });
    const result = exec(io, ["plan", "d", "--budget", "5"]);
    expect(result.out).toBe(
      `packbudget: 2 packed, 0 left out, 2 of 5 tokens\n${HEAD}` +
        "packed  1       0       a-b/x\n" +
        "packed  1       0       a/x\n",
    );
  });

  test("U+FF5E comes before U+1F600 by code points", () => {
    const io = new MemIo({ "d/\u{1F600}/x": "x\n", "d/\uFF5E/x": "x\n" });
    const result = exec(io, ["plan", "d", "--budget", "5"]);
    expect(result.out).toBe(
      `packbudget: 2 packed, 0 left out, 2 of 5 tokens\n${HEAD}` +
        "packed  1       0       \uFF5E/x\n" +
        "packed  1       0       \u{1F600}/x\n",
    );
  });

  test("? in a pattern matches an emoji as one code point", () => {
    const io = new MemIo({ "d/\u{1F600}.txt": "x\n", "d/ab.txt": "x\n" });
    const result = exec(io, ["plan", "d", "--budget", "5", "--ignore", "?.txt"]);
    expect(result.out).toBe(
      "packbudget: 1 packed, 0 left out, 1 of 5 tokens\n" +
        "STATUS   TOKENS  WEIGHT  PATH\n" +
        "packed   1       0       ab.txt\n" +
        "ignored  -       -       \u{1F600}.txt\n",
    );
  });

  test("a TAB in a path is shown as ?", () => {
    const io = new MemIo({ "d/a\tb.txt": "x\n" });
    const result = exec(io, ["plan", "d", "--budget", "5"]);
    expect(result.out).toBe(
      `packbudget: 1 packed, 0 left out, 1 of 5 tokens\n${HEAD}packed  1       0       a?b.txt\n`,
    );
  });
});

describe("discovery borders", () => {
  test("DIR with a trailing slash is joined without a doubled separator", () => {
    const io = new MemIo({ "proj/sub/a.txt": "x\n" });
    const result = exec(io, ["plan", "proj/", "--budget", "5"]);
    expect(result.out).toBe(
      `packbudget: 1 packed, 0 left out, 1 of 5 tokens\n${HEAD}packed  1       0       sub/a.txt\n`,
    );
  });

  test("joinPath adds a separator only when none ends the folder", () => {
    expect(joinPath("proj", "sub")).toBe("proj/sub");
    expect(joinPath("proj/", "sub")).toBe("proj/sub");
    expect(joinPath("proj\\", "sub")).toBe("proj\\sub");
  });

  test("a .git folder below a subfolder is skipped and a .git file is kept", () => {
    const io = new MemIo({
      "d/.git/HEAD": "x\n",
      "d/sub/.git/config": "x\n",
      "d/sub/a.txt": "x\n",
      "d/o/.git": "x\n",
    });
    const result = exec(io, ["plan", "d", "--budget", "5"]);
    expect(result.out).toBe(
      `packbudget: 2 packed, 0 left out, 2 of 5 tokens\n${HEAD}` +
        "packed  1       0       o/.git\n" +
        "packed  1       0       sub/a.txt\n",
    );
  });

  test("a null entry is skipped", () => {
    const io = new MemIo({ "d/a.txt": "x\n", "d/dev": null });
    const result = exec(io, ["plan", "d", "--budget", "5"]);
    expect(result.out).toBe(
      `packbudget: 1 packed, 0 left out, 1 of 5 tokens\n${HEAD}packed  1       0       a.txt\n`,
    );
  });

  test("an unreadable file has status unreadable and is not a candidate", () => {
    const io = new MemIo({ "d/a.txt": "x\n", "d/b.txt": "x\n" });
    io.unreadable.add("d/b.txt");
    const result = exec(io, ["plan", "d", "--budget", "5"]);
    expect(result.code).toBe(0);
    expect(result.out).toBe(
      "packbudget: 1 packed, 0 left out, 1 of 5 tokens\n" +
        "STATUS      TOKENS  WEIGHT  PATH\n" +
        "packed      1       0       a.txt\n" +
        "unreadable  -       -       b.txt\n",
    );
  });
});
