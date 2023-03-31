import { ServerResponse, IncomingMessage } from "node:http";
import { decode } from "ufo";
import getEtag from "etag";
import xss from "xss";
import { IPX } from "./ipx";
import { createError, isIPXError } from "./utils";

const MODIFIER_SEP = /[&,]/g;
const MODIFIER_VAL_SEP = /[:=_]/g;

export interface IPXHRequest {
  url: string;
  headers?: Record<string, string>;
  options?: any;
}

export interface IPXHResponse {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  body: any;
  error?: any;
}

export interface MiddlewareOptions {
  fallthrough?: boolean;
}

async function _handleRequest(
  request: IPXHRequest,
  ipx: IPX
): Promise<IPXHResponse> {
  const res: IPXHResponse = {
    statusCode: 200,
    statusMessage: "",
    headers: {},
    body: "",
  };

  // Parse URL
  const [modifiersString = "", ...idSegments] = request.url
    .slice(1 /* leading slash */)
    .split("/");
  const id = safeString(decode(idSegments.join("/")));

  // Validate
  if (!modifiersString) {
    throw createError("Modifiers are missing", 400, request.url);
  }
  if (!id || id === "/") {
    throw createError("Resource id is missing", 400, request.url);
  }

  // Contruct modifiers
  const modifiers: Record<string, string> = Object.create(null);

  // Read modifiers from first segment
  if (modifiersString !== "_") {
    for (const p of modifiersString.split(MODIFIER_SEP)) {
      const [key, value = ""] = p.split(MODIFIER_VAL_SEP);
      modifiers[safeString(key)] = safeString(decode(value));
    }
  }

  // Create request
  const img = ipx(id, modifiers, request.options);

  // Get image meta from source
  const source = await img.src();

  // Caching headers
  if (source.mtime) {
    if (
      request.headers["if-modified-since"] &&
      new Date(request.headers["if-modified-since"]) >= source.mtime
    ) {
      res.statusCode = 304;
      return res;
    }
    res.headers["Last-Modified"] = source.mtime.toUTCString();
  }
  if (typeof source.maxAge === "number") {
    res.headers[
      "Cache-Control"
    ] = `max-age=${+source.maxAge}, public, s-maxage=${+source.maxAge}`;
  }

  // Get converted image
  const { data, format } = await img.data();

  // ETag
  const etag = getEtag(data);
  res.headers.ETag = etag;
  if (etag && request.headers["if-none-match"] === etag) {
    res.statusCode = 304;
    return res;
  }

  // Mime
  if (format) {
    res.headers["Content-Type"] = `image/${format}`;
  }

  // Prevent XSS
  res.headers["Content-Security-Policy"] = "default-src 'none'";

  res.body = data;

  return sanetizeReponse(res);
}

export function handleRequest(
  request: IPXHRequest,
  ipx: IPX
): Promise<IPXHResponse> {
  return _handleRequest(request, ipx).catch((error) => {
    const statusCode = Number.parseInt(error.statusCode) || 500;
    // eslint-disable-next-line unicorn/prefer-logical-operator-over-ternary
    const statusMessage = error.statusMessage
      ? error.statusMessage
      : `IPX Error (${statusCode})`;
    if (process.env.NODE_ENV !== "production" && statusCode === 500) {
      console.error(error); // eslint-disable-line no-console
    }
    return sanetizeReponse({
      statusCode,
      statusMessage,
      body: "IPX Error: " + error,
      headers: {},
      error,
    });
  });
}

export function createIPXMiddleware(
  ipx: IPX,
  options: Partial<MiddlewareOptions> = {}
) {
  return function IPXMiddleware(
    request: IncomingMessage,
    res: ServerResponse,
    next?: (err?: any) => void
  ) {
    return handleRequest(
      { url: request.url, headers: request.headers as any },
      ipx
    ).then((_res) => {
      if (options.fallthrough && next && _res.error) {
        return next(_res.error);
      }
      res.statusCode = _res.statusCode;
      res.statusMessage = _res.statusMessage;
      for (const name in _res.headers) {
        res.setHeader(name, _res.headers[name]);
      }
      res.end(_res.body);
    });
  };
}

// --- Utils ---

function sanetizeReponse(res: IPXHResponse) {
  return <IPXHResponse>{
    statusCode: res.statusCode || 200,
    statusMessage: res.statusMessage ? safeString(res.statusMessage) : "OK",
    headers: safeStringObject(res.headers || {}),
    body:
      typeof res.body === "string" ? xss(safeString(res.body)) : res.body || "",
  };
}

function safeString(input: string) {
  return JSON.stringify(input).replace(/^"|"$/g, "");
}

function safeStringObject(input: Record<string, string>) {
  const dst = {};
  for (const key in input) {
    dst[key] = safeString(input[key]);
  }
  return dst;
}
