import { decodeStrict, packText } from "./classify";
import type { Io } from "./io";
import { compilePattern, matchesPath, type Pattern } from "./pattern";
import { Failure, isBlank, isDigit, points, shown, stripBlanks } from "./text";

export type ListLine = { text: string; line: number };
export type RankRule = { weight: number; pattern: Pattern | null };

export function readListLines(io: Io, path: string): ListLine[] {
  const bytes = io.read(path);
  if (bytes === null) {
    throw new Failure(`${shown(path)}: cannot read the file`);
  }
  const decoded = decodeStrict(bytes);
  if (decoded === null) {
    throw new Failure(`${shown(path)}: file is not valid UTF-8`);
  }
  const lines = packText(decoded).split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  const result: ListLine[] = [];
  lines.forEach((raw, index) => {
    const text = stripBlanks(raw);
    if (text !== "" && !text.startsWith("#")) {
      result.push({ text, line: index + 1 });
    }
  });
  return result;
}

export function readIgnoreFile(io: Io, path: string): string[] {
  return readListLines(io, path).map((entry) => entry.text);
}

export function readRankFile(io: Io, path: string): RankRule[] {
  const rules: RankRule[] = [];
  for (const entry of readListLines(io, path)) {
    const chars = points(entry.text);
    let i = 0;
    while (i < chars.length && isDigit(chars[i] ?? "")) {
      i += 1;
    }
    const digits = i;
    let j = i;
    while (j < chars.length && isBlank(chars[j] ?? "")) {
      j += 1;
    }
    if (digits < 1 || digits > 4 || j === i || j >= chars.length) {
      throw new Failure(`${shown(path)}:${entry.line}: expected WEIGHT PATTERN`);
    }
    const weight = Number(chars.slice(0, digits).join(""));
    rules.push({ weight, pattern: compilePattern(chars.slice(j).join("")) });
  }
  return rules;
}

export function weightOf(rules: readonly RankRule[], path: string): number {
  for (const rule of rules) {
    if (rule.pattern !== null && matchesPath(rule.pattern, path)) {
      return rule.weight;
    }
  }
  return 0;
}
