import { hasProtocol, joinURL, withLeadingSlash } from "ufo";
import { HTTPError } from "h3";
import { imageMeta as getImageMeta, type ImageMeta } from "image-meta";
import { applyHandler, asModifierError, getHandler } from "./handlers/index.ts";
import { sanitizeSVGPlugin } from "./svg.ts";
import { cachedPromise, getEnv, normalizeMaxAge } from "./utils.ts";

import type { HandlerName } from "./handlers/index.ts";
import type { SharpOptions } from "sharp";
import type {
  Config as SVGOConfig,
  PluginConfig as SVGOPluginConfig,
} from "svgo";
import type { IPXStorage } from "./types.ts";

type IPXSourceMeta = {
  /**
   * The modification time of the source. Used for cache validation.
   * @optional
   */
  mtime?: Date;

  /**
   * The maximum age (in seconds) that the source should be considered fresh.
   * @optional
   */
  maxAge?: number;
};

// A flag modifier is set by its presence: `/flip/` parses to `{ flip: "" }`.
type FlagModifier = true | "true" | "";

type FormatModifier =
  | "jpeg"
  | "jpg"
  | "png"
  | "webp"
  | "avif"
  | "gif"
  | "heif"
  | "tiff"
  | "auto"
  | (string & {});

export interface IPXModifiers {
  format: FormatModifier;
  // alias for format
  f: FormatModifier;
  fit: "contain" | "cover" | "fill" | "inside" | "outside" | (string & {});
  resize: string;
  // alias for resize
  s: string;
  quality: number | string;
  // alias for quality
  q: number | string;
  background: string;
  b: string;
  position: string;
  pos: string;
  enlarge: FlagModifier | false | "false";
  kernel:
    "nearest" | "cubic" | "mitchell" | "lanczos2" | "lanczos3" | (string & {});
  trim: number | string;
  extend: string;
  extract: string;
  crop: string;
  rotate: number | string;
  autoorient: FlagModifier;
  flip: FlagModifier;
  flop: FlagModifier;
  sharpen: number | string;
  median: number | string;
  blur: number | string;
  dilate: number | string;
  erode: number | string;
  clahe: number | string;
  flatten: FlagModifier;
  unflatten: FlagModifier;
  gamma: string;
  negate: FlagModifier | string;
  normalize: FlagModifier | string;
  threshold: number | string;
  linear: string;
  modulate: string;
  brightness: number | string;
  saturation: number | string;
  hue: number | string;
  lightness: number | string;
  opacity: number | string;
  tint: number | string;
  grayscale: FlagModifier;
  animated: FlagModifier;
  // alias for animated
  a: FlagModifier;
  width: string | number;
  w: string | number;
  height: string | number;
  h: string | number;
}

// ensure we have types for all modifiers
({}) as IPXModifiers satisfies Record<
  HandlerName,
  string | number | boolean | undefined
>;

/**
 * A function type that defines an IPX image processing instance.
 *
 * This function takes an image identifier and optional modifiers and request options, then provides methods to retrieve
 * image metadata and process the image according to the specified modifiers.
 *
 * @param {string} id - The identifier for the image. This can be a URL or a path, depending on the storage implementation.
 * @param {partial<Record<HandlerName | "f" | "format" | "a" | "animated", string>>} [modifiers] - Modifiers to be applied to the image,
 * such as resizing, cropping or format conversion. This record contains predefined keys such as 'f' or 'format' to specify the output to
 * specify the output image format, and 'a' or 'animated' to specify whether the image should be processed as an animation. See
 * {@link HandlerName}.
 * @param {any} [requestOptions] - Additional options that may be needed for request handling, specific to the storage backend.
 * Returns an object with methods:
 * - `getSourceMeta`: A method that returns a promise resolving to the source image metadata (`IPXSourceMeta`).
 * - `process`: A method that returns a promise resolving to an object containing the processed image data, metadata,
 * and format. The image data can be in the form of a `buffer` or a string, depending on the format and processing.
 */
export type IPX = (
  id: string,
  modifiers?: Partial<IPXModifiers>,
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
  /**
   * Default cache duration in seconds. If not specified, a default of 1 minute is used.
   * @optional
   */
  maxAge?: number;

  /**
   * Maximum width and height (in pixels) of the output image.
   *
   * Modifiers are user input and sharp's `limitInputPixels` only bounds the
   * *input*, so without this limit a request such as
   * `/enlarge,s_20000x20000/img.jpg` or `/extend_10000_10000_10000_10000/img.jpg`
   * makes sharp allocate a multi-gigabyte output buffer from a tiny source
   * image, which is an easy way to exhaust the server memory.
   *
   * Requested `width`, `height`, `resize` dimensions are clamped to this value
   * (preserving the requested aspect ratio) and `extend` edges are clamped so
   * that the extended canvas stays within it.
   *
   * Set to `false` to disable the limit (only safe when modifiers come from a
   * trusted source).
   *
   * @default 8192
   * @optional
   */
  maxOutputDimension?: number | false;

  /**
   * Modifiers that requests are allowed to use. Any other modifier (including
   * an unknown one) is rejected with a `400` before the source is fetched.
   *
   * Every modifier is allowed by default. Restricting them to the ones a site
   * actually uses (for example `["width", "height", "format", "quality"]`)
   * shrinks the attack surface of the public endpoint: expensive operations
   * such as `blur` or `median` cannot be triggered.
   *
   * Aliases follow their modifier: allowing `width` also allows `w`.
   *
   * Only modifier names are checked, not their values: allowing `format`
   * allows every supported output format, including the slow-to-encode `avif`.
   * The same image also stays reachable under many URLs (`?cb=1`, `w_10` vs
   * `w_1e1`, ...), so this does not prevent busting a CDN cache.
   *
   * @optional
   */
  allowedModifiers?: (keyof IPXModifiers)[];

  /**
   * Source image formats that are allowed to be processed. A source of any
   * other format is rejected with a `403` after it is fetched, before any of
   * its bytes reach sharp or SVGO.
   *
   * The source bytes are as untrusted as the URL, and every decoder libvips
   * ships is reachable through them. Limiting the input to the formats a site
   * actually serves (for example {@link WEB_INPUT_FORMATS}) keeps
   * rarely-used decoders out of reach.
   *
   * The format is the one detected from the source bytes (`jpeg`/`jpg`,
   * `heif`/`heic` are interchangeable), not the file extension. Detection
   * looks at the first bytes only, so a file can be crafted to be detected as
   * an allowed format; `restrictDecoders` covers that case.
   *
   * Every format is allowed by default, unless `restrictDecoders` is enabled,
   * in which case it defaults to {@link WEB_INPUT_FORMATS}.
   *
   * @optional
   */
  allowedInputFormats?: IPXInputFormat[] | readonly IPXInputFormat[];

  /**
   * Also block the libvips decoders of every format that is not in
   * `allowedInputFormats`, using `sharp.block()`.
   *
   * The `allowedInputFormats` check relies on the format ipx detects from the
   * source bytes, while libvips picks its decoder from the same bytes on its
   * own. Blocking the decoders closes the gap for a file that the two read
   * differently, since a blocked decoder never parses a single byte.
   *
   * **This changes process-wide libvips state.** It affects every user of
   * sharp in the same process, not only this IPX instance: in a host app
   * (Nuxt, ...), the app's own sharp code can no longer decode the blocked
   * formats either, and the decoders this instance re-enables override any the
   * app blocked on purpose. The block is applied once, when this instance first
   * hands an image to sharp: nothing is blocked before that. The decoders left
   * enabled are the union of every such instance's formats, so a later
   * instance can widen the set for the whole process but never narrows it.
   * Each instance's own `allowedInputFormats` check still applies. An allowed
   * SVG can still embed PNG or JPEG images, which the SVG renderer decodes on
   * its own.
   * Only enable it when IPX owns the process (such as the `ipx` CLI with
   * `IPX_RESTRICT_DECODERS=true`) or the whole app agrees with the policy.
   *
   * @default false
   * @optional
   */
  restrictDecoders?: boolean;

  /**
   * A mapping of URL aliases to their corresponding URLs, used to simplify resource identifiers.
   * @optional
   */
  alias?: Record<string, string>;

  /**
   * Configuration options for the Sharp image processing library.
   * @optional
   */
  sharpOptions?: SharpOptions;

  /**
   * Primary storage backend for handling image assets.
   */
  storage: IPXStorage;

  /**
   * An optional secondary storage backend used when images are fetched via HTTP.
   * @optional
   */
  httpStorage?: IPXStorage;

  /**
   * Options for SVG images, which are processed by SVGO instead of Sharp.
   * @optional
   */
  svg?: {
    /**
     * Configuration for the SVGO library used to optimize SVG images.
     *
     * SVGO's `preset-default` is applied unless custom `plugins` are configured.
     * Set to `false` to disable optimization. Sanitization is applied either way.
     * @optional
     */
    optimize?: false | SVGOConfig;

    /**
     * Disable SVG sanitization.
     *
     * Sanitized SVG images cannot execute scripts. Only disable this if all sources
     * are fully trusted, as it allows serving SVG images with XSS payloads.
     * @default false
     * @optional
     */
    unsafeSkipSanitize?: boolean;
  };
};

// A common CDN limit. `8192 x 8192 x 4B` is ~268MB of uncompressed pixels,
// which bounds what a single request can allocate.
const DEFAULT_MAX_OUTPUT_DIMENSION = 8192;

// libvips' default `VIPS_MAX_COORD`: the largest image dimension it accepts.
// An all-pages ("animated") decode stacks every page into one canvas of height
// `pageHeight * nPages`, so ipx applies the same bound to that total. Like
// `maxOutputDimension`, it bounds what a single request can make the decoder
// produce.
const VIPS_MAX_COORD = 100_000_000;

// `format` and `animated` are read directly by `createIPX` rather than through
// a handler, so their aliases are spelled out here.
const NON_HANDLER_MODIFIERS = new Map([
  ["format", "format"],
  ["f", "format"],
  ["animated", "animated"],
  ["a", "animated"],
]);

// Handler aliases share the handler object (`w === width`), so comparing by
// handler makes an allowed modifier cover all of its aliases.
function getModifierKey(name: string): unknown {
  return NON_HANDLER_MODIFIERS.get(name) ?? getHandler(name as HandlerName);
}

function resolveAllowedModifiers(names: unknown): Set<unknown> | undefined {
  if (names === undefined) {
    return undefined;
  }
  if (typeof names === "string") {
    names = names
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // `IPX_ALLOWED_MODIFIERS` is JSON-parsed, so it can hold any JSON value.
  if (!Array.isArray(names)) {
    throw new TypeError(
      `[ipx] allowedModifiers must be an array or a comma-separated string, got: ${JSON.stringify(names)}`,
    );
  }
  return new Set(
    names.map((name) => {
      const key = getModifierKey(name);
      // Fail loudly on a typo rather than rejecting every request using it.
      if (!key) {
        throw new Error(`[ipx] Unknown modifier in allowedModifiers: ${name}`);
      }
      return key;
    }),
  );
}

/**
 * A source image format, as detected from its bytes.
 */
export type IPXInputFormat =
  | "jpeg"
  | "jpg"
  | "png"
  | "webp"
  | "gif"
  | "svg"
  | "avif"
  | "heic"
  | "heif"
  | "tiff"
  | "jxl"
  | "jp2"
  | "j2c"
  | "pnm"
  | "bmp"
  | "cur"
  | "dds"
  | "icns"
  | "ico"
  | "ktx"
  | "psd"
  | "tga";

/**
 * The common web image formats, a good value for `allowedInputFormats`.
 */
export const WEB_INPUT_FORMATS: readonly IPXInputFormat[] = Object.freeze([
  "jpeg",
  "jpg",
  "png",
  "webp",
  "gif",
  "svg",
  "avif",
  "heic",
  "heif",
]);

// What `allowedInputFormats` falls back to when neither the option nor the
// environment sets it and `restrictDecoders` is off. `undefined` allows every
// format.
const DEFAULT_ALLOWED_INPUT_FORMATS: readonly IPXInputFormat[] | undefined =
  undefined;

// `image-meta` reports `jpg` for JPEG and `heic` for every HEIF brand that is
// not AVIF, so the other spellings are folded into those.
const INPUT_FORMAT_ALIASES = new Map([
  ["jpeg", "jpg"],
  ["heif", "heic"],
]);

// The libvips loaders (by class name, matching subclasses) that decode each
// detected format, for `restrictDecoders`. Formats missing here are only read
// by libvips' ImageMagick fallback in custom builds, so they stay blocked.
//
// The UltraHDR JPEG loader (`VipsForeignLoadUhdr`) is left blocked on purpose:
// such a file is still a valid JPEG and decodes through the plain JPEG loader,
// and ipx drops the gain map either way.
const LOADERS_BY_INPUT_FORMAT: Record<string, string[]> = {
  jpg: ["VipsForeignLoadJpeg"],
  png: ["VipsForeignLoadPng"],
  webp: ["VipsForeignLoadWebp"],
  // Current libvips decodes GIF with libnsgif; older builds used giflib.
  gif: ["VipsForeignLoadNsgif", "VipsForeignLoadGif"],
  svg: ["VipsForeignLoadSvg"],
  avif: ["VipsForeignLoadHeif"],
  heic: ["VipsForeignLoadHeif"],
  tiff: ["VipsForeignLoadTiff"],
  jxl: ["VipsForeignLoadJxl"],
  jp2: ["VipsForeignLoadJp2k"],
  j2c: ["VipsForeignLoadJp2k"],
  pnm: ["VipsForeignLoadPpm"],
};

// Loaders re-enabled so far by any instance with `restrictDecoders`, since the
// block is process-wide. `undefined` until the first such instance blocks.
let restrictedLoaders: Set<string> | undefined;

// Every type `image-meta` can detect, so a typo fails loudly at startup rather
// than rejecting every request for that format.
const KNOWN_INPUT_FORMATS: ReadonlySet<string> = new Set([
  "jpg",
  "png",
  "webp",
  "gif",
  "svg",
  "avif",
  "heic",
  "tiff",
  "jxl",
  "jp2",
  "j2c",
  "pnm",
  "bmp",
  "cur",
  "dds",
  "icns",
  "ico",
  "ktx",
  "psd",
  "tga",
]);

// `IPX_RESTRICT_DECODERS` is JSON-parsed, so `true`/`false`/`1`/`0` arrive as
// booleans or numbers. Anything else (`False`, `off`, ...) is a typo that
// should fail at startup instead of silently changing process-wide state.
function resolveRestrictDecoders(value: unknown): boolean {
  if (value === undefined || value === false || value === 0) {
    return false;
  }
  if (value === true || value === 1) {
    return true;
  }
  throw new TypeError(
    `[ipx] restrictDecoders must be true or false (or 1 / 0), got: ${JSON.stringify(value)}`,
  );
}

// Only `undefined` falls back to the default: a `null` from the environment is
// a misconfiguration and throws below rather than allowing every format.
function resolveAllowedInputFormats(
  formats: unknown,
  fallback: readonly string[] | undefined,
): Set<string> | undefined {
  if (formats === undefined) {
    formats = fallback;
  }
  if (formats === undefined) {
    return undefined;
  }
  if (typeof formats === "string") {
    formats = formats
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // `IPX_ALLOWED_INPUT_FORMATS` is JSON-parsed, so it can hold any JSON value.
  if (!Array.isArray(formats)) {
    throw new TypeError(
      `[ipx] allowedInputFormats must be an array or a comma-separated string, got: ${JSON.stringify(formats)}`,
    );
  }
  return new Set(
    formats.map((format) => {
      const name = String(format).toLowerCase();
      const type = INPUT_FORMAT_ALIASES.get(name) ?? name;
      if (!KNOWN_INPUT_FORMATS.has(type)) {
        throw new Error(
          `[ipx] Unknown input format in allowedInputFormats: ${format}`,
        );
      }
      return type;
    }),
  );
}

// https://sharp.pixelplumbing.com/#formats
// (gif and svg are not supported as output)
export const SUPPORTED_FORMATS: ReadonlySet<string> = new Set([
  "jpeg",
  "png",
  "webp",
  "avif",
  "tiff",
  "heif",
  "gif",
  "heic",
]);

/**
 * Creates an IPX image processing instance with the specified options.
 * @param {IPXOptions} userOptions - Configuration options for the IPX instance. See {@link IPXOptions}.
 * @returns {IPX} An IPX processing function configured with the given options. See {@link IPX}.
 * @throws {Error} If critical options such as storage are missing or incorrectly configured.
 */
export function createIPX(userOptions: IPXOptions): IPX {
  const options = {
    ...userOptions,
    alias:
      userOptions.alias || getEnv<Record<string, string>>("IPX_ALIAS") || {},
    maxAge:
      normalizeMaxAge(userOptions.maxAge) ??
      normalizeMaxAge(getEnv("IPX_MAX_AGE")) ??
      60 /* 1 minute */,
    maxOutputDimension:
      userOptions.maxOutputDimension ??
      getEnv<number | false>("IPX_MAX_OUTPUT_DIMENSION") ??
      DEFAULT_MAX_OUTPUT_DIMENSION,
    sharpOptions: {
      jpegProgressive: true,
      ...userOptions.sharpOptions,
    } as SharpOptions,
  } satisfies Omit<IPXOptions, "storage">;

  const allowedModifiers = resolveAllowedModifiers(
    userOptions.allowedModifiers ?? getEnv("IPX_ALLOWED_MODIFIERS"),
  );

  const restrictDecoders = resolveRestrictDecoders(
    userOptions.restrictDecoders ?? getEnv("IPX_RESTRICT_DECODERS"),
  );

  // `restrictDecoders` needs a list of formats whose decoders stay enabled.
  // Without an explicit one it keeps the web formats, and the early `403`
  // checks the same set so the two layers agree.
  const allowedInputFormats = resolveAllowedInputFormats(
    userOptions.allowedInputFormats ?? getEnv("IPX_ALLOWED_INPUT_FORMATS"),
    restrictDecoders ? WEB_INPUT_FORMATS : DEFAULT_ALLOWED_INPUT_FORMATS,
  );

  // libvips loaders left enabled by `restrictDecoders`.
  const allowedLoaders =
    restrictDecoders && allowedInputFormats
      ? [
          ...new Set(
            [...allowedInputFormats].flatMap(
              (type) => LOADERS_BY_INPUT_FORMAT[type] || [],
            ),
          ),
        ]
      : undefined;

  // Largest decoded image height (`pageHeight * nPages` in all-pages mode) the
  // multi-page limit will allow. A numeric `VIPS_MAX_COORD` can lower it but
  // never raise it above the default; any other value is ignored (see
  // `VIPS_MAX_COORD`).
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
    const Sharp = (await import("sharp").then(
      (r) => (r as any).default || r,
    )) as typeof import("sharp").default;

    // Deny every libvips loader, then re-enable the allowed ones. Both match
    // a class and its subclasses (`VipsForeignLoad` is the base of all of
    // them), and libvips skips a blocked loader while sniffing the input, so a
    // blocked format is refused as unsupported without being parsed. Savers
    // are untouched, so every output format keeps working.
    //
    // This is process-wide (see `restrictDecoders`) and runs once per
    // instance, on its first image. Only the first instance blocks; each one
    // then re-enables the union of every instance's loaders, so a later
    // instance can widen the set for the whole process but never takes away
    // a loader an earlier one relies on. Each instance's own format check
    // still rejects formats it does not allow. An instance without
    // `restrictDecoders` never calls `block`/`unblock`, so it leaves the host
    // app's own policy alone.
    if (allowedLoaders) {
      if (!restrictedLoaders) {
        Sharp.block({ operation: ["VipsForeignLoad"] });
        restrictedLoaders = new Set();
      }
      for (const loader of allowedLoaders) {
        restrictedLoaders.add(loader);
      }
      if (restrictedLoaders.size > 0) {
        Sharp.unblock({ operation: [...restrictedLoaders] });
      }
    }

    return Sharp;
  });

  const getSVGO = cachedPromise(async () => {
    const { optimize } = await import("svgo");
    return { optimize };
  });

  return function ipx(id, modifiers = {}, opts = {}) {
    // Validate id
    if (!id) {
      throw new HTTPError({
        statusCode: 400,
        statusText: `IPX_MISSING_ID`,
        message: `Resource id is missing`,
      });
    }

    // Snapshot own keys into a null-prototype object so the allowlist check
    // and the pipeline see the same modifiers: `format`/`animated` are read by
    // property access, which would otherwise pick up inherited values, and the
    // caller could mutate the object between `ipx()` and `process()`.
    modifiers = Object.assign(
      Object.create(null) as Partial<IPXModifiers>,
      modifiers,
    );

    // Validate modifiers (before any source is fetched or processed)
    if (allowedModifiers) {
      for (const name of Object.keys(modifiers)) {
        if (!allowedModifiers.has(getModifierKey(name))) {
          throw new HTTPError({
            statusCode: 400,
            statusText: `IPX_FORBIDDEN_MODIFIER`,
            message: `Modifier is not allowed: ${name}`,
          });
        }
      }
    }

    // Enforce leading slash for non absolute urls
    id = hasProtocol(id) ? id : withLeadingSlash(id);

    // Resolve alias
    for (const base in options.alias) {
      if (id.startsWith(base)) {
        id = joinURL(options.alias[base] as string, id.slice(base.length));
      }
    }

    // Resolve Storage
    const storage = hasProtocol(id)
      ? options.httpStorage || options.storage
      : options.storage || options.httpStorage;
    if (!storage) {
      throw new HTTPError({
        statusCode: 500,
        statusText: `IPX_NO_STORAGE`,
        message: "No storage configured!",
      });
    }

    // Resolve Resource
    const getSourceMeta = cachedPromise(async () => {
      const sourceMeta = await storage.getMeta(id, opts);
      if (!sourceMeta) {
        throw new HTTPError({
          statusCode: 404,
          statusText: `IPX_RESOURCE_NOT_FOUND`,
          message: `Resource not found: ${id}`,
        });
      }
      return {
        // Storages (including custom ones) may return anything here; it ends up verbatim in
        // the `cache-control` header, so an invalid value falls back to the IPX-wide default.
        maxAge: normalizeMaxAge(sourceMeta.maxAge) ?? options.maxAge,
        mtime: sourceMeta.mtime ? new Date(sourceMeta.mtime) : undefined,
      } satisfies IPXSourceMeta;
    });
    const getSourceData = cachedPromise(async () => {
      const sourceData = await storage.getData(id, opts);
      if (!sourceData) {
        throw new HTTPError({
          statusCode: 404,
          statusText: `IPX_RESOURCE_NOT_FOUND`,
          message: `Resource not found: ${id}`,
        });
      }
      return Buffer.from(sourceData as Uint8Array);
    });

    const process = cachedPromise(async () => {
      // const _sourceMeta = await getSourceMeta();
      const sourceData = await getSourceData();

      // Detect source image meta
      let imageMeta: ImageMeta;
      try {
        imageMeta = getImageMeta(sourceData) as ImageMeta;
      } catch {
        throw new HTTPError({
          statusCode: 400,
          statusText: `IPX_INVALID_IMAGE`,
          message: `Cannot parse image metadata: ${id}`,
        });
      }

      // Checked before the bytes reach sharp or SVGO, so a disallowed format
      // is never decoded. A source `image-meta` cannot identify was already
      // rejected above.
      if (
        allowedInputFormats &&
        !allowedInputFormats.has(imageMeta.type || "")
      ) {
        throw new HTTPError({
          statusCode: 403,
          statusText: `IPX_FORBIDDEN_INPUT_FORMAT`,
          message: `Input format is not allowed: ${imageMeta.type}`,
        });
      }

      // Determine format
      let mFormat = modifiers.f || modifiers.format;
      if (mFormat === "jpg") {
        mFormat = "jpeg";
      }
      // Use original SVG (sanitized and optimized with svgo if enabled) when
      // svg is requested or no format is specified. SVG is not a supported
      // output format for sharp, so it cannot be handled by the ternary below.
      if (imageMeta.type === "svg" && (!mFormat || mFormat === "svg")) {
        const sanitize = !options.svg?.unsafeSkipSanitize;
        const shouldOptimize = options.svg?.optimize !== false;
        const svgoConfig =
          options.svg?.optimize === false ? undefined : options.svg?.optimize;

        // Nothing to do if both sanitization and optimization are disabled
        if (!sanitize && !shouldOptimize) {
          return {
            data: sourceData,
            format: "svg+xml",
            meta: imageMeta,
          };
        }

        // Sanitization runs first so that optimization only sees safe input.
        // SVGO skips `preset-default` whenever `plugins` is set, which is
        // always the case here, so it has to be added explicitly.
        const plugins: SVGOPluginConfig[] = sanitize
          ? ["removeScripts", sanitizeSVGPlugin]
          : [];
        if (svgoConfig?.plugins) {
          plugins.push(...svgoConfig.plugins);
        } else if (shouldOptimize) {
          plugins.push("preset-default");
        }

        // https://github.com/svg/svgo
        const { optimize } = await getSVGO();
        let svg: string;
        try {
          svg = optimize(sourceData.toString("utf8"), {
            ...svgoConfig,
            plugins,
          }).data;
        } catch (error) {
          throw new HTTPError({
            statusCode: 400,
            statusText: `IPX_INVALID_SVG`,
            message: `Cannot parse SVG: ${id}`,
            cause: error,
          });
        }
        return {
          data: svg,
          format: "svg+xml",
          meta: imageMeta,
        };
      }

      const format =
        mFormat && SUPPORTED_FORMATS.has(mFormat)
          ? mFormat
          : SUPPORTED_FORMATS.has(imageMeta.type || "") // eslint-disable-line unicorn/no-nested-ternary
            ? imageMeta.type
            : "jpeg";

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
          // A source libvips can't parse is a bad image, not a bad modifier.
          throw new HTTPError({
            statusCode: 400,
            statusText: `IPX_INVALID_IMAGE`,
            message: `Cannot parse image metadata: ${id}`,
          });
        }
        if (total >= maxImageHeight) {
          throw new HTTPError({
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
        .flatMap(([name, arguments_]) => {
          const handler = getHandler(name as HandlerName);
          return handler ? [{ handler, name, args: arguments_ }] : [];
        })
        // Handlers run in ascending `order` groups (`0` by default) and
        // alphabetically by modifier name within a group, so that the order the
        // modifiers happen to appear in the URL never changes the result.
        // Handlers reading state another one writes rely on this: the context
        // modifiers (`fit`, `quality`, ...) are in group `-1`, and `extend` is
        // in group `1` so it sees the dimensions the resize modifiers record.
        .sort((a, b) => {
          const aOrder = a.handler.order || 0;
          const bOrder = b.handler.order || 0;
          return aOrder === bOrder
            ? (a.name || "").localeCompare(b.name || "")
            : aOrder - bOrder;
        });

      // Apply handlers
      const handlerContext: any = {
        meta: imageMeta,
        maxOutputDimension: options.maxOutputDimension,
      };
      for (const h of handlers) {
        sharp =
          applyHandler(handlerContext, sharp, h.handler, h.args.toString()) ||
          sharp;
      }

      // Colours are parsed eagerly by sharp, so an unknown name is rejected
      // here rather than silently rendering as black in the overlay that
      // `opacity` composites.
      if (handlerContext.background) {
        try {
          Sharp({
            create: {
              width: 1,
              height: 1,
              channels: 4,
              background: handlerContext.background,
            },
          });
        } catch (error) {
          throw asModifierError(error);
        }
      }

      // Apply format
      if (SUPPORTED_FORMATS.has(format || "")) {
        sharp = sharp.toFormat(format as any, {
          quality: handlerContext.quality,
        });
      }

      // Modifiers are user input and libvips does some validation of its own
      // only once it runs, so a failure here is a `400` rather than a `500`.
      let processedImage: Buffer;
      try {
        processedImage = await sharp.toBuffer();
      } catch (error) {
        throw asModifierError(error);
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
