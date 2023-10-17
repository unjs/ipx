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

export function createIPXH3Handler(ipx: IPX) {
  const _handler = async (event: H3Event) => {
    // Parse URL
    const [modifiersString = "", ...idSegments] = event.path
      .slice(1 /* leading slash */)
      .split("/");

    const id = safeString(decode(idSegments.join("/")));

    // Validate
    if (!modifiersString) {
      throw createError({
        statusCode: 400,
        statusText: `IPX_MISSING_MODIFIERS`,
        message: `Modifiers are missing: ${id}`,
      });
    }
    if (!id || id === "/") {
      throw createError({
        statusCode: 400,
        statusText: `IPX_MISSING_ID`,
        message: `Resource id is missing: ${event.path}`,
      });
    }

    // Contruct modifiers
    const modifiers: Record<string, string> = Object.create(null);

    // Read modifiers from first segment
    if (modifiersString !== "_") {
      for (const p of modifiersString.split(MODIFIER_SEP)) {
        const [key, ...values] = p.split(MODIFIER_VAL_SEP);
        modifiers[safeString(key)] = values
          .map((v) => safeString(decode(v)))
          .join("_");
      }
    }

    // Auto format
    const mFormat = modifiers.f || modifiers.format;
    if (mFormat === "auto") {
      const acceptHeader = getRequestHeader(event, "accept") || "";
      const autoFormat = autoDetectFormat(
        acceptHeader,
        !!(modifiers.a || modifiers.animated),
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

    // Send Cache-Control header
    if (typeof sourceMeta.maxAge === "number") {
      sendResponseHeaderIfNotSet(
        event,
        "cache-control",
        `max-age=${+sourceMeta.maxAge}, public, s-maxage=${+sourceMeta.maxAge}`,
      );
    }

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

export function createIPXH3App(ipx: IPX) {
  const app = createApp({ debug: true });
  app.use(createIPXH3Handler(ipx));
  return app;
}

export function createIPXWebServer(ipx: IPX) {
  return toWebHandler(createIPXH3App(ipx));
}

export function createIPXNodeServer(ipx: IPX) {
  return toNodeListener(createIPXH3App(ipx));
}

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
