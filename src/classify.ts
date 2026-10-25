import { points, tokens } from "./text";

export type Classified = { kind: "binary" } | { kind: "text"; packed: string; tokens: number };

function isCont(b: number | undefined): b is number {
  return b !== undefined && b >= 0x80 && b <= 0xbf;
}

export function decodeStrict(bytes: Uint8Array): string | null {
  const out: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i] ?? 0;
    let cp = 0;
    let extra = 0;
    let min = 0;
    if (b === 0) {
      return null;
    }
    if (b < 0x80) {
      cp = b;
    } else if (b >= 0xc2 && b <= 0xdf) {
      cp = b & 0x1f;
      extra = 1;
      min = 0x80;
    } else if (b >= 0xe0 && b <= 0xef) {
      cp = b & 0x0f;
      extra = 2;
      min = 0x800;
    } else if (b >= 0xf0 && b <= 0xf4) {
      cp = b & 0x07;
      extra = 3;
      min = 0x10000;
    } else {
      return null;
    }
    for (let k = 1; k <= extra; k += 1) {
      const c = bytes[i + k];
      if (!isCont(c)) {
        return null;
      }
      cp = cp * 64 + (c & 0x3f);
    }
    if (cp < min || (cp >= 0xd800 && cp <= 0xdfff) || cp > 0x10ffff) {
      return null;
    }
    out.push(String.fromCodePoint(cp));
    i += extra + 1;
  }
  return out.join("");
}

export function packText(text: string): string {
  let body = text.startsWith("\uFEFF") ? text.slice(1) : text;
  body = body.split("\r\n").join("\n");
  if (body !== "" && !body.endsWith("\n")) {
    body += "\n";
  }
  return body;
}

export function classify(bytes: Uint8Array): Classified {
  const decoded = decodeStrict(bytes);
  if (decoded === null) {
    return { kind: "binary" };
  }
  const packed = packText(decoded);
  return { kind: "text", packed, tokens: tokens(points(packed).length) };
}
