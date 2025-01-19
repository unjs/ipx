import { ofetch } from "ofetch";
import { createError } from "h3";
import { getEnv } from "../utils";
import type { IPXStorage } from "../types";

export type HTTPStorageOptions = {
  fetchOptions?: RequestInit;
  maxAge?: number;
  domains?: string | string[];
  allowAllDomains?: boolean;
  ignoreCacheControl?: boolean;
};

const HTTP_RE = /^https?:\/\//;

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
