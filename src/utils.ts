import destr from 'destr'

export function getEnv (name: string, defaultValue: any) {
  return destr(process.env[name]) ?? defaultValue
}

export function cachedPromise<T extends (...args: any[]) => any>(fn: T) {
  let p: ReturnType<T>
  return (...args: Parameters<T>) => {
    if (p) {
      return p
    }
    p = Promise.resolve(fn(...args)) as ReturnType<T>
    return p
  }
}

export class IPXError extends Error {
  statusCode?: number
  statusMessage?: string
}

export function createError (statusMessage: string, statusCode: number, trace?: string): IPXError {
  const err = new IPXError(statusMessage + (trace ? ` (${trace})` : ''))
  err.statusMessage = 'IPX: ' + statusMessage
  err.statusCode = statusCode
  return err
}
