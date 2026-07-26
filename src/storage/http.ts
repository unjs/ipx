import { HTTPError } from "h3";
import { getEnv } from "../utils.ts";
import type { IPXStorage } from "../types.ts";

export type HTTPStorageOptions = {
  /**
   * Custom options for fetch operations, such as headers or method overrides.
   *
   * Redirects are followed manually (one hop at a time) so that each redirect target
   * can be re-validated against the {@link HTTPStorageOptions.domains} allowlist.
   * Explicitly setting `redirect` here opts out of this protection: the value is passed
   * to `fetch` as-is and redirect targets are **not** validated (a redirect to an
   * internal address is then possible: SSRF).
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
   *
   * Only `http:` and `https:` URLs are allowed. Redirects are followed only within this
   * allowlist (up to 3 hops): a redirect to a host that is not listed is rejected with
   * `403 IPX_FORBIDDEN_HOST`, so an allowlisted host cannot bounce IPX to an internal
   * address. Hosts that redirect to a CDN must have the CDN hostname listed here too.
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

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

/** Maximum number of redirects followed when they are re-validated. */
const MAX_REDIRECTS = 3;

function decode(input: string) {
  try {
    return decodeURIComponent(input);
  } catch {
    // Keep malformed percent-encoding as-is (e.g. `100%.jpg`)
    return input;
  }
}

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
  const fetchOptions: RequestInit =
    _options.fetchOptions ||
    getEnv<RequestInit>("IPX_HTTP_FETCH_OPTIONS") ||
    {};

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
    let url: URL;
    try {
      // Ids are usually already decoded by the URL parser but the storage API
      // can also be used directly with still encoded ids.
      url = new URL(decode(id));
    } catch {
      throw new HTTPError({
        statusCode: 400,
        statusText: `IPX_INVALID_URL`,
        message: `Invalid URL: ${id}`,
      });
    }
    validateURL(url, id);
    return url.toString();
  }

  function validateURL(url: URL, id: string = url.toString()) {
    if (!url.hostname) {
      throw new HTTPError({
        statusCode: 403,
        statusText: `IPX_MISSING_HOSTNAME`,
        message: `Hostname is missing: ${id}`,
      });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new HTTPError({
        statusCode: 403,
        statusText: `IPX_FORBIDDEN_PROTOCOL`,
        message: `Forbidden protocol: ${url.protocol}`,
      });
    }
    if (!allowAllDomains && !domains.has(url.hostname)) {
      throw new HTTPError({
        statusCode: 403,
        statusText: `IPX_FORBIDDEN_HOST`,
        message: `Forbidden host: ${url.hostname}`,
      });
    }
  }

  /**
   * Fetches `url`, following redirects manually so that every hop is re-validated
   * against the allowlist (see {@link validateURL}).
   *
   * Skipped (plain `fetch` with default redirect handling) when all domains are
   * allowed (nothing to validate) or when the user explicitly set `redirect` in
   * `fetchOptions` (opt-out).
   */
  async function fetchURL(url: string, init?: RequestInit): Promise<Response> {
    const _init: RequestInit = { ...fetchOptions, ...init };

    if (allowAllDomains || _init.redirect) {
      return fetch(url, _init);
    }

    let currentURL = url;
    let method = _init.method || "GET";

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const response = await fetch(currentURL, {
        ..._init,
        method,
        redirect: "manual",
      });

      if (!REDIRECT_STATUS.has(response.status)) {
        return response;
      }

      const location = response.headers.get("location");
      if (!location) {
        // Not an actionable redirect, treat it as the final response.
        return response;
      }

      let nextURL: URL;
      try {
        nextURL = new URL(location, currentURL);
      } catch {
        throw new HTTPError({
          statusCode: 502,
          statusText: `IPX_INVALID_REDIRECT`,
          message: `Invalid redirect location: ${location}`,
        });
      }

      validateURL(nextURL, location);

      // Per fetch semantics, 303 rewrites the request to GET (HEAD is kept as-is).
      if (response.status === 303 && method !== "HEAD") {
        method = "GET";
      }
      currentURL = nextURL.toString();
    }

    throw new HTTPError({
      statusCode: 502,
      statusText: `IPX_TOO_MANY_REDIRECTS`,
      message: `Too many redirects (max ${MAX_REDIRECTS}): ${url}`,
    });
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
        const response = await fetchURL(url, { method: "HEAD" });
        if (!response.ok) {
          return {};
        }
        const { maxAge, mtime } = parseResponse(response);
        return { mtime, maxAge };
      } catch {
        return {};
      }
    },
    async getData(id) {
      const url = validateId(id);
      const response = await fetchURL(url);
      if (!response.ok) {
        throw new HTTPError({
          statusCode: response.status,
          statusText: response.statusText,
          message: `Failed to fetch ${id}: ${response.status} ${response.statusText}`,
        });
      }
      return await response.arrayBuffer();
    },
  };
}
