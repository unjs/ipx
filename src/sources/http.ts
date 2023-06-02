import http from "node:http";
import https from "node:https";
import { fetch } from "node-fetch-native";

import type { Storage } from "unstorage";
import { hash } from "ohash";
import { createError, cachedPromise } from "../utils";
import type { SourceFactory } from "../types";

export interface HTTPSourceOptions {
  fetchOptions?: RequestInit;
  maxAge?: number;
  domains?: string | string[];
  cache: boolean;
  cacheMetadataStore: Storage;
}

interface CacheMetadata {
  mtime?: Date;
  maxAge?: number;
  etag?: string;
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

    const hashKey = hash(id);

    if (options.cache) {
      let response;
      const isCacheExists = await options.cacheMetadataStore.hasItem(hashKey);

      if (isCacheExists) {
        const metadata: CacheMetadata =
          await options.cacheMetadataStore.getMeta(hashKey);

        const { etag, mtime } = metadata;

        const headers = new Headers();

        if (etag) {
          headers.set("If-None-Match", etag);
        } else if (mtime) {
          headers.set("If-Modified-Since", mtime.toUTCString());
        }

        response = await fetch(id, {
          // @ts-ignore
          agent: id.startsWith("https") ? httpsAgent : httpAgent,
          ...options.fetchOptions,
          headers,
        });

        if (response.status === 304) {
          const cache = (await options.cacheMetadataStore.getItem(hashKey)) as
            | Uint8Array
            | undefined;

          return {
            mtime,
            maxAge: options.maxAge || 300,
            getData: cachedPromise(() => Promise.resolve(Buffer.from(cache))),
          };
        }
      }
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
    const _etag = response.headers.get("etag");

    if (_lastModified) {
      mtime = new Date(_lastModified);
    }

    const responseArrayBuffer = await response.arrayBuffer();

    if (options.cache) {
      await options.cacheMetadataStore.setItemRaw(
        hashKey,
        new Uint8Array(responseArrayBuffer)
      );
      await options.cacheMetadataStore.setMeta(hashKey, {
        mtime,
        maxAge,
        etag: _etag,
      });
    }

    return {
      mtime,
      maxAge,
      // @ts-ignore
      getData: cachedPromise(() =>
        Promise.resolve(Buffer.from(responseArrayBuffer))
      ),
    };
  };
};
