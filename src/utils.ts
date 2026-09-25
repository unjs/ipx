/**
 * Values are `JSON.parse`d so numbers and booleans (`IPX_FS_MAX_AGE=60`,
 * `IPX_FS_ALLOW_SYMLINKS_OUTSIDE_DIR=true`) come out typed. Anything that is not valid JSON
 * — a plain path such as `IPX_FS_DIR=./public` — is returned as the raw string rather than
 * throwing at startup.
 *
 * An empty value counts as unset: a blank `.env` placeholder or a compose `${VAR}` whose host
 * variable is missing would otherwise yield `""`, which slips past every `??` default
 * (`IPX_MAX_OUTPUT_DIMENSION=` silently disabled the output size limit).
 */
export function getEnv<T>(name: string): T | undefined {
  const value = globalThis.process?.env?.[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

/**
 * Returns `value` as valid `cache-control` delta-seconds (a non-negative integer, capped at
 * 2^31 per RFC 9111 §1.2.2), or `undefined` when it is not one (`NaN`, negative, `false`,
 * non-numeric string) so callers fall through to their default instead of sending
 * `max-age=NaN`. `0` is valid and kept.
 */
export function normalizeMaxAge(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number.parseInt(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
    return undefined;
  }
  return Math.min(Math.floor(n), 2 ** 31);
}

export function getBuiltinModule<T = any>(id: string): T | undefined {
  return globalThis.process?.getBuiltinModule?.(id) as T | undefined;
}

export function requireModule<T = any>(id: string): T {
  const { createRequire } = globalThis.process.getBuiltinModule("node:module");
  const require = createRequire(import.meta.url);
  return require(id) as T;
}

export function cachedPromise<T extends (...arguments_: any[]) => any>(
  function_: T,
) {
  let p: ReturnType<T>;
  return (...arguments_: Parameters<T>) => {
    if (p) {
      return p;
    }
    p = Promise.resolve(function_(...arguments_)) as ReturnType<T>;
    return p;
  };
}
