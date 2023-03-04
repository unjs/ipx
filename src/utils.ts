import destr from "destr";

export function getEnv (name: string, defaultValue: any) {
  return destr(process.env[name]) ?? defaultValue;
}

export function cachedPromise<T extends (...arguments_: any[]) => any>(function_: T) {
  let p: ReturnType<T>;
  return (...arguments_: Parameters<T>) => {
    if (p) {
      return p;
    }
    p = Promise.resolve(function_(...arguments_)) as ReturnType<T>;
    return p;
  };
}

export class IPXError extends Error {
  statusCode?: number;
  statusMessage?: string;
}

export function createError (statusMessage: string, statusCode: number, trace?: string): IPXError {
  const error = new IPXError(statusMessage + (trace ? ` (${trace})` : ""));
  error.statusMessage = "IPX: " + statusMessage;
  error.statusCode = statusCode;
  return error;
}

export function isIPXError (val): val is IPXError {
  if (!val || typeof val !== "object") {
    return false;
  }

  if (val instanceof IPXError) {
    return true;
  }

  return typeof val.statusMessage === "string" && val.statusMessage.startsWith("IPX: ") &&
    typeof val.statusCode === "number" && val instanceof Error;
}
