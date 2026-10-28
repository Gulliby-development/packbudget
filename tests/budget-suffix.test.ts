import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/options";

describe("budget suffixes", () => {
  test("k multiplies by 1000", () => {
    expect(parseArgs(["pack", "d", "--budget", "8k"])).toEqual({
      kind: "run",
      command: "pack",
      dir: "d",
      budget: 8000,
      rank: null,
      ignores: [],
      ignoreFile: null,
    });
    expect(parseArgs(["plan", "d", "--budget", "1K"])).toEqual({
      kind: "run",
      command: "plan",
      dir: "d",
      budget: 1000,
      rank: null,
      ignores: [],
      ignoreFile: null,
    });
    expect(parseArgs(["pack", "d", "--budget", "0005k"])).toEqual({
      kind: "run",
      command: "pack",
      dir: "d",
      budget: 5000,
      rank: null,
      ignores: [],
      ignoreFile: null,
    });
  });

  test("m multiplies by 1000000", () => {
    expect(parseArgs(["pack", "d", "--budget", "2m"])).toEqual({
      kind: "run",
      command: "pack",
      dir: "d",
      budget: 2000000,
      rank: null,
      ignores: [],
      ignoreFile: null,
    });
    expect(parseArgs(["pack", "d", "--budget", "999999999M"])).toEqual({
      kind: "run",
      command: "pack",
      dir: "d",
      budget: 999999999000000,
      rank: null,
      ignores: [],
      ignoreFile: null,
    });
  });

  test("plain numbers still work", () => {
    expect(parseArgs(["pack", "d", "--budget", "12"])).toEqual({
      kind: "run",
      command: "pack",
      dir: "d",
      budget: 12,
      rank: null,
      ignores: [],
      ignoreFile: null,
    });
  });

  test("a suffix needs digits and a budget of 1 or more", () => {
    const wide = "--budget needs a whole number of 1 or more, got ";
    expect(() => parseArgs(["pack", "d", "--budget", "k"])).toThrow(`${wide}k`);
    expect(() => parseArgs(["pack", "d", "--budget", "0k"])).toThrow(`${wide}0k`);
    expect(() => parseArgs(["pack", "d", "--budget", "1.5k"])).toThrow(`${wide}1.5k`);
    expect(() => parseArgs(["pack", "d", "--budget", "1kk"])).toThrow(`${wide}1kk`);
    expect(() => parseArgs(["pack", "d", "--budget", "1000000000k"])).toThrow(`${wide}1000000000k`);
    expect(() => parseArgs(["pack", "d", "--budget", "12g"])).toThrow(`${wide}12g`);
  });
});
