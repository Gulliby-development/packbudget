export class Failure extends Error {}

export function points(text: string): string[] {
  return Array.from(text);
}

export function compare(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a.codePointAt(i) ?? 0;
    const y = b.codePointAt(j) ?? 0;
    if (x !== y) {
      return x - y;
    }
    i += x > 0xffff ? 2 : 1;
    j += y > 0xffff ? 2 : 1;
  }
  if (i < a.length) {
    return 1;
  }
  if (j < b.length) {
    return -1;
  }
  return 0;
}

export function tokens(count: number): number {
  return Math.floor((count + 3) / 4);
}

export function shown(text: string): string {
  let out = "";
  for (const ch of points(text)) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? "?" : ch;
  }
  return out;
}

export function isBlank(ch: string): boolean {
  return ch === " " || ch === "\t";
}

export function stripBlanks(text: string): string {
  const chars = points(text);
  let start = 0;
  let end = chars.length;
  while (start < end && isBlank(chars[start] ?? "")) {
    start += 1;
  }
  while (end > start && isBlank(chars[end - 1] ?? "")) {
    end -= 1;
  }
  return chars.slice(start, end).join("");
}

export function isDigit(ch: string): boolean {
  if (ch.length !== 1) {
    return false;
  }
  const code = ch.charCodeAt(0);
  return code >= 0x30 && code <= 0x39;
}

function stripSpaces(text: string): string {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 0x20) {
    end -= 1;
  }
  return text.slice(0, end);
}

export function table(header: string[], rows: string[][]): string {
  const all = [header, ...rows];
  const widths: number[] = [];
  for (const row of all) {
    for (let i = 0; i < row.length; i += 1) {
      const width = points(row[i] ?? "").length;
      if (width > (widths[i] ?? 0)) {
        widths[i] = width;
      }
    }
  }
  let out = "";
  for (const row of all) {
    const cells: string[] = [];
    for (let i = 0; i < row.length; i += 1) {
      const cell = row[i] ?? "";
      cells.push(cell + " ".repeat((widths[i] ?? 0) - points(cell).length));
    }
    out += `${stripSpaces(cells.join("  "))}\n`;
  }
  return out;
}
