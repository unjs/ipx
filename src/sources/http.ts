import http from "node:http";
import https from "node:https";
import { fetch } from "node-fetch-native";
import type { SourceFactory } from "../types";
import { createError, cachedPromise } from "../utils";

import fsDriver from 'unstorage/drivers/fs'
import murmurhash from 'murmurhash'
import { join } from 'path'
import { existsSync, promises as fsp } from 'fs'

export interface HTTPSourceOptions {
  fetchOptions?: RequestInit;
  maxAge?: number;
  domains?: string | string[];
}

const HTTP_RE = /^https?:\/\//;

export const createHTTPSource: SourceFactory<HTTPSourceOptions> = (options) => {
  const httpsAgent = new https.Agent({ keepAlive: true });
  const httpAgent = new http.Agent({ keepAlive: true });

  if (options.cache && !options.cacheMetadataStore) {
    options.cacheMetadataStore = createStorage({
      driver: fsDriver({ base: join(options.cache, 'metadata') })
    })
  }

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

    if (options.cache) {
      let response
      const metadata = await options.cacheMetadataStore.getItem(id)
      if (metadata) {
        const { filename, etag, lastModified } = metadata
        if (existsSync(filename)) {
          const headers = new fetch.Headers()

          if (etag) {
            headers.set('If-None-Match', etag)
          } else {
            headers.set('If-Modified-Since', lastModified)
          }
          response = await fetch(id, {
            agent: id.startsWith('https') ? httpsAgent : httpAgent,
            headers
          })
          if (response.status === 304) {
            return {
              mtime: new Date(lastModified),
              maxAge: options.maxAge || 300,
              getData: cachedPromise(() => fsp.readFile(filename))
            }
          }
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

    let mtime
    const _lastModified = response.headers.get('last-modified')
    const _etag = response.headers.get('etag')

    if (_lastModified) {
      mtime = new Date(_lastModified);
    }

    let buffer

    if (options.cache) {
      const filename = join(options.cache, 'data', `${murmurhash(id)}`)
      await fsp.mkdir(join(options.cache, 'data'), { recursive: true })
      buffer = await response.buffer()
      await fsp.writeFile(filename, buffer)
      await options.cacheMetadataStore.setItem(id, JSON.stringify({ filename, etag: _etag, lastModified: _lastModified }))
    }

    return {
      mtime,
      maxAge,
      // getData: cachedPromise(() => buffer || response.buffer())
      // @ts-ignore
      getData: cachedPromise(() =>
        response.arrayBuffer().then((ab) => Buffer.from(ab))
      ),
    };
  };
};
