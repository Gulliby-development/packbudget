import type { Io } from "./io";
import { compare } from "./text";

export function joinPath(dir: string, name: string): string {
  if (dir.endsWith("/") || dir.endsWith("\\")) {
    return dir + name;
  }
  return `${dir}/${name}`;
}

function walk(io: Io, dir: string, rel: string, found: string[]): void {
  const entries = io.list(dir);
  if (entries === null) {
    return;
  }
  for (const entry of entries) {
    const path = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.kind === "file") {
      found.push(path);
    } else if (entry.kind === "dir" && entry.name !== ".git") {
      walk(io, joinPath(dir, entry.name), path, found);
    }
  }
}

export function discover(io: Io, dir: string): string[] {
  const found: string[] = [];
  walk(io, dir, "", found);
  return found.sort(compare);
}
