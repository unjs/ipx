import { defu } from "defu";
import sharp from "sharp";
import type { SharpOptions } from "sharp";
import { hasProtocol, joinURL, withLeadingSlash } from "ufo";
import type { Source, SourceData, Context, ImageMeta } from "./types";
import { createFilesystemSource, createHTTPSource } from "./sources";
import { applyHandler, getHandler } from "./handlers";
import { cachedPromise, getEnv as getEnvironment, createError } from "./utils";

export interface IPXCTX {
  sources: Record<string, Source>
}

export type IPX = (id: string, modifiers?: Record<string, string>) => {
  src: () => Promise<SourceData>,
  data: () => Promise<{
    data: Buffer,
    meta: ImageMeta,
    format: string
  }>
}

export interface IPXOptions {
  dir?: false | string
  maxAge?: number
  domains?: false | string[]
  alias: Record<string, string>,
  fetchOptions: RequestInit,
  sharp?: SharpOptions
}

// https://sharp.pixelplumbing.com/#formats
// (gif and svg are not supported as output)
const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "tiff", "gif", "heif"]);

export function createIPX (userOptions: Partial<IPXOptions>): IPX {
  const defaults = {
    dir: getEnvironment("IPX_DIR", "."),
    domains: getEnvironment<string[]>("IPX_DOMAINS", []),
    alias: getEnvironment<Record<string, string>>("IPX_ALIAS", {}),
    fetchOptions: getEnvironment<RequestInit>("IPX_FETCH_OPTIONS", {}),
    maxAge: getEnvironment("IPX_MAX_AGE", 300),
    sharp: {}
  };
  const options = defu(userOptions, defaults);

  // Normalize alias to start with leading slash
  options.alias = Object.fromEntries(Object.entries(options.alias).map(e => [withLeadingSlash(e[0]), e[1]]));

  const context: IPXCTX = {
    sources: {}
  };

  // Init sources
  if (options.dir) {
    context.sources.filesystem = createFilesystemSource({
      dir: options.dir,
      maxAge: options.maxAge
    });
  }
  if (options.domains) {
    context.sources.http = createHTTPSource({
      domains: options.domains,
      fetchOptions: options.fetchOptions,
      maxAge: options.maxAge
    });
  }

  return function ipx (id, modifiers = {}) {
    if (!id) {
      throw createError("resource id is missing", 400);
    }

    // Enforce leading slash
    id = hasProtocol(id) ? id : withLeadingSlash(id);

    // Resolve alias
    for (const base in options.alias) {
      if (id.startsWith(base)) {
        id = joinURL(options.alias[base], id.slice(base.length));
      }
    }

    const getSource = cachedPromise(() => {
      const source = hasProtocol(id) ? "http" : "filesystem";
      if (!context.sources[source]) {
        throw createError("Unknown source", 400, source);
      }
      return context.sources[source](id);
    });

    const getData = cachedPromise(async () => {
      const source = await getSource();
      const data = await source.getData();

      // Experimental animated support
      // https://github.com/lovell/sharp/issues/2275
      const animated = modifiers.animated !== undefined || modifiers.a !== undefined;

      let pipe = sharp(data, options.sharp ? { ...options.sharp, animated } : { animated });

      // Extract source meta
      const meta = await pipe.metadata();
      if (meta.format === undefined || meta.width === undefined || meta.height === undefined) {
        throw createError("Invalid image", 400);
      }

      // Determine format
      const mFormat = modifiers.f || modifiers.format;
      let format = mFormat || meta.format;
      if (format === "jpg") {
        format = "jpeg";
      }
      // Use original svg if format not specified
      if (meta.format === "svg" && !mFormat) {
        return {
          data,
          format: "svg+xml",
          meta: meta as ImageMeta
        };
      }

      // Resolve modifiers to handlers and sort
      const handlers = Object.entries(modifiers)
        .map(([name, arguments_]) => ({ handler: getHandler(name), name, args: arguments_ }))
        .filter(h => h.handler)
        .sort((a, b) => {
          const aKey = ((a.handler.order || a.name || "")).toString();
          const bKey = ((b.handler.order || b.name || "")).toString();
          return aKey.localeCompare(bKey);
        });

      // Apply handlers
      const handlerContext: Context = { meta: meta as ImageMeta };
      for (const h of handlers) {
        pipe = applyHandler(handlerContext, pipe, h.handler, h.args) || pipe;
      }

      // Apply format
      if (SUPPORTED_FORMATS.has(format)) {
        pipe = pipe.toFormat(format as any, {
          quality: handlerContext.quality,
          progressive: format === "jpeg"
        });
      }

      // Convert to buffer
      const newData = await pipe.toBuffer();

      return {
        data: newData,
        format,
        meta: meta as ImageMeta
      };
    });

    return {
      src: getSource,
      data: getData
    };
  };
}
