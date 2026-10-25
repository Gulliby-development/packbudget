import { classify } from "./classify";
import type { Io } from "./io";
import { type RankRule, weightOf } from "./listfile";
import { matchesAny, type Pattern } from "./pattern";
import { compare } from "./text";
import { discover, joinPath } from "./walk";

export type Status = "packed" | "budget" | "ignored" | "binary" | "unreadable";

export type Row = {
  path: string;
  status: Status;
  tokens?: number;
  weight?: number;
  text?: string;
};

export type Plan = { rows: Row[]; packed: number; leftOut: number; used: number };

export function buildPlan(
  io: Io,
  dir: string,
  patterns: readonly (Pattern | null)[],
  rules: readonly RankRule[],
  budget: number,
): Plan {
  const rows: Row[] = [];
  const candidates: Row[] = [];
  for (const path of discover(io, dir)) {
    if (matchesAny(patterns, path)) {
      rows.push({ path, status: "ignored" });
      continue;
    }
    const bytes = io.read(joinPath(dir, path));
    if (bytes === null) {
      rows.push({ path, status: "unreadable" });
      continue;
    }
    const result = classify(bytes);
    if (result.kind === "binary") {
      rows.push({ path, status: "binary" });
      continue;
    }
    const row: Row = {
      path,
      status: "budget",
      tokens: result.tokens,
      weight: weightOf(rules, path),
      text: result.packed,
    };
    rows.push(row);
    candidates.push(row);
  }
  const ordered = [...candidates].sort((a, b) => {
    const byWeight = (b.weight ?? 0) - (a.weight ?? 0);
    if (byWeight !== 0) {
      return byWeight;
    }
    const byTokens = (a.tokens ?? 0) - (b.tokens ?? 0);
    return byTokens !== 0 ? byTokens : compare(a.path, b.path);
  });
  let used = 0;
  let packed = 0;
  let leftOut = 0;
  for (const row of ordered) {
    const cost = row.tokens ?? 0;
    if (used + cost <= budget) {
      row.status = "packed";
      used += cost;
      packed += 1;
    } else {
      leftOut += 1;
    }
  }
  return { rows, packed, leftOut, used };
}
