import destr from 'destr'

export function getEnv (name: string, defaultValue: any) {
  return destr(process.env[name]) ?? defaultValue
}

export function cachedPromise<T extends (...args: any[]) => any>(fn: T) {
  let p: Promise<ReturnType<T>>
  return (...args: Parameters<T>) => {
    if (p) {
      return p
    }
    p = Promise.resolve(fn(...args))
    return p
  }
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
