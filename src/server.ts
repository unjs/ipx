import { negotiate } from "@fastify/accept-negotiator";
import { decode } from "ufo";
import getEtag from "etag";
import {
  defineEventHandler,
  getRequestHeader,
  setResponseHeader,
  setResponseStatus,
  createApp,
  toNodeListener,
  toPlainHandler,
  toWebHandler,
  createError,
  H3Event,
  H3Error,
  send,
  appendResponseHeader,
  getResponseHeader,
} from "h3";
import { IPX } from "./ipx";

const MODIFIER_SEP = /[&,]/g;
const MODIFIER_VAL_SEP = /[:=_]/;
const ID_FORMAT = /^(.+)@@(.+)\.([^.]+)$/;

/**
 * Creates an H3 handler to handle images using IPX.
 * @param {IPX} ipx - An IPX instance to handle image requests.
 * @returns {H3Event} An H3 event handler that processes image requests, applies modifiers, handles caching,
 * and returns the processed image data. See {@link H3Event}.
 * @throws {H3Error} If there are problems with the request parameters or processing the image. See {@link H3Error}.
 */
export function createIPXH3Handler(ipx: IPX) {
  const _handler = async (event: H3Event) => {
    // Parse URL
    const { modifiers, id } = parseUrlPath(event.path);

    // Validate
    if (!id || id === "/") {
      throw createError({
        statusCode: 400,
        statusText: `IPX_MISSING_ID`,
        message: `Resource id is missing or malformed: ${event.path}`,
      });
    }

    // Auto format
    const mFormat = modifiers.f || modifiers.format;
    if (mFormat === "auto") {
      const acceptHeader = getRequestHeader(event, "accept") || "";
      const animated = modifiers.animated ?? modifiers.a;
      const autoFormat = autoDetectFormat(
        acceptHeader,
        // #234 "animated" param adds {animated: ''} to the modifiers
        // TODO: fix modifiers to normalized to boolean
        !!animated || animated === "",
      );
      delete modifiers.f;
      delete modifiers.format;
      if (autoFormat) {
        modifiers.format = autoFormat;
        appendResponseHeader(event, "vary", "Accept");
      }
    }

    // Create request
    const img = ipx(id, modifiers);

    // Get image meta from source
    const sourceMeta = await img.getSourceMeta();

    // Send CSP headers to prevent XSS
    sendResponseHeaderIfNotSet(
      event,
      "content-security-policy",
      "default-src 'none'",
    );

    // Handle modified time if available
    if (sourceMeta.mtime) {
      // Send Last-Modified header
      sendResponseHeaderIfNotSet(
        event,
        "last-modified",
        sourceMeta.mtime.toUTCString(),
      );

      // Check for last-modified request header
      const _ifModifiedSince = getRequestHeader(event, "if-modified-since");
      if (_ifModifiedSince && new Date(_ifModifiedSince) >= sourceMeta.mtime) {
        setResponseStatus(event, 304);
        return send(event);
      }
    }

    // Process image
    const { data, format } = await img.process();

    // Send Cache-Control header
    if (typeof sourceMeta.maxAge === "number") {
      sendResponseHeaderIfNotSet(
        event,
        "cache-control",
        `max-age=${+sourceMeta.maxAge}, public, s-maxage=${+sourceMeta.maxAge}`,
      );
    }

    // Generate and send ETag header
    const etag = getEtag(data);
    sendResponseHeaderIfNotSet(event, "etag", etag);

    // Check for if-none-match request header
    if (etag && getRequestHeader(event, "if-none-match") === etag) {
      setResponseStatus(event, 304);
      return send(event);
    }

    // Content-Type header
    if (format) {
      sendResponseHeaderIfNotSet(event, "content-type", `image/${format}`);
    }

    return data;
  };

  return defineEventHandler(async (event) => {
    try {
      return await _handler(event);
    } catch (_error: unknown) {
      const error = createError(_error as H3Error);
      setResponseStatus(event, error.statusCode, error.statusMessage);
      return {
        error: {
          message: `[${error.statusCode}] [${
            error.statusMessage || "IPX_ERROR"
          }] ${error.message}`,
        },
      };
    }
  });
}

/**
 * Creates an H3 application configured to handle image processing using a supplied IPX instance.
 * @param {IPX} ipx - An IPX instance to handle image handling requests.
 * @returns {any} An H3 application configured to use the IPX image handler.
 */
export function createIPXH3App(ipx: IPX) {
  const app = createApp({ debug: true });
  app.use(createIPXH3Handler(ipx));
  return app;
}

/**
 * Creates a web server that can handle IPX image processing requests using an H3 application.
 * @param {IPX} ipx - An IPX instance configured for the server. See {@link IPX}.
 * @returns {any} A web handler suitable for use with web server environments that support the H3 library.
 */
export function createIPXWebServer(ipx: IPX) {
  return toWebHandler(createIPXH3App(ipx));
}

/**
 * Creates a web server that can handle IPX image processing requests using an H3 application.
 * @param {IPX} ipx - An IPX instance configured for the server. See {@link IPX}.
 * @returns {any} A web handler suitable for use with web server environments that support the H3 library.
 */
export function createIPXNodeServer(ipx: IPX) {
  return toNodeListener(createIPXH3App(ipx));
}

/**
 * Creates a simple server that can handle IPX image processing requests using an H3 application.
 * @param {IPX} ipx - An IPX instance configured for the server.
 * @returns {any} A handler suitable for plain HTTP server environments that support the H3 library.
 */
export function createIPXPlainServer(ipx: IPX) {
  return toPlainHandler(createIPXH3App(ipx));
}

// --- Utils ---

function sendResponseHeaderIfNotSet(event: H3Event, name: string, value: any) {
  if (!getResponseHeader(event, name)) {
    setResponseHeader(event, name, value);
  }
}

function autoDetectFormat(acceptHeader: string, animated: boolean) {
  if (animated) {
    const acceptMime = negotiate(acceptHeader, ["image/webp", "image/gif"]);
    return acceptMime?.split("/")[1] || "gif";
  }
  const acceptMime = negotiate(acceptHeader, [
    "image/avif",
    "image/webp",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/heif",
    "image/gif",
  ]);
  return acceptMime?.split("/")[1] || "jpeg";
}

function safeString(input: string) {
  return JSON.stringify(input)
    .replace(/^"|"$/g, "")
    .replace(/\\+/g, "\\")
    .replace(/\\"/g, '"');
}

function parseUrlPath(path: string): {
  modifiers: Record<string, string>;
  id: string;
} {
  const [modifiersString = "", ...idSegments] = path
    .slice(1 /* leading slash */)
    .split("/");

  const id = safeString(decode(idSegments.join("/")));

  if (modifiersString === "~") {
    const matches = id.match(ID_FORMAT);

    if (matches != null) {
      const modifiers = parseModifiersString(matches[2]);
      modifiers.format = matches[3];
      delete modifiers.f;

      return {
        modifiers,
        id: matches[1],
      };
    }
  }

  return {
    modifiers: parseModifiersString(modifiersString),
    id,
  };
}

function parseModifiersString(input: string): Record<string, string> {
  const modifiers: Record<string, string> = Object.create(null);

  if (input === "" || input === "_" || input === "~") {
    return modifiers;
  }

  for (const p of input.split(MODIFIER_SEP)) {
    const [key, ...values] = p.split(MODIFIER_VAL_SEP);
    modifiers[safeString(key)] = values
      .map((v) => safeString(decode(v)))
      .join("_");
  }

  return modifiers;
}
