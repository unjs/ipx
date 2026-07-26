import type { Handler } from "../types.ts";
import type { ArgMapper } from "./utils.ts";
import {
  VColor,
  VEnum,
  VNumber,
  VRequired,
  VSize,
  clampDimensionsPreservingAspectRatio,
} from "./utils.ts";

// Ranges below mirror the ones sharp enforces, so that invalid modifier
// arguments are rejected with a `400` instead of surfacing as a `500`.

// --------- Context Modifiers ---------

export const quality: Handler = {
  args: [VNumber("quality", { min: 1, max: 100, integer: true })],
  order: -1,
  apply: (context, _pipe, quality) => {
    context.quality = quality;
  },
};

// https://sharp.pixelplumbing.com/api-resize#resize
const FITS = ["contain", "cover", "fill", "inside", "outside"] as const;
export const fit: Handler = {
  args: [VEnum("fit", FITS)],
  order: -1,
  apply: (context, _pipe, fit) => {
    context.fit = fit;
  },
};

// https://sharp.pixelplumbing.com/api-resize#resize
const POSITIONS = [
  "top",
  "right top",
  "right",
  "right bottom",
  "bottom",
  "left bottom",
  "left",
  "left top",
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
  "center",
  "centre",
  "entropy",
  "attention",
] as const;
// sharp also accepts the numeric gravity (`0`-`8`) and strategy (`16`-`17`)
// constants a position name maps to.
const GRAVITIES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 16, 17]);
// `_` separates modifier args, so multi-word positions (`right top`) are also
// accepted with a `-` separator (`pos_right-top`).
const VPosition = (name: string): ArgMapper<number | string> => {
  const vEnum = VEnum(name, POSITIONS);
  return (argument) => {
    if (/^\d+$/.test(argument) && GRAVITIES.has(Number(argument))) {
      return Number(argument);
    }
    return vEnum(argument?.replace("-", " "));
  };
};
export const position: Handler = {
  args: [VPosition("position")],
  order: -1,
  apply: (context, _pipe, position) => {
    context.position = position;
  },
};

export const background: Handler = {
  args: [VColor("background")],
  order: -1,
  apply: (context, _pipe, background) => {
    context.background = background;
  },
};

// --------- Resize ---------

export const enlarge: Handler = {
  args: [],
  apply: (context) => {
    context.enlarge = true;
  },
};

const KERNELS = [
  "nearest",
  "linear",
  "cubic",
  "mitchell",
  "lanczos2",
  "lanczos3",
  "mks2013",
  "mks2021",
] as const;
export const kernel: Handler = {
  args: [VEnum("kernel", KERNELS)],
  apply: (context, _pipe, kernel) => {
    context.kernel = kernel;
  },
};

export const width: Handler = {
  args: [VNumber("width", { min: 1, integer: true })],
  apply: (context, pipe, width) => {
    return pipe.resize(width, undefined, {
      withoutEnlargement: !context.enlarge,
    });
  },
};

export const height: Handler = {
  args: [VNumber("height", { min: 1, integer: true })],
  apply: (context, pipe, height) => {
    return pipe.resize(undefined, height, {
      withoutEnlargement: !context.enlarge,
    });
  },
};

export const resize: Handler = {
  args: [VSize("resize")],
  apply: (context, pipe, size) => {
    if (!size) {
      return;
    }
    let { width, height } = size;
    // sharp's `withoutEnlargement` doesn't respect the requested aspect ratio, so we need to do it ourselves
    if (!context.enlarge) {
      const clamped = clampDimensionsPreservingAspectRatio(context.meta, {
        width,
        height,
      });
      width = clamped.width;
      height = clamped.height;
    }
    return pipe.resize(width, height, {
      fit: context.fit,
      position: context.position,
      background: context.background,
      kernel: context.kernel,
    });
  },
};

// https://sharp.pixelplumbing.com/api-resize#trim
export const trim: Handler = {
  args: [VNumber("trim", { min: 0 })],
  apply: (_context, pipe, threshold) => {
    return pipe.trim({ threshold });
  },
};

// https://sharp.pixelplumbing.com/api-resize#extend
const EXTEND_WITH = ["background", "copy", "repeat", "mirror"] as const;
const VExtendEdge = (name: string) =>
  VNumber(name, { min: 0, max: 10_000, integer: true });
export const extend: Handler = {
  args: [
    VExtendEdge("extend.top"),
    VExtendEdge("extend.right"),
    VExtendEdge("extend.bottom"),
    VExtendEdge("extend.left"),
    VEnum("extend.extendWith", EXTEND_WITH),
  ],
  // `background` is set by the `background` / `b` modifier and only used when
  // extending with `background` (the sharp default).
  apply: (context, pipe, top, right, bottom, left, extendWith) => {
    return pipe.extend({
      top,
      left,
      bottom,
      right,
      background: context.background,
      extendWith,
    });
  },
};

// https://sharp.pixelplumbing.com/api-resize#extract
const MAX_EXTRACT = 100_000_000;
export const extract: Handler = {
  // sharp requires all four values, there is no meaningful default.
  args: [
    VRequired(
      "extract.left",
      VNumber("extract.left", { min: 0, max: MAX_EXTRACT, integer: true }),
    ),
    VRequired(
      "extract.top",
      VNumber("extract.top", { min: 0, max: MAX_EXTRACT, integer: true }),
    ),
    VRequired(
      "extract.width",
      VNumber("extract.width", { min: 1, max: MAX_EXTRACT, integer: true }),
    ),
    VRequired(
      "extract.height",
      VNumber("extract.height", { min: 1, max: MAX_EXTRACT, integer: true }),
    ),
  ],
  apply: (_context, pipe, left, top, width, height) => {
    return pipe.extract({
      left,
      top,
      width,
      height,
    });
  },
};

// --------- Operations ---------

// https://sharp.pixelplumbing.com/api-operation#rotate
export const rotate: Handler = {
  // sharp accepts any angle, but libvips rejects ones it cannot fit in a
  // `gdouble` property, which would surface as a 500.
  args: [VNumber("rotate", { min: -3600, max: 3600 })],
  apply: (context, pipe, angle) => {
    return pipe.rotate(angle, {
      background: context.background,
    });
  },
};

// https://sharp.pixelplumbing.com/api-operation#flip
export const flip: Handler = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.flip();
  },
};

// https://sharp.pixelplumbing.com/api-operation#flop
export const flop: Handler = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.flop();
  },
};

// https://sharp.pixelplumbing.com/api-operation#sharpen
export const sharpen: Handler = {
  args: [
    VNumber("sharpen.sigma", { min: 0.000_001, max: 10 }),
    VNumber("sharpen.flat", { min: 0, max: 1_000_000 }),
    VNumber("sharpen.jagged", { min: 0, max: 1_000_000 }),
  ],
  apply: (_context, pipe, sigma, flat, jagged) => {
    // sharp requires a `sigma` whenever options are given, so fall back to its
    // default (mild) sharpening when it is omitted.
    return sigma === undefined
      ? pipe.sharpen()
      : pipe.sharpen({ sigma, m1: flat, m2: jagged });
  },
};

// https://sharp.pixelplumbing.com/api-operation#median
export const median: Handler = {
  args: [VNumber("median", { min: 1, max: 1000, integer: true })],
  apply: (_context, pipe, size) => {
    return pipe.median(size);
  },
};

// https://sharp.pixelplumbing.com/api-operation#blur
export const blur: Handler = {
  args: [VNumber("blur", { min: 0.3, max: 1000 })],
  apply: (_context, pipe, sigma) => {
    return pipe.blur(sigma);
  },
};

// https://sharp.pixelplumbing.com/api-operation#flatten
export const flatten: Handler = {
  args: [],
  // `background` is set by the `background` / `b` modifier.
  apply: (context, pipe) => {
    return pipe.flatten({
      background: context.background,
    });
  },
};

// https://sharp.pixelplumbing.com/api-operation#unflatten
export const unflatten: Handler = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.unflatten();
  },
};

// https://sharp.pixelplumbing.com/api-operation#gamma
export const gamma: Handler = {
  args: [
    VNumber("gamma", { min: 1, max: 3 }),
    VNumber("gamma.gammaOut", { min: 1, max: 3 }),
  ],
  apply: (_context, pipe, gamma, gammaOut) => {
    return pipe.gamma(gamma, gammaOut);
  },
};

// https://sharp.pixelplumbing.com/api-operation#negate
export const negate: Handler = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.negate();
  },
};

// https://sharp.pixelplumbing.com/api-operation#normalize
export const normalize: Handler = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.normalize();
  },
};

// https://sharp.pixelplumbing.com/api-operation#threshold
export const threshold: Handler = {
  args: [VNumber("threshold", { min: 0, max: 255, integer: true })],
  apply: (_context, pipe, threshold) => {
    return pipe.threshold(threshold);
  },
};

// https://sharp.pixelplumbing.com/api-operation#modulate
export const modulate: Handler = {
  args: [
    VNumber("modulate.brightness", { min: 0 }),
    VNumber("modulate.saturation", { min: 0 }),
    VNumber("modulate.hue", { integer: true }),
    VNumber("modulate.lightness"),
  ],
  apply: (_context, pipe, brightness, saturation, hue, lightness) => {
    // Sharp validates with `key in options`, so omitted args have to be left
    // out of the object entirely rather than passed as `undefined`.
    return pipe.modulate({
      ...(brightness === undefined ? {} : { brightness }),
      ...(saturation === undefined ? {} : { saturation }),
      ...(hue === undefined ? {} : { hue }),
      ...(lightness === undefined ? {} : { lightness }),
    });
  },
};

// --------- Colour Manipulation ---------

// https://sharp.pixelplumbing.com/api-colour#tint
export const tint: Handler = {
  args: [VColor("tint")],
  apply: (_context, pipe, rgb) => {
    return pipe.tint(rgb);
  },
};

// https://sharp.pixelplumbing.com/api-colour#grayscale
export const grayscale: Handler = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.grayscale();
  },
};

// --------- Aliases ---------

export const crop = extract;
export const q = quality;
export const b = background;
export const w = width;
export const h = height;
export const s = resize;
export const pos = position;
