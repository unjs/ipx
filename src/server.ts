import getEtag from "etag";
import { negotiate } from "@fastify/accept-negotiator";
import { decode } from "ufo";
import { defineEventHandler, HTTPError } from "h3";
import { toNodeHandler } from "srvx/node";

import type { IPX } from "./ipx.ts";
import type { H3Event, EventHandlerWithFetch } from "h3";
import type { NodeHttpHandler } from "srvx";

export type FetchHandler = (
  request: Request | string | URL,
) => Response | Promise<Response>;

export function createIPXFetchHandler(ipx: IPX): FetchHandler {
  return createIPXHandler(ipx).fetch as FetchHandler;
}

export function createIPXNodeHandler(ipx: IPX): NodeHttpHandler {
  const fetch = createIPXFetchHandler(ipx);
  return toNodeHandler(fetch);
}

// --- Handler ---

const MODIFIER_SEP = /[&,]/g;
const MODIFIER_VAL_SEP = /[:=_]/;

function createIPXHandler(ipx: IPX): EventHandlerWithFetch {
  return defineEventHandler(async (event: H3Event) => {
    // Parse URL
    const [modifiersString = "", ...idSegments] = event.url.pathname
      .slice(1 /* leading slash */)
      .split("/");

    const id = safeString(decode(idSegments.join("/")));

    // Validate
    if (!modifiersString) {
      throw new HTTPError({
        statusCode: 400,
        statusText: "IPX_MISSING_MODIFIERS",
        message: `Modifiers are missing: ${id}`,
      });
    }
    if (!id || id === "/") {
      throw new HTTPError({
        statusCode: 400,
        statusText: "IPX_MISSING_ID",
        message: `Resource id is missing: ${event.path}`,
      });
    }

    // Construct modifiers
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
      const acceptHeader = event.req.headers.get("accept") || "";
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
        event.res.headers.append("vary", "Accept");
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
      const _ifModifiedSince = event.req.headers.get("if-modified-since");
      if (_ifModifiedSince && new Date(_ifModifiedSince) >= sourceMeta.mtime) {
        event.res.status = 304;
        return;
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
    if (etag && event.req.headers.get("if-none-match") === etag) {
      event.res.status = 304;
      return;
    }

    // Content-Type header
    if (format) {
      sendResponseHeaderIfNotSet(event, "content-type", `image/${format}`);
    }

    return data;
  });
}

// --- Utils ---

function sendResponseHeaderIfNotSet(event: H3Event, name: string, value: any) {
  if (!event.res.headers.has(name)) {
    event.res.headers.set(name, value);
  }
}

function autoDetectFormat(acceptHeader: string, animated: boolean): string {
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

function safeString(input: string | undefined) {
  return JSON.stringify(input)
    .replace(/^"|"$/g, "")
    .replace(/\\+/g, "\\")
    .replace(/\\"/g, '"');
}
