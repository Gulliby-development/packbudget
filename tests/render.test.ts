import { describe, expect, test } from "bun:test";
import type { Plan } from "../src/plan";
import { renderPack, renderPlan, summaryLine } from "../src/render";

const none: Plan = { rows: [], packed: 0, leftOut: 0, used: 0 };

describe("summaryLine", () => {
  test.each([
    [0, 0, 0, 7, "packbudget: 0 packed, 0 left out, 0 of 7 tokens\n"],
    [5, 1, 12, 12, "packbudget: 5 packed, 1 left out, 12 of 12 tokens\n"],
    [2, 0, 7, 8, "packbudget: 2 packed, 0 left out, 7 of 8 tokens\n"],
  ])("packed %d left out %d used %d budget %d", (packed, leftOut, used, budget, expected) => {
    expect(summaryLine({ rows: [], packed, leftOut, used }, budget)).toBe(expected);
  });
});

describe("renderPlan", () => {
  test("aligns columns and uses dashes for rows without numbers", () => {
    const plan: Plan = {
      rows: [
        { path: "README.md", status: "packed", tokens: 4, weight: 9 },
        { path: "big.ts", status: "budget", tokens: 10, weight: 0 },
        { path: "tmp/x", status: "ignored" },
      ],
      packed: 1,
      leftOut: 1,
      used: 4,
    };
    expect(renderPlan(plan, 8)).toBe(
      "packbudget: 1 packed, 1 left out, 4 of 8 tokens\n" +
        "STATUS   TOKENS  WEIGHT  PATH\n" +
        "packed   4       9       README.md\n" +
        "budget   10      0       big.ts\n" +
        "ignored  -       -       tmp/x\n",
    );
  });

  test("shows control characters in paths as question marks", () => {
    const plan: Plan = {
      rows: [
        { path: "a\tb", status: "binary" },
        { path: "c\u007fd", status: "binary" },
      ],
      packed: 0,
      leftOut: 0,
      used: 0,
    };
    expect(renderPlan(plan, 3)).toBe(
      "packbudget: 0 packed, 0 left out, 0 of 3 tokens\n" +
        "STATUS  TOKENS  WEIGHT  PATH\n" +
        "binary  -       -       a?b\n" +
        "binary  -       -       c?d\n",
    );
  });

  test("keeps emoji paths without trailing spaces", () => {
    const plan: Plan = {
      rows: [
        { path: "\u{1F600}\u{1F600}.txt", status: "unreadable" },
        { path: "a", status: "packed", tokens: 0, weight: 0 },
      ],
      packed: 1,
      leftOut: 0,
      used: 0,
    };
    const out = renderPlan(plan, 1);
    expect(out).toBe(
      "packbudget: 1 packed, 0 left out, 0 of 1 tokens\n" +
        "STATUS      TOKENS  WEIGHT  PATH\n" +
        "unreadable  -       -       \u{1F600}\u{1F600}.txt\n" +
        "packed      0       0       a\n",
    );
    expect(out.includes(" \n")).toBe(false);
  });

  test("prints only the summary when there are no files", () => {
    expect(renderPlan(none, 7)).toBe("packbudget: 0 packed, 0 left out, 0 of 7 tokens\n");
  });

  test("prints the table when every row is ignored", () => {
    const plan: Plan = {
      rows: [
        { path: "a.log", status: "ignored" },
        { path: "b.log", status: "ignored" },
      ],
      packed: 0,
      leftOut: 0,
      used: 0,
    };
    expect(renderPlan(plan, 7)).toBe(
      "packbudget: 0 packed, 0 left out, 0 of 7 tokens\n" +
        "STATUS   TOKENS  WEIGHT  PATH\n" +
        "ignored  -       -       a.log\n" +
        "ignored  -       -       b.log\n",
    );
  });
});

describe("renderPack", () => {
  test("writes blocks in row order and an empty file without text lines", () => {
    const plan: Plan = {
      rows: [
        { path: "a.txt", status: "packed", tokens: 1, weight: 0, text: "x\n" },
        {
          path: "big.ts",
          status: "budget",
          tokens: 10,
          weight: 0,
          text: "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\n",
        },
        { path: "e.txt", status: "packed", tokens: 0, weight: 0, text: "" },
        { path: "z.txt", status: "ignored" },
      ],
      packed: 2,
      leftOut: 1,
      used: 1,
    };
    expect(renderPack(plan, 2)).toBe(
      "packbudget: 2 packed, 1 left out, 1 of 2 tokens\n" +
        "=== a.txt (tokens: 1) ===\n" +
        "x\n" +
        "=== e.txt (tokens: 0) ===\n",
    );
  });

  test("shows control characters in block headers", () => {
    const plan: Plan = {
      rows: [{ path: "a\tb", status: "packed", tokens: 1, weight: 0, text: "q\n" }],
      packed: 1,
      leftOut: 0,
      used: 1,
    };
    expect(renderPack(plan, 5)).toBe(
      "packbudget: 1 packed, 0 left out, 1 of 5 tokens\n=== a?b (tokens: 1) ===\nq\n",
    );
  });

  test("prints only the summary when nothing is packed", () => {
    const plan: Plan = {
      rows: [{ path: "a.log", status: "ignored" }],
      packed: 0,
      leftOut: 0,
      used: 0,
    };
    expect(renderPack(plan, 7)).toBe("packbudget: 0 packed, 0 left out, 0 of 7 tokens\n");
    expect(renderPack(none, 7)).toBe("packbudget: 0 packed, 0 left out, 0 of 7 tokens\n");
  });
});
