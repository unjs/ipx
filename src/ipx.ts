import { defu } from "defu";
import { hasProtocol, joinURL, withLeadingSlash } from "ufo";
import type { SharpOptions } from "sharp";
import { createError } from "h3";
import { imageMeta as getImageMeta, type ImageMeta } from "image-meta";
import { optimize as optimizeSVG } from "svgo";
import svgoXSSPlugin from "./lib/svgo-xss";
import type { IPXStorage } from "./types";
import { HandlerName, applyHandler, getHandler } from "./handlers";
import { cachedPromise, getEnv } from "./utils";

type IPXSourceMeta = { mtime?: Date; maxAge?: number };

export type IPX = (
  id: string,
  modifiers?: Partial<
    Record<HandlerName | "f" | "format" | "a" | "animated", string>
  >,
  requestOptions?: any,
) => {
  getSourceMeta: () => Promise<IPXSourceMeta>;
  process: () => Promise<{
    data: Buffer;
    meta?: ImageMeta;
    format?: string;
  }>;
};

export type IPXOptions = {
  maxAge?: number;
  alias?: Record<string, string>;
  sharpOptions?: SharpOptions;

  storage: IPXStorage;
  httpStorage?: IPXStorage;
};

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
  "heic",
]);

export function createIPX(userOptions: IPXOptions): IPX {
  const options: IPXOptions = defu(userOptions, {
    alias: getEnv<Record<string, string>>("IPX_ALIAS") || {},
    maxAge: getEnv<number>("IPX_MAX_AGE") ?? 60 /* 1 minute */,
    sharpOptions: {},
  } satisfies Omit<IPXOptions, "storage">);

  // Normalize alias to start with leading slash
  options.alias = Object.fromEntries(
    Object.entries(options.alias || {}).map((e) => [
      withLeadingSlash(e[0]),
      e[1],
    ]),
  );

  // Sharp loader
  const getSharp = cachedPromise(async () => {
    return (await import("sharp").then(
      (r) => r.default || r,
    )) as typeof import("sharp");
  });

  return function ipx(id, modifiers = {}, opts = {}) {
    // Validate id
    if (!id) {
      throw createError({
        statusCode: 400,
        statusText: `IPX_MISSING_ID`,
        message: `Resource id is missing`,
      });
    }

    // Enforce leading slash for non absolute urls
    id = hasProtocol(id) ? id : withLeadingSlash(id);

    // Resolve alias
    for (const base in options.alias) {
      if (id.startsWith(base)) {
        id = joinURL(options.alias[base], id.slice(base.length));
      }
    }

    // Resolve Storage
    const storage = hasProtocol(id)
      ? options.httpStorage || options.storage
      : options.storage || options.httpStorage;
    if (!storage) {
      throw createError({
        statusCode: 500,
        statusText: `IPX_NO_STORAGE`,
        message: "No storage configured!",
      });
    }

    // Resolve Resource
    const getSourceMeta = cachedPromise(async () => {
      const sourceMeta = await storage.getMeta(id, opts);
      if (!sourceMeta) {
        throw createError({
          statusCode: 404,
          statusText: `IPX_RESOURCE_NOT_FOUND`,
          message: `Resource not found: ${id}`,
        });
      }
      const _maxAge = sourceMeta.maxAge ?? options.maxAge;
      return {
        maxAge:
          typeof _maxAge === "string" ? Number.parseInt(_maxAge) : _maxAge,
        mtime: sourceMeta.mtime ? new Date(sourceMeta.mtime) : undefined,
      } satisfies IPXSourceMeta;
    });
    const getSourceData = cachedPromise(async () => {
      const sourceData = await storage.getData(id, opts);
      if (!sourceData) {
        throw createError({
          statusCode: 404,
          statusText: `IPX_RESOURCE_NOT_FOUND`,
          message: `Resource not found: ${id}`,
        });
      }
      return Buffer.from(sourceData);
    });

    const process = cachedPromise(async () => {
      // const _sourceMeta = await getSourceMeta();
      const sourceData = await getSourceData();

      // Detect source image meta
      let imageMeta: ImageMeta;
      try {
        imageMeta = getImageMeta(sourceData) as ImageMeta;
      } catch {
        throw createError({
          statusCode: 400,
          statusText: `IPX_INVALID_IMAGE`,
          message: `Cannot parse image metadata: ${id}`,
        });
      }

      // Determine format
      let mFormat = modifiers.f || modifiers.format;
      if (mFormat === "jpg") {
        mFormat = "jpeg";
      }
      const format =
        mFormat && SUPPORTED_FORMATS.has(mFormat)
          ? mFormat
          : SUPPORTED_FORMATS.has(imageMeta.type || "") // eslint-disable-line unicorn/no-nested-ternary
          ? imageMeta.type
          : "jpeg";

      // Use original SVG if format is not specified
      if (imageMeta.type === "svg" && !mFormat) {
        // https://github.com/svg/svgo
        const svg = optimizeSVG(sourceData.toString("utf8"), {
          plugins: [svgoXSSPlugin],
        }).data;
        return {
          data: svg,
          format: "svg+xml",
          meta: imageMeta,
        };
      }

      // Experimental animated support
      // https://github.com/lovell/sharp/issues/2275
      const animated =
        modifiers.animated !== undefined ||
        modifiers.a !== undefined ||
        format === "gif";

      const Sharp = await getSharp();
      let sharp = Sharp(sourceData, { animated, ...options.sharpOptions });
      Object.assign(
        (sharp as unknown as { options: SharpOptions }).options,
        options.sharpOptions,
      );

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
      const handlerContext: any = { meta: imageMeta };
      for (const h of handlers) {
        sharp = applyHandler(handlerContext, sharp, h.handler, h.args) || sharp;
      }

      // Apply format
      if (SUPPORTED_FORMATS.has(format || "")) {
        sharp = sharp.toFormat(format as any, {
          quality: handlerContext.quality,
          progressive: format === "jpeg",
        });
      }

      // Convert to buffer
      const processedImage = await sharp.toBuffer();

      return {
        data: processedImage,
        format,
        meta: imageMeta,
      };
    });

    return {
      getSourceMeta,
      process,
    };
  };
}
