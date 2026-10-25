import type { Io } from "./io";
import { readIgnoreFile, readRankFile } from "./listfile";
import { parseArgs, USAGE } from "./options";
import { compilePattern } from "./pattern";
import { buildPlan } from "./plan";
import { renderPack, renderPlan } from "./render";
import { Failure, shown } from "./text";

function execute(argv: string[], io: Io): number {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    io.out(USAGE);
    return 0;
  }
  if (io.list(parsed.dir) === null) {
    throw new Failure(`${shown(parsed.dir)}: not a directory`);
  }
  const lines = parsed.ignoreFile === null ? [] : readIgnoreFile(io, parsed.ignoreFile);
  const rules = parsed.rank === null ? [] : readRankFile(io, parsed.rank);
  const patterns = [...parsed.ignores, ...lines].map((text) => compilePattern(text));
  const plan = buildPlan(io, parsed.dir, patterns, rules, parsed.budget);
  io.out(
    parsed.command === "plan" ? renderPlan(plan, parsed.budget) : renderPack(plan, parsed.budget),
  );
  return plan.leftOut > 0 ? 1 : 0;
}

export function run(argv: string[], io: Io): number {
  try {
    return execute(argv, io);
  } catch (error) {
    if (error instanceof Failure) {
      io.err(`packbudget: ${error.message}\n`);
      return 2;
    }
    throw error;
  }
}
