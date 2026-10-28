import { Failure, isDigit, points, shown } from "./text";

export const USAGE =
  "usage: packbudget pack DIR --budget N [--rank FILE] [--ignore PATTERN]... [--ignore-file FILE]\n" +
  "       packbudget plan DIR --budget N [--rank FILE] [--ignore PATTERN]... [--ignore-file FILE]\n" +
  "       packbudget --help\n";

export type Parsed =
  | { kind: "help" }
  | {
      kind: "run";
      command: "pack" | "plan";
      dir: string;
      budget: number;
      rank: string | null;
      ignores: string[];
      ignoreFile: string | null;
    };

function budgetScale(last: string): number {
  if (last === "k" || last === "K") {
    return 1000;
  }
  if (last === "m" || last === "M") {
    return 1000000;
  }
  return 1;
}

function parseBudget(value: string): number {
  const chars = points(value);
  const scale = budgetScale(chars[chars.length - 1] ?? "");
  const digits = scale === 1 ? chars : chars.slice(0, -1);
  let ok = digits.length >= 1 && digits.length <= (scale === 1 ? 15 : 9);
  for (const ch of digits) {
    if (!isDigit(ch)) {
      ok = false;
    }
  }
  const budget = ok ? Number(digits.join("")) * scale : 0;
  if (!ok || budget < 1) {
    throw new Failure(`--budget needs a whole number of 1 or more, got ${shown(value)}`);
  }
  return budget;
}

export function parseArgs(argv: readonly string[]): Parsed {
  const command = argv[0];
  if (command === undefined) {
    throw new Failure("missing command (pack or plan)");
  }
  if (command === "--help" && argv.length === 1) {
    return { kind: "help" };
  }
  if (command !== "pack" && command !== "plan") {
    throw new Failure(`unknown command ${shown(command)}`);
  }
  let dir: string | null = null;
  let budget: string | null = null;
  let rank: string | null = null;
  let ignoreFile: string | null = null;
  const ignores: string[] = [];
  let i = 1;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (!arg.startsWith("--")) {
      if (dir !== null) {
        throw new Failure(`unexpected argument ${shown(arg)}`);
      }
      dir = arg;
      i += 1;
      continue;
    }
    if (arg !== "--budget" && arg !== "--rank" && arg !== "--ignore" && arg !== "--ignore-file") {
      throw new Failure(`unknown option ${shown(arg)}`);
    }
    const value = argv[i + 1];
    if (value === undefined) {
      throw new Failure(`${arg} needs a value`);
    }
    if (arg === "--ignore") {
      ignores.push(value);
    } else {
      const current = arg === "--budget" ? budget : arg === "--rank" ? rank : ignoreFile;
      if (current !== null) {
        throw new Failure(`${arg} given twice`);
      }
      if (arg === "--budget") {
        budget = value;
      } else if (arg === "--rank") {
        rank = value;
      } else {
        ignoreFile = value;
      }
    }
    i += 2;
  }
  if (dir === null) {
    throw new Failure("missing DIR");
  }
  if (budget === null) {
    throw new Failure("missing --budget");
  }
  return { kind: "run", command, dir, budget: parseBudget(budget), rank, ignores, ignoreFile };
}
