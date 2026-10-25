import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readme = readFileSync(join(import.meta.dir, "..", "README.md"), "utf8");
const lines = readme.replaceAll("\r", "").split("\n");

test.each(["## Install", "## Usage", "## Patterns", "## Development"])(
  "README has the heading %s",
  (heading) => {
    expect(lines).toContain(heading);
  },
);
