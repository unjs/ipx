import { fetch } from "node-fetch-native";
import { createError, getEnv } from "../utils";
import type { IPXStorage } from "../types";

export type HTTPStorageOptions = {
  fetchOptions?: RequestInit;
  maxAge?: number;
  domains?: string | string[];
};

const HTTP_RE = /^https?:\/\//;

export function ipxHttpStorage(_options: HTTPStorageOptions = {}): IPXStorage {
  let _domains =
    _options.domains || getEnv<string | string[]>("IPX_HTTP_DOMAINS") || [];
  const defaultMaxAge =
    _options.maxAge || getEnv<string | number>("IPX_HTTP_MAX_AGE");
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

  // eslint-disable-next-line unicorn/consistent-function-scoping
  function validateId(id: string, opts: { bypassDomain?: boolean } = {}) {
    const url = new URL(decodeURIComponent(id));
    if (!url.hostname) {
      throw createError("Hostname is missing", 403, id);
    }
    if (!opts?.bypassDomain && !domains.has(url.hostname)) {
      throw createError("Forbidden host", 403, url.hostname);
    }
    return url.toString();
  }

  // eslint-disable-next-line unicorn/consistent-function-scoping
  function parseResponse(response: Response) {
    if (!response.ok) {
      throw createError(
        "Fetch error",
        response.status || 500,
        response.statusText,
      );
    }

    let maxAge = defaultMaxAge;
    const _cacheControl = response.headers.get("cache-control");
    if (_cacheControl) {
      const m = _cacheControl.match(/max-age=(\d+)/);
      if (m && m[1]) {
        maxAge = Number.parseInt(m[1]);
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
    async getMeta(id, opts) {
      const url = validateId(id, opts);
      try {
        const response = await fetch(url, { ...fetchOptions, method: "HEAD" });
        const { maxAge, mtime } = parseResponse(response);
        return { mtime, maxAge };
      } catch {
        return {};
      }
    },
    async getData(id, opts) {
      const url = validateId(id, opts);
      const response = await fetch(url, { ...fetchOptions, method: "GET" });
      return response.arrayBuffer();
    },
  };
}
