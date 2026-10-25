export type Entry = { name: string; kind: "file" | "dir" | "other" };

export interface Io {
  list(dir: string): Entry[] | null;
  read(path: string): Uint8Array | null;
  out(text: string): void;
  err(text: string): void;
}

function cleanPath(path: string): string {
  let result = path;
  if (result.startsWith("./")) {
    result = result.slice(2);
  }
  while (result.endsWith("/")) {
    result = result.slice(0, result.length - 1);
  }
  return result === "." ? "" : result;
}

function parentOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function nameOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? path : path.slice(slash + 1);
}

export class MemIo implements Io {
  stdout = "";
  stderr = "";
  unreadable = new Set<string>();
  private readonly files = new Map<string, string | Uint8Array | null>();
  private readonly dirs = new Set<string>([""]);

  constructor(files: Record<string, string | Uint8Array | null>) {
    for (const key of Object.keys(files)) {
      const path = cleanPath(key);
      const parts = path === "" ? [] : path.split("/");
      const isFolder = key.endsWith("/");
      const folderCount = isFolder ? parts.length : parts.length - 1;
      for (let i = 1; i <= folderCount; i += 1) {
        this.dirs.add(parts.slice(0, i).join("/"));
      }
      if (!isFolder) {
        this.files.set(path, files[key] ?? null);
      }
    }
  }

  list(dir: string): Entry[] | null {
    const path = cleanPath(dir);
    if (!this.dirs.has(path)) {
      return null;
    }
    const entries: Entry[] = [];
    for (const folder of this.dirs) {
      if (folder !== "" && parentOf(folder) === path && !this.files.has(folder)) {
        entries.push({ name: nameOf(folder), kind: "dir" });
      }
    }
    for (const [file, value] of this.files) {
      if (parentOf(file) === path && file !== "") {
        entries.push({ name: nameOf(file), kind: value === null ? "other" : "file" });
      }
    }
    return entries;
  }

  read(path: string): Uint8Array | null {
    const key = cleanPath(path);
    if (this.unreadable.has(path) || this.unreadable.has(key)) {
      return null;
    }
    const value = this.files.get(key);
    if (value === undefined || value === null) {
      return null;
    }
    return typeof value === "string" ? new TextEncoder().encode(value) : value;
  }

  out(text: string): void {
    this.stdout += text;
  }

  err(text: string): void {
    this.stderr += text;
  }
}
