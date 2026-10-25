import type { Plan } from "./plan";
import { shown, table } from "./text";

export function summaryLine(plan: Plan, budget: number): string {
  return `packbudget: ${plan.packed} packed, ${plan.leftOut} left out, ${plan.used} of ${budget} tokens\n`;
}

export function renderPlan(plan: Plan, budget: number): string {
  const summary = summaryLine(plan, budget);
  if (plan.rows.length === 0) {
    return summary;
  }
  const rows = plan.rows.map((row) => {
    const numbers = row.status === "packed" || row.status === "budget";
    return [
      row.status,
      numbers ? String(row.tokens ?? 0) : "-",
      numbers ? String(row.weight ?? 0) : "-",
      shown(row.path),
    ];
  });
  return summary + table(["STATUS", "TOKENS", "WEIGHT", "PATH"], rows);
}

export function renderPack(plan: Plan, budget: number): string {
  let out = summaryLine(plan, budget);
  for (const row of plan.rows) {
    if (row.status === "packed") {
      out += `=== ${shown(row.path)} (tokens: ${row.tokens ?? 0}) ===\n${row.text ?? ""}`;
    }
  }
  return out;
}
