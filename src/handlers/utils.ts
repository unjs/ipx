import type { Sharp } from "sharp";
import type { ImageMeta } from "image-meta";
import type { Handler, HandlerContext } from "../types.ts";
import * as Handlers from "./handlers.ts";

export function VArg(argument: string) {
  if (argument === "Infinity") {
    return Infinity;
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
}

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
  return handler.apply(context, pipe, ...arguments_);
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
