import getEtag from "etag";
import { negotiate } from "@fastify/accept-negotiator";
import { decode } from "ufo";
import { defineEventHandler, HTTPError } from "h3";
import { requireModule } from "./utils.ts";

import type { IPX } from "./ipx.ts";
import type { H3Event, EventHandlerWithFetch } from "h3";
import type { NodeHttpHandler, Server, ServerOptions } from "srvx";

export type FetchHandler = (
  request: Request | string | URL,
) => Response | Promise<Response>;

export interface IPXHandlerOptions {
  /**
   * Custom URL parser to extract the resource id and modifiers from the request URL.
   *
   * Defaults to {@link parseIPXURL} which handles URLs in the form `/<modifiers>/<id>`.
   *
   * The returned `id` and `modifiers` are always escaped by the handler, so custom
   * parsers do not need to (and should not) escape them.
   *
   * @optional
   */
  parseURL?: IPXURLParser;
}

export function createIPXFetchHandler(
  ipx: IPX,
  opts?: IPXHandlerOptions,
): FetchHandler {
  return createIPXHandler(ipx, opts).fetch as FetchHandler;
}

export function createIPXNodeHandler(
  ipx: IPX,
  opts?: IPXHandlerOptions,
): NodeHttpHandler {
  const { toNodeHandler } =
    requireModule<typeof import("srvx/node")>("srvx/node");
  const fetch = createIPXFetchHandler(ipx, opts);
  return toNodeHandler(fetch);
}

export function serveIPX(
  ipx: IPX,
  opts?: Omit<ServerOptions, "fetch"> & IPXHandlerOptions,
): Server {
  const { serve } = requireModule<typeof import("srvx")>("srvx");
  const { parseURL, ...serverOptions } = opts || {};
  const fetch = createIPXFetchHandler(ipx, { parseURL });
  return serve({ ...serverOptions, fetch });
}

// --- URL Parser ---

export interface IPXParsedURL {
  /**
   * The identifier of the source image (path or URL, depending on the storage).
   */
  id: string;

  /**
   * Modifiers to apply, keyed by modifier name. See {@link IPXModifiers}.
   */
  modifiers: Record<string, string>;
}

export type IPXURLParser = (url: URL) => IPXParsedURL;

const MODIFIER_SEP = /[&,]/g;
const MODIFIER_VAL_SEP = /[:=_]/;

/**
 * Default IPX URL parser, handling URLs in the form `/<modifiers>/<id>`.
 *
 * Use `_` as the modifiers segment to apply none (`/_/image.png`).
 *
 * @param {URL} url - The request URL. See {@link URL}.
 * @returns {IPXParsedURL} The parsed resource id and modifiers. See {@link IPXParsedURL}.
 * @throws {HTTPError} If the modifiers segment is missing.
 */
export const parseIPXURL: IPXURLParser = (url) => {
  const [modifiersString = "", ...idSegments] = url.pathname
    .slice(1 /* leading slash */)
    .split("/");

  const id = decode(idSegments.join("/"));

  if (!modifiersString) {
    throw new HTTPError({
      statusCode: 400,
      statusText: "IPX_MISSING_MODIFIERS",
      message: `Modifiers are missing: ${id}`,
    });
  }

  const modifiers: Record<string, string> = Object.create(null);

  if (modifiersString !== "_") {
    for (const p of modifiersString.split(MODIFIER_SEP)) {
      const [key = "", ...values] = p.split(MODIFIER_VAL_SEP);
      modifiers[key] = values.map((v) => decode(v)).join("_");
    }
  }

  return { id, modifiers };
};

// --- Handler ---

function createIPXHandler(
  ipx: IPX,
  opts: IPXHandlerOptions = {},
): EventHandlerWithFetch {
  const parseURL = opts.parseURL || parseIPXURL;

  return defineEventHandler(async (event: H3Event) => {
    // Parse URL
    const parsed = parseURL(event.url);

    // Sanitize and validate id
    const id = safeString(parsed.id);
    if (!id || id === "/") {
      throw new HTTPError({
        statusCode: 400,
        statusText: "IPX_MISSING_ID",
        message: `Resource id is missing: ${event.path}`,
      });
    }

    // Sanitize modifiers (never trust the parser output)
    const modifiers: Record<string, string> = Object.create(null);
    for (const [key, value] of Object.entries(parsed.modifiers)) {
      modifiers[safeString(key)] = safeString(value);
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
