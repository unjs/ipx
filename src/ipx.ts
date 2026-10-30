import { defu } from "defu";
import { hasProtocol, joinURL, withLeadingSlash } from "ufo";
import type { SharpOptions } from "sharp";
import { createError, isError } from "h3";
import { imageMeta as getImageMeta, type ImageMeta } from "image-meta";
import type { Config as SVGOConfig } from "svgo";
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
    data: Buffer | string;
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

  svgo?: false | SVGOConfig;
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

// libvips' default `VIPS_MAX_COORD`: the largest image dimension it accepts.
// An all-pages ("animated") decode stacks every page into one canvas of height
// `pageHeight * nPages`, so ipx applies the same bound to that total, which
// bounds what a single request can make the decoder produce.
const VIPS_MAX_COORD = 100_000_000;

export function createIPX(userOptions: IPXOptions): IPX {
  const options: IPXOptions = defu(userOptions, {
    alias: getEnv<Record<string, string>>("IPX_ALIAS") || {},
    maxAge: getEnv<number>("IPX_MAX_AGE") ?? 60 /* 1 minute */,
    sharpOptions: <SharpOptions>{
      jpegProgressive: true,
    },
  } satisfies Omit<IPXOptions, "storage">);

  // Largest decoded image height (`pageHeight * nPages` in all-pages mode) the
  // multi-page limit will allow. A numeric `VIPS_MAX_COORD` (the same variable
  // ipx 4 reads) can lower it but never raise it above the default; any other
  // value is ignored.
  const envMaxCoord = getEnv<number>("VIPS_MAX_COORD");
  const maxImageHeight =
    typeof envMaxCoord === "number" &&
    envMaxCoord > 0 &&
    envMaxCoord < VIPS_MAX_COORD
      ? envMaxCoord
      : VIPS_MAX_COORD;

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

  const getSVGO = cachedPromise(async () => {
    const { optimize } = await import("svgo");
    return { optimize };
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
        if (options.svgo === false) {
          return {
            data: sourceData,
            format: "svg+xml",
            meta: imageMeta,
          };
        } else {
          // https://github.com/svg/svgo
          const { optimize } = await getSVGO();
          const svg = optimize(sourceData.toString("utf8"), {
            ...options.svgo,
            plugins: ["removeScriptElement", ...(options.svgo?.plugins || [])],
          }).data;
          return {
            data: svg,
            format: "svg+xml",
            meta: imageMeta,
          };
        }
      }

      // Experimental animated support
      // https://github.com/lovell/sharp/issues/2275
      const animated =
        modifiers.animated !== undefined ||
        modifiers.a !== undefined ||
        format === "gif";

      const Sharp = await getSharp();

      // `sharpOptions` is spread last, so an operator setting `animated` or
      // `pages` there turns on a multi-page decode that `animated` alone would
      // not reveal. The limit below must key off these effective options.
      const inputOptions: SharpOptions = { animated, ...options.sharpOptions };
      const multiPage =
        inputOptions.animated === true ||
        inputOptions.pages === -1 ||
        (inputOptions.pages ?? 1) > 1;

      // Enforce the total-height limit (see `VIPS_MAX_COORD`) before the
      // all-pages decode runs, from a cheap single-page metadata read, so an
      // over-large multi-page input (TIFF, GIF, WebP, HEIF) is rejected before
      // any page is decoded. Counting every page (rather than just the
      // requested `pages`/`page` window) over-estimates, which is the safe
      // direction.
      if (multiPage) {
        // In a single-page read `pages` is the true frame count and `height`
        // the page height. The operator's `sharpOptions` (e.g. `density`) still
        // apply, so the page height matches what the real decode will use.
        // Constructing it only validates those options, so a misconfiguration
        // still throws as such rather than as a bad image.
        const probe = Sharp(sourceData, {
          ...inputOptions,
          animated: false,
          pages: 1,
        });
        let total = 0;
        try {
          const srcMeta = await probe.metadata();
          total = (srcMeta.height || 0) * (srcMeta.pages || 1);
        } catch {
          throw createError({
            statusCode: 400,
            statusText: `IPX_INVALID_IMAGE`,
            message: `Cannot parse image metadata: ${id}`,
          });
        }
        if (total >= maxImageHeight) {
          throw createError({
            statusCode: 400,
            statusText: `IPX_INVALID_IMAGE`,
            message: `Animated image total height is too large: ${id}`,
          });
        }
      }

      let sharp = Sharp(sourceData, inputOptions);
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

      // The source and modifiers are user input. sharp validates modifier
      // arguments when they are applied, and libvips validates some of the
      // rest only once it runs (pixel limit, output size, ...), so a failure
      // in either step is a `400` rather than an unhandled `500`.
      let processedImage: Buffer;
      try {
        // Apply handlers
        const handlerContext: any = { meta: imageMeta };
        for (const h of handlers) {
          sharp =
            applyHandler(handlerContext, sharp, h.handler, h.args) || sharp;
        }

        // Apply format
        if (SUPPORTED_FORMATS.has(format || "")) {
          sharp = sharp.toFormat(format as any, {
            quality: handlerContext.quality,
          });
        }

        // Convert to buffer
        processedImage = await sharp.toBuffer();
      } catch (error) {
        if (isError(error)) {
          throw error;
        }
        throw createError({
          statusCode: 400,
          statusText: `IPX_INVALID_MODIFIER`,
          message: `Cannot apply modifier: ${
            (error as Error)?.message || error
          }`,
          cause: error,
        });
      }

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
