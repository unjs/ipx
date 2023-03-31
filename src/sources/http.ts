import http from "node:http";
import https from "node:https";
import { fetch } from "node-fetch-native";
import type { SourceFactory } from "../types";
import { createError, cachedPromise } from "../utils";

export interface HTTPSourceOptions {
  fetchOptions?: RequestInit;
  maxAge?: number;
  domains?: string | string[];
}

const HTTP_RE = /^https?:\/\//;

export const createHTTPSource: SourceFactory<HTTPSourceOptions> = (options) => {
  const httpsAgent = new https.Agent({ keepAlive: true });
  const httpAgent = new http.Agent({ keepAlive: true });

  let _domains = options.domains || [];
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
      .filter(Boolean)
  );

  return async (id: string, requestOptions) => {
    // Check hostname
    const hostname = new URL(id).hostname;
    if (!hostname) {
      throw createError("Hostname is missing", 403, id);
    }
    if (!requestOptions?.bypassDomain && !domains.has(hostname)) {
      throw createError("Forbidden host", 403, hostname);
    }

    const response = await fetch(id, {
      // @ts-ignore
      agent: id.startsWith("https") ? httpsAgent : httpAgent,
      ...options.fetchOptions,
    });

    if (!response.ok) {
      throw createError(
        "Fetch error",
        response.status || 500,
        response.statusText
      );
    }

    let maxAge = options.maxAge;
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

    return {
      mtime,
      maxAge,
      // @ts-ignore
      getData: cachedPromise(() =>
        response.arrayBuffer().then((ab) => Buffer.from(ab))
      ),
    };
  };
};
