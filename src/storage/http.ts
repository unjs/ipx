import { ofetch } from "ofetch";
import { createError } from "h3";
import { getEnv } from "../utils";
import type { IPXStorage } from "../types";

export type HTTPStorageOptions = {
  /**
   * Custom options for fetch operations, such as headers or method overrides.
   * @optional
   */
  fetchOptions?: RequestInit;

  /**
   * Default maximum age (in seconds) for cache control. If not specified, defaults to the environment setting or 300 seconds.
   * @optional
   */
  maxAge?: number;

  /**
   * Whitelist of domains from which resource fetching is allowed. Can be a single string or an array of strings.
   * @optional
   */
  domains?: string | string[];

  /**
   * If set to true, allows retrieval from any domain. Overrides the domain whitelist.
   * @optional
   */
  allowAllDomains?: boolean;

  /**
   * If set to true, ignore the cache control header in responses and use the default or specified maxAge.
   * @optional
   */
  ignoreCacheControl?: boolean;
};

const HTTP_RE = /^https?:\/\//;

/**
 * Creates an HTTP storage handler for IPX that fetches image data from external URLs.
 * This handler allows configuration to specify allowed domains, caching behaviour and custom fetch options.
 *
 * @param {HTTPStorageOptions} [_options={}] - Configuration options for HTTP storage, with defaults possibly taken from environment variables. See {@link HTTPStorageOptions}.
 * @returns {IPXStorage} An IPXStorage interface implementation for retrieving images over HTTP. See {@link IPXStorage}.
 * @throws {H3Error} If validation of the requested URL fails due to a missing hostname or denied host access. See {@link H3Error}.
 */
export function ipxHttpStorage(_options: HTTPStorageOptions = {}): IPXStorage {
  const allowAllDomains =
    _options.allowAllDomains ?? getEnv("IPX_HTTP_ALLOW_ALL_DOMAINS") ?? false;
  let _domains =
    _options.domains || getEnv<string | string[]>("IPX_HTTP_DOMAINS") || [];
  const defaultMaxAge =
    _options.maxAge || getEnv<string | number>("IPX_HTTP_MAX_AGE") || 300;
  const fetchOptions =
    _options.fetchOptions || getEnv("IPX_HTTP_FETCH_OPTIONS") || {};

  if (typeof _domains === "string") {
    _domains = _domains.split(",").map((s) => s.trim());
  }

  const domains = new Set(
    _domains
      .map((d) => {
        if (!HTTP_RE.test(d)) {
          d = "http://" + d;
        }
        return new URL(d).hostname;
      })
      .filter(Boolean),
  );

  function validateId(id: string) {
    const url = new URL(decodeURIComponent(id));
    if (!url.hostname) {
      throw createError({
        statusCode: 403,
        statusText: `IPX_MISSING_HOSTNAME`,
        message: `Hostname is missing: ${id}`,
      });
    }
    if (!allowAllDomains && !domains.has(url.hostname)) {
      throw createError({
        statusCode: 403,
        statusText: `IPX_FORBIDDEN_HOST`,
        message: `Forbidden host: ${url.hostname}`,
      });
    }
    return url.toString();
  }

  function parseResponse(response: Response) {
    let maxAge = defaultMaxAge;
    if (_options.ignoreCacheControl !== true) {
      const _cacheControl = response.headers.get("cache-control");
      if (_cacheControl) {
        const m = _cacheControl.match(/max-age=(\d+)/);
        if (m && m[1]) {
          maxAge = Number.parseInt(m[1]);
        }
      }
    }

    let mtime;
    const _lastModified = response.headers.get("last-modified");
    if (_lastModified) {
      mtime = new Date(_lastModified);
    }

    return { maxAge, mtime };
  }

  return {
    name: "ipx:http",
    async getMeta(id) {
      const url = validateId(id);
      try {
        const response = await ofetch.raw(url, {
          ...fetchOptions,
          method: "HEAD",
        });
        const { maxAge, mtime } = parseResponse(response);
        return { mtime, maxAge };
      } catch {
        return {};
      }
    },
    async getData(id) {
      const url = validateId(id);
      const response = await ofetch(url, {
        ...fetchOptions,
        method: "GET",
        responseType: "arrayBuffer",
      });
      return response;
    },
  };
}
