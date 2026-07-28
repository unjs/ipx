# AGENTS.md

IPX — image optimizer (library + `ipx` CLI) powered by [sharp](https://sharp.pixelplumbing.com/) and [svgo](https://github.com/svg/svgo). This branch is **v4 (alpha)**; `v3` lives on its own branch.

## Commands

```sh
pnpm install          # pnpm only (workspace: root + examples/)
pnpm test             # lint + tsc --noEmit + vitest run --coverage  (what CI runs)
pnpm vitest <file>    # single test file / watch mode
pnpm test:types       # tsc --noEmit
pnpm lint             # eslint + prettier -c
pnpm lint:fix         # automd (regenerates README blocks) + eslint --fix + prettier -w
pnpm build            # obuild -> dist/
pnpm ipx serve --dir ./test/assets   # run the CLI straight from src (Node runs TS)
pnpm gen:operations   # regenerate assets/operations/ + the Modifiers table in README.md
```

## Layout

| Path                       | What                                                                         |
| -------------------------- | ---------------------------------------------------------------------------- |
| `src/index.ts`             | Public API surface — everything exported must be intentional                 |
| `src/ipx.ts`               | `createIPX()`: id/alias resolution, storage pick, SVG branch, sharp pipeline |
| `src/server.ts`            | `parseIPXURL`, h3 handler, caching/ETag/304, auto format, security headers   |
| `src/handlers/handlers.ts` | One `Handler` per modifier (`width`, `blur`, …) + aliases at the bottom      |
| `src/handlers/utils.ts`    | Arg mappers (`VNumber`, `VEnum`, `VColor`, …), clamping, `asModifierError`   |
| `src/storage/*`            | `node-fs`, `http`, `unstorage` backends implementing `IPXStorage`            |
| `src/svg.ts`               | SVGO sanitizer plugin (XSS hardening)                                        |
| `test/`                    | vitest, mirrors `src/`; fixtures in `test/assets*`                           |
| `scripts/operations.ts`    | Modifier docs data: one entry per modifier, drives the README table + samples |
| `scripts/gen-operations.ts` | Renders `assets/operations/*` with the real pipeline, then runs automd      |
| `automd.config.ts`         | `ipx-operations` generator for the README table (generated, do not hand-edit) |

## Conventions

- **ESM + TypeScript, relative imports carry the `.ts` extension** (`./utils.ts`). `verbatimModuleSyntax` is on, so type-only imports need `import type`.
- **Errors are `HTTPError` from h3** with a machine-readable `statusText` code (`IPX_FORBIDDEN_HOST`, `IPX_INVALID_MODIFIER_ARG`, …). Anything derived from user input must surface as a `4xx`, never an unhandled `500`.
- **Runtime deps are only `sharp` and `srvx`.** `h3`, `svgo`, `image-meta`, `etag`, `ufo`, `@fastify/accept-negotiator` are devDependencies that obuild bundles into `dist/`. Add new imports as devDependencies unless a runtime dep is truly intended.
- **No static `node:` imports in library code** — use `getBuiltinModule()` / `requireModule()` from `src/utils.ts` so the bundle stays loadable on non-Node runtimes.
- Options follow the pattern `userOption ?? getEnv("IPX_*") ?? default`.
- Prettier defaults; comments explain _why_ (especially the security rationale), not _what_.

## Security is the main constraint

Both the resource `id` and every modifier are attacker-controlled. Existing protections you must not regress:

- `ipxHttpStorage`: domain allowlist, `http(s)` only, redirects followed manually one hop at a time and re-validated (SSRF).
- `ipxFSStorage`: resolved path must stay inside the configured dir (traversal).
- `maxOutputDimension` (default 8192) clamps `width`/`height`/`resize`/`extend` so a tiny source cannot force a multi-GB allocation.
- SVG is always sanitized (`src/svg.ts`), even with optimization disabled.
- Server sends `content-security-policy: default-src 'none'` and `x-content-type-options: nosniff`.
- `safeString()` in `server.ts` escapes parser output — custom `parseURL` results are never trusted.

## Adding a modifier

1. Export a `Handler` from `src/handlers/handlers.ts`, using the validating `V*` arg mappers so bad input is a `400` before it reaches sharp. Clamp anything that drives allocation size.
2. Add the key to `IPXModifiers` in `src/ipx.ts` — the `satisfies Record<HandlerName, …>` check fails otherwise.
3. Tests in `test/handlers/handlers.test.ts` (unit, mocked pipe) **and** the real-sharp matrix in `test/index.test.ts` — mocking hides sharp's own validation.
4. Add an entry to `OPERATIONS` in `scripts/operations.ts` and run `pnpm gen:operations` — the Modifiers table in `README.md` is generated from it. The script fails on a modifier that is not listed there, so this step is not optional.

`README.md` is partly automd-generated (badges, `examples/*.ts` code blocks, the Modifiers table); edit the source of a block, then `pnpm lint:fix`.
