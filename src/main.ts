import { readdirSync, readFileSync } from "node:fs";
import { run } from "./cli";
import type { Entry, Io } from "./io";

class StdIo implements Io {
  list(dir: string): Entry[] | null {
    try {
      return readdirSync(dir, { withFileTypes: true }).map((item): Entry => {
        if (item.isFile()) {
          return { name: item.name, kind: "file" };
        }
        if (item.isDirectory()) {
          return { name: item.name, kind: "dir" };
        }
        return { name: item.name, kind: "other" };
      });
    } catch {
      return null;
    }
  }

  read(path: string): Uint8Array | null {
    try {
      return new Uint8Array(readFileSync(path));
    } catch {
      return null;
    }
  }

  out(text: string): void {
    process.stdout.write(text);
  }

  err(text: string): void {
    process.stderr.write(text);
  }
}

process.exitCode = run(process.argv.slice(2), new StdIo());
