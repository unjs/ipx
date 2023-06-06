import { defu } from "defu";
import { imageMeta } from "image-meta";
import { hasProtocol, joinURL, withLeadingSlash } from "ufo";
import type { SharpOptions } from "sharp";
import type { ImageMeta, Source, SourceData } from "./types";
import { createFilesystemSource, createHTTPSource } from "./sources";
import { HandlerName, applyHandler, getHandler } from "./handlers";
import { cachedPromise, getEnv as getEnvironment, createError } from "./utils";

export interface IPXCTX {
  sources: Record<string, Source>;
}

export type IPX = (
  id: string,
  modifiers?: Partial<
    Record<HandlerName | "f" | "format" | "a" | "animated", string>
  >,
  requestOptions?: any
) => {
  src: () => Promise<SourceData>;
  data: () => Promise<{
    data: Buffer;
    meta: ImageMeta;
    format: string;
  }>;
};

export interface IPXOptions {
  dir?: false | string;
  maxAge?: number;
  domains?: false | string[];
  alias: Record<string, string>;
  fetchOptions: RequestInit;
  // TODO: Create types
  // https://github.com/lovell/sharp/blob/master/lib/constructor.js#L130
  sharp?: SharpOptions;
}

// https://sharp.pixelplumbing.com/#formats
// (gif and svg are not supported as output)
const SUPPORTED_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "avif",
  "tiff",
  "heif",
  "gif",
]);

export function createIPX(userOptions: Partial<IPXOptions>): IPX {
  const defaults = {
    dir: getEnvironment("IPX_DIR", "."),
    domains: getEnvironment<string[]>("IPX_DOMAINS", []),
    alias: getEnvironment<Record<string, string>>("IPX_ALIAS", {}),
    fetchOptions: getEnvironment<RequestInit>("IPX_FETCH_OPTIONS", {}),
    maxAge: getEnvironment<number>("IPX_MAX_AGE", 300),
    sharp: {},
  };
  const options: IPXOptions = defu(userOptions, defaults) as IPXOptions;

  // Normalize alias to start with leading slash
  options.alias = Object.fromEntries(
    Object.entries(options.alias).map((e) => [withLeadingSlash(e[0]), e[1]])
  );

  const context: IPXCTX = {
    sources: {},
  };

  // Init sources
  if (options.dir) {
    context.sources.filesystem = createFilesystemSource({
      dir: options.dir,
      maxAge: options.maxAge,
    });
  }
  if (options.domains) {
    context.sources.http = createHTTPSource({
      domains: options.domains,
      fetchOptions: options.fetchOptions,
      maxAge: options.maxAge,
    });
  }

  return function ipx(id, modifiers = {}, requestOptions = {}) {
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
      return context.sources[source](id, requestOptions);
    });

    const getData = cachedPromise(async () => {
      const source = await getSource();
      const data = await source.getData();

      // Extract source meta
      const meta = imageMeta(data) as ImageMeta;

      // Determine format
      let mFormat = modifiers.f || modifiers.format;
      if (mFormat === "jpg") {
        mFormat = "jpeg";
      }
      let format =
        mFormat && SUPPORTED_FORMATS.has(mFormat)
          ? mFormat
          : SUPPORTED_FORMATS.has(meta.type)
          ? meta.type
          : "jpeg";

      // Use original svg if format not specified
      if (meta.type === "svg" && !mFormat) {
        return {
          data,
          format: "svg+xml",
          meta,
        };
      }

      // Experimental animated support
      // https://github.com/lovell/sharp/issues/2275
      const animated =
        modifiers.animated !== undefined ||
        modifiers.a !== undefined ||
        format === "gif";

      const Sharp = (await import("sharp").then(
        (r) => r.default || r
      )) as typeof import("sharp");
      let sharp = Sharp(data, { animated });
      Object.assign((sharp as any).options, options.sharp);

      // Resolve modifiers to handlers and sort
      const handlers = Object.entries(modifiers)
        .map(([name, arguments_]) => ({
          handler: getHandler(name as HandlerName),
          name,
          args: arguments_,
        }))
        .filter((h) => h.handler)
        .sort((a, b) => {
          const aKey = (a.handler.order || a.name || "").toString();
          const bKey = (b.handler.order || b.name || "").toString();
          return aKey.localeCompare(bKey);
        });

      // Apply handlers
      const handlerContext: any = { meta };
      for (const h of handlers) {
        sharp = applyHandler(handlerContext, sharp, h.handler, h.args) || sharp;
      }

      // Apply format
      if (SUPPORTED_FORMATS.has(format)) {
        sharp = sharp.toFormat(format as any, {
          quality: handlerContext.quality,
          progressive: format === "jpeg",
        });
      }

      // Convert to buffer
      const newData = await sharp.toBuffer();

      return {
        data: newData,
        format,
        meta,
      };
    });

    return {
      src: getSource,
      data: getData,
    };
  };
}
