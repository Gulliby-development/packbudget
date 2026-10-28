<p align="center"><img src="docs/logo.svg" width="96" alt="" /></p>

# packbudget

`packbudget` is an offline command-line tool that packs the text files of a folder into one text
that fits a token budget, the most wanted files first. It also prints a plan that says, for every
file, why it is in or out.

[![CI](https://github.com/Gulliby-development/packbudget/actions/workflows/ci.yml/badge.svg)](https://github.com/Gulliby-development/packbudget/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

It is for people who hand a project to a coding agent or a model with a limited context window.
It needs no key, account, network or download, and it never writes a file.

## Install

You need [Bun](https://bun.sh). The tool has no runtime dependency.

```
$ git clone https://github.com/Gulliby-development/packbudget.git
$ cd packbudget
$ bun install
```

`bun install` prints a short progress report and exits 0.

In the examples below, `bun run src/main.ts` stands for the installed command `packbudget`.

## Usage

```
packbudget pack DIR --budget N [--rank FILE] [--ignore PATTERN]... [--ignore-file FILE]
packbudget plan DIR --budget N [--rank FILE] [--ignore PATTERN]... [--ignore-file FILE]
packbudget --help
```

- `pack` writes the packed text of the files that fit the budget.
- `plan` prints a table with the status of every file: `packed`, `budget`, `ignored`, `binary`
  or `unreadable`.
- `--rank FILE` gives weights: each line is `WEIGHT PATTERN`, with a weight from 0 to 9999.
  The first matching line wins, and files with no match have weight 0.
- `--ignore PATTERN` ignores files and may be repeated; `--ignore-file FILE` reads one pattern per
  line (empty lines and lines starting with `#` are skipped).
- `--budget N` is a whole number of tokens; a `k` or `m` after the digits (`8k`, `2M`) multiplies it by
  1000 or 1000000, so `--budget 8k` means 8000 tokens.
- The exit code is 0 when everything fits, 1 when at least one file is left out, and 2 on an
  error. Errors are written to standard error as `packbudget: MESSAGE`.

Example:

```
$ mkdir demo
$ printf '# demo\nUse it.\n' > demo/README.md
$ printf 'let a = 1;\n' > demo/a.ts
$ printf 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n' > demo/big.ts
$ bun run src/main.ts plan demo --budget 8
packbudget: 2 packed, 1 left out, 7 of 8 tokens
STATUS  TOKENS  WEIGHT  PATH
packed  4       0       README.md
packed  3       0       a.ts
budget  10      0       big.ts
```

## Patterns

- A pattern is a path of `/`-separated parts; a trailing `/` matches folders only.
- A leading `/` anchors the pattern at `DIR`; a `/` anywhere else in it anchors it too.
- In a part, `*` matches any run of characters (also none) and `?` exactly one character.
- Every other character is itself, and case matters; there is no negation.
- An anchored pattern matches the first parts of a path, so it covers everything below a folder.
- An unanchored pattern matches any part of a path, so `build` ignores everything below `build`.

## Development

Run the three checks:

```
bun run typecheck
bun run lint
bun test
```

## License

MIT, see [LICENSE](LICENSE).

---

Built with BAKED
