import destr from "destr";
import type { Sharp } from "sharp";
import type { Handler, HandlerContext, ImageMeta } from "../types";
import * as Handlers from "./handlers";

export function VArg(argument: string) {
  return destr(argument);
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
  // eslint-disable-next-line import/namespace
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
  if (width > sourceDimensions.width) {
    width = sourceDimensions.width;
    height = Math.round(sourceDimensions.width / desiredAspectRatio);
  }
  if (height > sourceDimensions.height) {
    height = sourceDimensions.height;
    width = Math.round(sourceDimensions.height * desiredAspectRatio);
  }

  return { width, height };
}
