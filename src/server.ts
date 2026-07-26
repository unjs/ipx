import getEtag from "etag";
import { negotiate } from "@fastify/accept-negotiator";
import { defineEventHandler, HTTPError } from "h3";
import { getBuiltinModule, requireModule } from "./utils.ts";

import type { IPX } from "./ipx.ts";
import type { H3Event, EventHandlerWithFetch } from "h3";
import type { NodeHttpHandler, Server, ServerOptions } from "srvx";

export type FetchHandler = (
  request: Request | string | URL,
) => Response | Promise<Response>;

export interface IPXHandlerOptions {
  /**
   * Custom URL parser to extract the resource id and modifiers from the request URL.
   * Can be async.
   *
   * Receives the raw (absolute, still percent-encoded) request URL, so parsers can
   * decode it themselves without going through h3's normalization.
   *
   * Defaults to {@link parseIPXURL} which handles URLs in the form `/<modifiers>/<id>`.
   *
   * Returned values are escaped (control characters) by the handler, so custom parsers
   * do not need to escape them. This is not an access check: exactly as with the default
   * parser, what the resulting `id` is allowed to resolve to is enforced by the storage
   * layer. Throw an `HTTPError` to reject a request with a specific status code.
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
   *
   * Values are coerced to strings. Use `""` (or `undefined`) for valueless
   * modifiers such as `grayscale`.
   */
  modifiers: Record<string, string | number | boolean | undefined>;
}

export type IPXURLParser = (
  url: string,
) => IPXParsedURL | Promise<IPXParsedURL>;

const MODIFIER_SEP = /[&,]/g;
const MODIFIER_VAL_SEP = /[:=_]/;

/**
 * Default IPX URL parser, handling URLs in the form `/<modifiers>/<id>`.
 *
 * Use `_` as the modifiers segment to apply none (`/_/image.png`).
 *
 * @param {string} url - The raw (absolute) request URL.
 * @returns {IPXParsedURL} The parsed resource id and modifiers. See {@link IPXParsedURL}.
 * @throws {HTTPError} If the modifiers segment is missing.
 */
export function parseIPXURL(url: string): IPXParsedURL {
  const [modifiersString = "", ...idSegments] = new URL(url).pathname
    .slice(1 /* leading slash */)
    .split("/");

  const id = decode(idSegments.join("/"));

  if (!modifiersString) {
    throw new HTTPError({
      statusCode: 400,
      statusText: "IPX_MISSING_MODIFIERS",
      message: `Modifiers are missing: ${safeString(id)}`,
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
}

// --- Handler ---

function createIPXHandler(
  ipx: IPX,
  opts: IPXHandlerOptions = {},
): EventHandlerWithFetch {
  const parseURL = opts.parseURL || parseIPXURL;

  return defineEventHandler(async (event: H3Event) => {
    // Parse URL (never trust the parser output: it can be user provided)
    // `event.req.url` is used over `event.url` since the latter is normalized by
    // h3, silently dropping percent-encoded tab/newline/carriage-return.
    const parsed: Partial<IPXParsedURL> = (await parseURL(event.req.url)) || {};

    // Escape and validate id
    const id = safeString(parsed.id);
    if (!id || id === "/") {
      throw new HTTPError({
        statusCode: 400,
        statusText: "IPX_MISSING_ID",
        message: `Resource id is missing: ${event.path}`,
      });
    }

    // Escape modifiers
    const modifiers: Record<string, string> = Object.create(null);
    for (const [key, value] of Object.entries(parsed.modifiers || {})) {
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

    // Prevent MIME type sniffing (crafted image files could be sniffed as HTML)
    sendResponseHeaderIfNotSet(event, "x-content-type-options", "nosniff");

    // Send Cache-Control header (also sent with 304 responses)
    if (typeof sourceMeta.maxAge === "number") {
      sendResponseHeaderIfNotSet(
        event,
        "cache-control",
        `max-age=${+sourceMeta.maxAge}, public, s-maxage=${+sourceMeta.maxAge}`,
      );
    }

    const ifNoneMatch = event.req.headers.get("if-none-match");

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

    // A weak ETag derived from the source mtime and the (already normalized)
    // request params identifies the response without reading or processing the
    // image, so revalidation requests can be answered before paying for it.
    const weakEtag = sourceMeta.mtime
      ? getWeakEtag(id, modifiers, sourceMeta.mtime)
      : undefined;
    if (weakEtag) {
      sendResponseHeaderIfNotSet(event, "etag", weakEtag);
      if (etagMatches(ifNoneMatch, weakEtag)) {
        event.res.status = 304;
        return;
      }
    }

    // Process image
    const { data, format } = await img.process();

    // Fallback to a content based ETag when the source has no mtime (or when
    // hashing is unavailable) so that responses always have a validator.
    if (!weakEtag) {
      const etag = getEtag(data);
      sendResponseHeaderIfNotSet(event, "etag", etag);

      // Check for if-none-match request header
      if (etagMatches(ifNoneMatch, etag)) {
        event.res.status = 304;
        return;
      }
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

/**
 * Compute a weak ETag from the inputs that fully determine the response:
 * the source modification time and the request params.
 *
 * It is weak since it is not derived from the response bytes (the exact output
 * also depends on the sharp/svgo versions and options) but it is stable for a
 * given source revision and request, which is what validators need.
 *
 * Returns `undefined` when no hashing is available in the current runtime.
 */
function getWeakEtag(
  id: string,
  modifiers: Record<string, string>,
  mtime: Date,
): string | undefined {
  const crypto = getBuiltinModule<typeof import("node:crypto")>("node:crypto");
  if (!crypto?.createHash) {
    return;
  }
  // Modifiers are serialized with sorted keys to be order independent
  const key = JSON.stringify([
    mtime.getTime(),
    id,
    Object.keys(modifiers)
      .sort()
      .map((key) => [key, modifiers[key]]),
  ]);
  const hash = crypto.createHash("sha256").update(key).digest("base64url");
  return `W/"${hash.slice(0, 27)}"`;
}

/**
 * Check an `if-none-match` header (possibly a list) against the sent ETag
 * using the weak comparison function (RFC 9110).
 */
function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch || !etag) {
    return false;
  }
  if (ifNoneMatch === "*") {
    return true;
  }
  const opaque = opaqueTag(etag);
  return ifNoneMatch.split(",").some((tag) => opaqueTag(tag.trim()) === opaque);
}

function opaqueTag(tag: string): string {
  return tag.startsWith("W/") ? tag.slice(2) : tag;
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

function decode(input: string) {
  try {
    return decodeURIComponent(input);
  } catch {
    // Keep malformed percent-encoding as-is (e.g. `100%.jpg`)
    return input;
  }
}

function safeString(input: unknown) {
  return JSON.stringify(input ?? "")
    .replace(/^"|"$/g, "")
    .replace(/\\+/g, "\\")
    .replace(/\\"/g, '"');
}
