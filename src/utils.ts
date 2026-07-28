/**
 * Values are `JSON.parse`d so numbers and booleans (`IPX_FS_MAX_AGE=60`,
 * `IPX_FS_ALLOW_SYMLINKS_OUTSIDE_DIR=true`) come out typed. Anything that is not valid JSON
 * — a plain path such as `IPX_FS_DIR=./public` — is returned as the raw string rather than
 * throwing at startup.
 */
export function getEnv<T>(name: string): T | undefined {
  const value = globalThis.process?.env?.[name];
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
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
