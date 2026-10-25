import { points } from "./text";

export function matchPart(pattern: string, name: string): boolean {
  const p = points(pattern);
  const n = points(name);
  let pi = 0;
  let ni = 0;
  let star = -1;
  let mark = 0;
  while (ni < n.length) {
    const pc = p[pi];
    if (pc === "*") {
      star = pi;
      mark = ni;
      pi += 1;
    } else if (pc !== undefined && (pc === "?" || pc === n[ni])) {
      pi += 1;
      ni += 1;
    } else if (star >= 0) {
      pi = star + 1;
      mark += 1;
      ni = mark;
    } else {
      return false;
    }
  }
  while (p[pi] === "*") {
    pi += 1;
  }
  return pi === p.length;
}
