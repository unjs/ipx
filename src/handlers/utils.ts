import { HTTPError } from "h3";
import type { Sharp } from "sharp";
import type { ImageMeta } from "image-meta";
import type { Handler, HandlerContext } from "../types.ts";
import * as Handlers from "./handlers.ts";

/**
 * Loosely coerces a raw modifier argument to a boolean, number, string or null.
 *
 * Prefer the validating mappers below (`VNumber`, `VEnum`, `VColor`, ...) when
 * adding a modifier: they reject invalid input with a `400` up front instead of
 * letting sharp throw an unhandled error (a `500`) further down the pipeline.
 */
export function VArg(argument: string) {
  if (argument === "Infinity") {
    return Infinity;
  }
  if (argument === "undefined") {
    return undefined;
  }
  try {
    const val = JSON.parse(argument);
    const t = typeof val;
    if (t === "boolean" || t === "number" || t === "string" || val === null) {
      return val;
    }
  } catch {
    // ignore parsing errors
  }
  // Fallback to the raw string (e.g. "40x40", "cover", "top", hex colors).
  return argument;
}

// --------- Arg Mappers ---------

/**
 * Maps one raw modifier argument to the value passed to the handler.
 *
 * `undefined` means "not provided": the handler leaves the corresponding sharp
 * option out so that sharp applies its own default.
 */
export type ArgMapper<T> = (argument: string) => T | undefined;

function invalidArg(name: string, argument: string, expected: string): never {
  throw new HTTPError({
    statusCode: 400,
    statusText: "IPX_INVALID_MODIFIER_ARG",
    message: `Invalid \`${name}\` modifier argument: \`${argument}\` (expected ${expected})`,
  });
}

/**
 * An argument is omitted when the modifier has no value at all (`/blur/`) or
 * when a trailing/positional slot is left empty (`/extend_10/`, `/gamma_2.2/`).
 */
function isOmitted(argument: string): boolean {
  return (
    argument === undefined || argument === "" || argument === "undefined"
    /* `null` is deliberately not treated as omitted: it is invalid input. */
  );
}

/**
 * Creates an arg mapper accepting a number, or no value at all.
 *
 * Bounds mirror the ones sharp enforces so that invalid input is rejected
 * before it reaches sharp.
 *
 * @param name Argument name used in the error message (e.g. `extend.top`).
 * @param options Accepted range and whether the number has to be an integer.
 */
export function VNumber(
  name: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): ArgMapper<number> {
  const { min, max, integer } = options;
  const expected = [
    integer ? "an integer" : "a number",
    min !== undefined && max !== undefined
      ? `between ${min} and ${max}`
      : (min !== undefined && `greater than or equal to ${min}`) ||
        (max !== undefined && `less than or equal to ${max}`) ||
        "",
  ]
    .filter(Boolean)
    .join(" ");

  return (argument) => {
    if (isOmitted(argument)) {
      return undefined;
    }
    const value = VArg(argument);
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      (!integer || Number.isInteger(value)) &&
      (min === undefined || value >= min) &&
      (max === undefined || value <= max)
    ) {
      return value;
    }
    invalidArg(name, argument, expected);
  };
}

/**
 * Creates an arg mapper accepting one of `values`, or no value at all.
 *
 * @param name Argument name used in the error message (e.g. `extend.extendWith`).
 * @param values The allowed values.
 */
export function VEnum<T extends string>(
  name: string,
  values: readonly T[],
): ArgMapper<T> {
  const expected = `one of: ${values.join(", ")}`;
  return (argument) => {
    if (isOmitted(argument)) {
      return undefined;
    }
    if ((values as readonly string[]).includes(argument)) {
      return argument as T;
    }
    invalidArg(name, argument, expected);
  };
}

/**
 * Creates an arg mapper accepting a boolean, or no value at all.
 *
 * `1` / `0` are accepted alongside `true` / `false` since they are shorter to
 * write in a URL.
 *
 * @param name Argument name used in the error message (e.g. `negate.alpha`).
 */
export function VBoolean(name: string): ArgMapper<boolean> {
  return (argument) => {
    if (isOmitted(argument)) {
      return undefined;
    }
    if (argument === "true" || argument === "1") {
      return true;
    }
    if (argument === "false" || argument === "0") {
      return false;
    }
    invalidArg(name, argument, "`true` or `false`");
  };
}

// Hex colours (`fff`, `ffff`, `ffffff`, `ffffffff`) with an optional leading
// `#` -- which cannot be used in a URL path, hence the shorthand.
const HEX_COLOR_RE = /^#?(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
// Functional notations understood by the `color` module used by sharp.
const FN_COLOR_RE = /^(?:rgba?|hsla?|hwb)\([\d\s%,./-]+\)$/i;
// Named CSS colours (`red`, `rebeccapurple`, ...). Unknown names are rejected
// by sharp itself, which `applyHandler` turns into a `400`.
const NAMED_COLOR_RE = /^[a-z]{3,20}$/i;

/**
 * Creates an arg mapper accepting a colour, or no value at all.
 *
 * Hex colours are normalized with a leading `#` since it cannot be used inside
 * a URL path.
 *
 * @param name Argument name used in the error message (e.g. `background`).
 */
export function VColor(name: string): ArgMapper<string> {
  return (argument) => {
    if (isOmitted(argument)) {
      return undefined;
    }
    if (HEX_COLOR_RE.test(argument)) {
      return argument.startsWith("#") ? argument : `#${argument}`;
    }
    if (FN_COLOR_RE.test(argument) || NAMED_COLOR_RE.test(argument)) {
      return argument;
    }
    invalidArg(
      name,
      argument,
      "a hex (`f00`, `ff0000`) or named (`red`) colour",
    );
  };
}

const SIZE_RE = /^(\d+)(?:x(\d+))?$/;

/**
 * Creates an arg mapper accepting a `{width}x{height}` (or square `{size}`)
 * dimension, or no value at all.
 *
 * @param name Argument name used in the error message (e.g. `resize`).
 */
export function VSize(
  name: string,
): ArgMapper<{ width: number; height: number }> {
  return (argument) => {
    if (isOmitted(argument)) {
      return undefined;
    }
    const match = SIZE_RE.exec(argument);
    const width = Number(match?.[1]);
    const height = match?.[2] === undefined ? width : Number(match[2]);
    if (match && width > 0 && height > 0) {
      return { width, height };
    }
    invalidArg(name, argument, "`{width}x{height}` of positive integers");
  };
}

/**
 * Wraps an arg mapper to reject an omitted value.
 *
 * @param name Argument name used in the error message (e.g. `extract.left`).
 * @param mapper The mapper validating the value itself.
 */
export function VRequired<T>(
  name: string,
  mapper: ArgMapper<T>,
): (argument: string) => T {
  return (argument) => {
    const value = mapper(argument);
    if (value === undefined) {
      throw new HTTPError({
        statusCode: 400,
        statusText: "IPX_MISSING_MODIFIER_ARG",
        message: `Missing \`${name}\` modifier argument`,
      });
    }
    return value;
  };
}

// --------- Handlers ---------

export function parseArgs(
  arguments_: string,
  mappers: ((...args: any[]) => any)[],
) {
  const vargs = arguments_.split("_");
  return mappers.map((v, index) => v(vargs[index]));
}

export type HandlerName = keyof typeof Handlers;

export function getHandler(key: HandlerName): Handler {
  return Handlers[key];
}

export function applyHandler(
  context: HandlerContext,
  pipe: Sharp,
  handler: Handler,
  argumentsString: string,
) {
  const arguments_ = handler.args
    ? parseArgs(argumentsString, handler.args)
    : [];
  try {
    return handler.apply(context, pipe, ...arguments_);
  } catch (error) {
    throw asModifierError(error);
  }
}

/**
 * Turns an error raised while applying modifiers into a `400`.
 *
 * Arg mappers cover the common cases, but sharp and libvips do some validation
 * of their own (unknown colour names, a `clahe` window larger than the image,
 * ...). Modifiers are user input, so their failures are surfaced as a `400`
 * rather than an unhandled `500`.
 */
export function asModifierError(error: unknown): Error {
  if (HTTPError.isError(error)) {
    return error;
  }
  return new HTTPError({
    statusCode: 400,
    statusText: "IPX_INVALID_MODIFIER",
    message: `Cannot apply modifier: ${(error as Error)?.message || error}`,
    cause: error,
  });
}

// Colours are interpolated into SVG attributes below. `VColor` only lets a hex,
// functional or named colour through, none of which can contain a quote or an
// angle bracket, so they cannot break out of the attribute.
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Rejects a `round` that would need a raw buffer larger than the budget.
 *
 * `applyRoundedCorners` has to materialize the whole output as raw pixels, so
 * unlike the rest of the pipeline -- which libvips streams -- its cost is the
 * full size of the image at once. The check runs before anything is allocated,
 * from the largest output the modifiers could produce: `maxOutputDimension`
 * bounds a single page, but an animated image stacks all of its pages into one
 * tall image and nothing else bounds *that*.
 *
 * @param max The limit, or `false`/`undefined` to leave it unchecked.
 * @param output Upper bounds on the pipeline output.
 * @throws {HTTPError} A `400` when the image cannot fit.
 */
export function assertRoundedCornersFit(
  max: number | false | undefined,
  output: {
    pages: number;
    source: { width?: number; height?: number };
    canGrow: boolean;
  },
): void {
  if (!max) {
    return;
  }
  const { pages, source, canGrow } = output;
  const width = canGrow ? max : Math.min(max, source.width || max);
  const height = canGrow ? max : Math.min(max, source.height || max);
  if (pages * width * height > max * max) {
    throw new HTTPError({
      statusCode: 400,
      statusText: "IPX_OUTPUT_TOO_LARGE",
      message: `Cannot round the corners of ${pages} pages of up to ${width}x${height}: it exceeds the ${max}x${max} budget`,
    });
  }
}

/**
 * Rounds the corners of the image.
 *
 * sharp has no rounded corners operation, so the shape has to be a composited
 * SVG sized to the image. The pipeline output dimensions are only known once it
 * has run, hence the round-trip through a raw (uncompressed) buffer: it is the
 * cheapest way to resolve them without re-encoding the image twice.
 *
 * Animated images are laid out as a vertically stacked "toilet roll", so the
 * shape is repeated for every page and `pageHeight` is carried over to the new
 * pipeline to keep the frames intact.
 *
 * @param Sharp The sharp constructor.
 * @param pipe The pipeline to round.
 * @param radius Corner radius in pixels. Clamped to half of the shortest side,
 * so `Infinity` yields a circle (or a pill for non-square images).
 * @param background Colour to fill the cut off corners with. When omitted they
 * are made transparent instead, which needs an output format with an alpha
 * channel.
 * @returns A new pipeline, holding the rounded image.
 */
export async function applyRoundedCorners(
  Sharp: typeof import("sharp").default,
  pipe: Sharp,
  radius: number,
  options: { background?: string; maxOutputDimension?: number | false } = {},
): Promise<Sharp> {
  const { background, maxOutputDimension: max } = options;

  // `depth` is forced so that a 16-bit pipeline cannot be re-read as 8-bit.
  const { data, info } = await pipe
    .ensureAlpha()
    .raw({ depth: "uchar" })
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Rasterizing the overlay and decoding the raw data again both allocate
  // another copy of the image, so the total is held to the same budget as a
  // single `maxOutputDimension` square. Animated images are the case that gets
  // there, since their pages are stacked into one tall image.
  if (max && width * height > max * max) {
    throw new HTTPError({
      statusCode: 400,
      statusText: "IPX_OUTPUT_TOO_LARGE",
      message: `Cannot round the corners of a ${width}x${height} image: it exceeds the ${max}x${max} budget`,
    });
  }

  const pageHeight = info.pageHeight || height;
  const pages = Math.max(1, Math.round(height / pageHeight));
  const r = Math.min(radius, width / 2, pageHeight / 2);

  const rects = Array.from(
    { length: pages },
    (_, page) =>
      `<rect x="0" y="${page * pageHeight}" width="${width}" height="${pageHeight}" rx="${r}" ry="${r}"/>`,
  ).join("");

  // Without a background the rounded rectangle is used as an alpha mask
  // (`dest-in` keeps the image only where the overlay is opaque). With one, the
  // corners are painted over instead, so that the output stays opaque and
  // formats without an alpha channel (jpeg, ...) work too.
  const overlay = background
    ? `<svg xmlns="${SVG_NS}" width="${width}" height="${height}">` +
      `<mask id="corners"><rect width="${width}" height="${height}" fill="#fff"/><g fill="#000">${rects}</g></mask>` +
      `<rect width="${width}" height="${height}" fill="${background}" mask="url(#corners)"/></svg>`
    : `<svg xmlns="${SVG_NS}" width="${width}" height="${height}"><g fill="#fff">${rects}</g></svg>`;

  return Sharp(data, {
    // The data comes from a pipeline whose input already passed the limit.
    limitInputPixels: false,
    raw: {
      width,
      height,
      channels,
      ...(pages > 1 && { pageHeight }),
    },
  }).composite([
    {
      input: Buffer.from(overlay),
      // The overlay covers every page of an animated image, so it can be taller
      // than the sharp default allows. It is bounded by the check above.
      limitInputPixels: false,
      blend: background ? "over" : "dest-in",
    },
  ]);
}

/**
 * Builds the single pixel overlay that the `opacity` modifier tiles over the
 * image.
 *
 * @param opacity The requested opacity, between `0` and `1`.
 * @param background Colour to blend the image into. When omitted the alpha
 * channel is scaled instead, which needs an output format supporting it.
 */
export function opacityOverlay(opacity: number, background?: string) {
  return background
    ? // Blending the background over the image at `1 - opacity` leaves an
      // opaque result, so formats without an alpha channel work too.
      {
        input: Buffer.from(
          `<svg xmlns="${SVG_NS}" width="1" height="1"><rect width="1" height="1" fill="${background}" fill-opacity="${1 - opacity}"/></svg>`,
        ),
        tile: true,
        blend: "over" as const,
      }
    : // `dest-in` multiplies the image alpha by the overlay alpha.
      {
        input: {
          create: {
            width: 1,
            height: 1,
            channels: 4 as const,
            background: { r: 0, g: 0, b: 0, alpha: opacity },
          },
        },
        tile: true,
        blend: "dest-in" as const,
      };
}

/**
 * Clamps requested output dimensions to `max`, preserving the requested aspect
 * ratio.
 *
 * Sharp's `limitInputPixels` only bounds the *input*, so without this cap a
 * request such as `/enlarge,s_20000x20000/img.jpg` makes sharp allocate a
 * ~1.6GB output buffer from an arbitrarily small source image.
 *
 * A side that was not requested stays omitted (sharp then derives it from the
 * source aspect ratio), but `source` is used to make sure that derived side
 * cannot exceed the limit either.
 *
 * @param max The limit, or `false`/`undefined` to leave the dimensions as-is.
 * @param desired The requested dimensions.
 * @param source The source dimensions, used to derive an omitted side.
 */
export function clampToMaxDimension(
  max: number | false | undefined,
  desired: { width?: number; height?: number },
  source?: { width?: number; height?: number },
): { width?: number; height?: number } {
  const { width, height } = desired;
  if (!max || (width === undefined && height === undefined)) {
    return desired;
  }

  // Sharp preserves the source aspect ratio when only one side is requested.
  const ratio =
    source?.width && source?.height ? source.width / source.height : undefined;
  const effectiveWidth =
    width ?? (ratio && height ? height * ratio : undefined);
  const effectiveHeight =
    height ?? (ratio && width ? width / ratio : undefined);

  const scale = Math.min(
    effectiveWidth ? max / effectiveWidth : 1,
    effectiveHeight ? max / effectiveHeight : 1,
  );
  if (scale >= 1) {
    return desired;
  }

  // Both sides are scaled by the same factor, so the requested aspect ratio is
  // preserved. `Math.min` guards against floating point rounding above `max`.
  const clamp = (value?: number) =>
    value === undefined
      ? undefined
      : Math.max(1, Math.min(max, Math.round(value * scale)));
  return { width: clamp(width), height: clamp(height) };
}

/**
 * Clamps `extend` edges so that the extended canvas cannot exceed `max` in
 * either dimension.
 *
 * Both edges of an axis are scaled down by the same factor rather than the
 * request being rejected, for consistency with how resize dimensions are
 * clamped. Omitted edges stay omitted so sharp applies its own default (`0`).
 *
 * @param max The limit, or `false`/`undefined` to leave the edges as-is.
 * @param edges The requested per-side extend values.
 * @param source The dimensions of the image being extended.
 */
export function clampExtendEdges(
  max: number | false | undefined,
  edges: { top?: number; right?: number; bottom?: number; left?: number },
  source?: { width?: number; height?: number },
) {
  if (!max) {
    return edges;
  }
  const [top, bottom] = clampEdges(
    max - (source?.height || 0),
    edges.top,
    edges.bottom,
  );
  const [left, right] = clampEdges(
    max - (source?.width || 0),
    edges.left,
    edges.right,
  );
  return { top, right, bottom, left };
}

/** Clamps the two edges of one axis to the space left within the limit. */
function clampEdges(
  available: number,
  a: number | undefined,
  b: number | undefined,
): [number | undefined, number | undefined] {
  const total = (a || 0) + (b || 0);
  if (total === 0 || total <= available) {
    return [a, b];
  }
  const scale = Math.max(0, available) / total;
  const clamp = (value?: number) =>
    value === undefined ? undefined : Math.floor(value * scale);
  return [clamp(a), clamp(b)];
}

export function clampDimensionsPreservingAspectRatio(
  sourceDimensions: ImageMeta,
  desiredDimensions: { width: number; height: number },
) {
  const desiredAspectRatio = desiredDimensions.width / desiredDimensions.height;
  let { width, height } = desiredDimensions;
  if (sourceDimensions.width && width > sourceDimensions.width) {
    width = sourceDimensions.width;
    height = Math.round(sourceDimensions.width / desiredAspectRatio);
  }
  if (sourceDimensions.height && height > sourceDimensions.height) {
    height = sourceDimensions.height;
    width = Math.round(sourceDimensions.height * desiredAspectRatio);
  }

  return { width, height };
}
