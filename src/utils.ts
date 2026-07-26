export function getEnv<T>(name: string): T | undefined {
  const value = globalThis.process?.env?.[name];
  if (value !== undefined) {
    return JSON.parse(value) as T;
  }
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
