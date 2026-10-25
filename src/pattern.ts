import { matchPart } from "./glob";

export type Pattern = { parts: string[]; anchored: boolean; dirOnly: boolean };

export function compilePattern(text: string): Pattern | null {
  let body = text;
  const leading = body.startsWith("/");
  if (leading) {
    body = body.slice(1);
  }
  const dirOnly = body.endsWith("/");
  if (dirOnly) {
    body = body.slice(0, body.length - 1);
  }
  if (body === "") {
    return null;
  }
  const parts = body.split("/");
  for (const part of parts) {
    if (part === "") {
      return null;
    }
  }
  return { parts, anchored: leading || parts.length > 1, dirOnly };
}

export function matchesPath(p: Pattern, path: string): boolean {
  const names = path.split("/");
  if (p.anchored) {
    const k = p.parts.length;
    if (p.dirOnly ? names.length <= k : names.length < k) {
      return false;
    }
    for (let i = 0; i < k; i += 1) {
      if (!matchPart(p.parts[i] ?? "", names[i] ?? "")) {
        return false;
      }
    }
    return true;
  }
  const limit = p.dirOnly ? names.length - 1 : names.length;
  for (let i = 0; i < limit; i += 1) {
    if (matchPart(p.parts[0] ?? "", names[i] ?? "")) {
      return true;
    }
  }
  return false;
}

export function matchesAny(patterns: readonly (Pattern | null)[], path: string): boolean {
  for (const p of patterns) {
    if (p !== null && matchesPath(p, path)) {
      return true;
    }
  }
  return false;
}
