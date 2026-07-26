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
    // Arg mappers cover the common cases, but sharp does some validation of its
    // own (unknown colour names, ...). Modifiers are user input, so surface it
    // as a `400` rather than an unhandled `500`.
    if (error instanceof HTTPError) {
      throw error;
    }
    throw new HTTPError({
      statusCode: 400,
      statusText: "IPX_INVALID_MODIFIER",
      message: `Cannot apply modifier: ${(error as Error)?.message || error}`,
      cause: error,
    });
  }
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
