import destr from 'destr'

export function getEnv (name: string, defaultValue: any) {
  return destr(process.env[name]) ?? defaultValue
}

export function cachedPromise<T extends Function> (fn: T): T {
  let p
  return ((...args) => {
    if (p) { return p }
    p = Promise.resolve(fn(...args))
    return p
  }) as unknown as T
}

export class IPXError extends Error {
  statusCode?: number
  statusMessage?: string
}

export function createError (message: string, statusCode: number): IPXError {
  const err = new IPXError(message)
  err.statusMessage = message
  err.statusCode = statusCode
  return err
}
