import type { Handler } from "../types.ts";
import type { ArgMapper } from "./utils.ts";
import {
  VBoolean,
  VColor,
  VEnum,
  VNumber,
  VRequired,
  VSize,
  clampDimensionsPreservingAspectRatio,
  clampExtendEdges,
  clampToMaxDimension,
  opacityOverlay,
  resizeOutputDimensions,
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

// `withoutEnlargement` is disabled by the `enlarge` modifier, so the requested
// dimensions are additionally capped to `maxOutputDimension` (see
// `clampToMaxDimension`) to bound how much memory the output can take.
//
// The resulting size is recorded on the context so that `extend` -- which
// libvips applies after the resize whatever the URL order -- budgets its edges
// against it instead of the source dimensions, which would let the two clamps
// stack past `maxOutputDimension`.

export const width: Handler = {
  args: [VNumber("width", { min: 1, integer: true })],
  apply: (context, pipe, width) => {
    const clamped = clampToMaxDimension(
      context.maxOutputDimension,
      { width },
      context.meta,
    );
    const withoutEnlargement = !context.enlarge;
    context.outputDimensions = resizeOutputDimensions(clamped, context.meta, {
      withoutEnlargement,
    });
    return pipe.resize(clamped.width, undefined, {
      withoutEnlargement,
    });
  },
};

export const height: Handler = {
  args: [VNumber("height", { min: 1, integer: true })],
  apply: (context, pipe, height) => {
    const clamped = clampToMaxDimension(
      context.maxOutputDimension,
      { height },
      context.meta,
    );
    const withoutEnlargement = !context.enlarge;
    context.outputDimensions = resizeOutputDimensions(clamped, context.meta, {
      withoutEnlargement,
    });
    return pipe.resize(undefined, clamped.height, {
      withoutEnlargement,
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
    // Applies with `enlarge` too, where nothing else bounds the output size.
    const capped = clampToMaxDimension(context.maxOutputDimension, {
      width,
      height,
    });
    context.outputDimensions = resizeOutputDimensions(capped, context.meta, {
      fit: context.fit,
    });
    return pipe.resize(capped.width, capped.height, {
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
  // Runs after the resize modifiers (which are all in the default `0` group) so
  // that `context.outputDimensions` is known by the time the edges are capped.
  // libvips extends after resizing either way, so this only affects the order
  // the sharp calls are made in, not the resulting image.
  order: 1,
  // `background` is set by the `background` / `b` modifier and only used when
  // extending with `background` (the sharp default).
  apply: (context, pipe, top, right, bottom, left, extendWith) => {
    // Edges grow the canvas without any input-size relation, so they are capped
    // to keep the extended canvas within `maxOutputDimension`. The budget comes
    // from the resized dimensions when there are any, since that is what
    // libvips extends -- the source dimensions only apply without a resize.
    const edges = clampExtendEdges(
      context.maxOutputDimension,
      { top, right, bottom, left },
      context.outputDimensions ?? context.meta,
    );
    return pipe.extend({
      top: edges.top,
      left: edges.left,
      bottom: edges.bottom,
      right: edges.right,
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

// https://sharp.pixelplumbing.com/api-operation#autoorient
export const autoorient: Handler = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.autoOrient();
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
    VNumber("sharpen.x1", { min: 0, max: 1_000_000 }),
    VNumber("sharpen.y2", { min: 0, max: 1_000_000 }),
    VNumber("sharpen.y3", { min: 0, max: 1_000_000 }),
  ],
  apply: (_context, pipe, sigma, flat, jagged, x1, y2, y3) => {
    // sharp requires a `sigma` whenever options are given, so fall back to its
    // default (mild) sharpening when it is omitted.
    return sigma === undefined
      ? pipe.sharpen()
      : pipe.sharpen({ sigma, m1: flat, m2: jagged, x1, y2, y3 });
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
const BLUR_PRECISIONS = ["integer", "float", "approximate"] as const;
export const blur: Handler = {
  args: [
    VNumber("blur.sigma", { min: 0.3, max: 1000 }),
    VEnum("blur.precision", BLUR_PRECISIONS),
    VNumber("blur.minAmplitude", { min: 0.001, max: 1 }),
  ],
  apply: (_context, pipe, sigma, precision, minAmplitude) => {
    // sharp requires a `sigma` whenever options are given, so fall back to its
    // default (mild) blur when it is omitted.
    return sigma === undefined
      ? pipe.blur()
      : pipe.blur({
          sigma,
          // Sharp validates with `key in options`, so omitted args have to be
          // left out of the object entirely.
          ...(precision === undefined ? {} : { precision }),
          ...(minAmplitude === undefined ? {} : { minAmplitude }),
        });
  },
};

// https://sharp.pixelplumbing.com/api-operation#dilate
// The cost grows with the width -- sharp's maximum of `65536` takes minutes on
// a large image -- so these are capped at a value that still covers what the
// operation is useful for.
const MAX_MORPHOLOGY = 100;
export const dilate: Handler = {
  args: [VNumber("dilate", { min: 1, max: MAX_MORPHOLOGY, integer: true })],
  apply: (_context, pipe, width) => {
    return pipe.dilate(width);
  },
};

// https://sharp.pixelplumbing.com/api-operation#erode
export const erode: Handler = {
  args: [VNumber("erode", { min: 1, max: MAX_MORPHOLOGY, integer: true })],
  apply: (_context, pipe, width) => {
    return pipe.erode(width);
  },
};

// https://sharp.pixelplumbing.com/api-operation#clahe
// libvips also rejects a window larger than the image itself ("window too
// large"), and the cost grows with it, so the range is capped well below the
// sharp maximum of `65536` -- in line with the `median` cap -- and clamped to
// the source dimensions.
const MAX_CLAHE = 100;
export const clahe: Handler = {
  args: [
    // sharp requires both sides, but a square window is the common case so an
    // omitted `height` falls back to `width` rather than being rejected.
    VRequired(
      "clahe.width",
      VNumber("clahe.width", { min: 1, max: MAX_CLAHE, integer: true }),
    ),
    VNumber("clahe.height", { min: 1, max: MAX_CLAHE, integer: true }),
    VNumber("clahe.maxSlope", { min: 0, max: 100, integer: true }),
  ],
  apply: (context, pipe, width, height, maxSlope) => {
    return pipe.clahe({
      width: Math.min(width, context.meta.width || width),
      height: Math.min(
        height ?? width,
        (context.meta.height || height) ?? width,
      ),
      ...(maxSlope === undefined ? {} : { maxSlope }),
    });
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
  args: [VBoolean("negate.alpha")],
  apply: (_context, pipe, alpha) => {
    // Sharp validates with `key in options`, so an omitted `alpha` has to be
    // left out of the object entirely.
    return alpha === undefined ? pipe.negate() : pipe.negate({ alpha });
  },
};

// https://sharp.pixelplumbing.com/api-operation#normalize
export const normalize: Handler = {
  args: [
    VNumber("normalize.lower", { min: 0, max: 99 }),
    VNumber("normalize.upper", { min: 1, max: 100 }),
  ],
  // sharp rejects a `lower` that is not below `upper`, which `applyHandler`
  // turns into a `400`.
  apply: (_context, pipe, lower, upper) => {
    return pipe.normalize({ lower, upper });
  },
};

// https://sharp.pixelplumbing.com/api-operation#threshold
export const threshold: Handler = {
  args: [
    VNumber("threshold", { min: 0, max: 255, integer: true }),
    VBoolean("threshold.grayscale"),
  ],
  apply: (_context, pipe, threshold, grayscale) => {
    // sharp treats *any* options object without a truthy `grayscale` as
    // `grayscale: false`, so it must be omitted entirely when not given.
    return grayscale === undefined
      ? pipe.threshold(threshold)
      : pipe.threshold(threshold, { grayscale });
  },
};

// https://sharp.pixelplumbing.com/api-operation#linear
export const linear: Handler = {
  args: [
    // sharp accepts any finite number for both.
    VNumber("linear.a"),
    VNumber("linear.b"),
  ],
  apply: (_context, pipe, a, b) => {
    return pipe.linear(a, b);
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

// Each of the four `modulate` options is also exposed on its own, since
// addressing a single one positionally is awkward (`/modulate___90/`). sharp
// merges the calls, so `/brightness_2,hue_90/` is one `modulate` operation.

export const brightness: Handler = {
  args: [VRequired("brightness", VNumber("brightness", { min: 0 }))],
  apply: (_context, pipe, brightness) => {
    return pipe.modulate({ brightness });
  },
};

export const saturation: Handler = {
  args: [VRequired("saturation", VNumber("saturation", { min: 0 }))],
  apply: (_context, pipe, saturation) => {
    return pipe.modulate({ saturation });
  },
};

export const hue: Handler = {
  args: [VRequired("hue", VNumber("hue", { integer: true }))],
  apply: (_context, pipe, hue) => {
    return pipe.modulate({ hue });
  },
};

export const lightness: Handler = {
  args: [VRequired("lightness", VNumber("lightness"))],
  apply: (_context, pipe, lightness) => {
    return pipe.modulate({ lightness });
  },
};

// --------- Colour Manipulation ---------

// sharp has no opacity operation, so a uniformly transparent single pixel
// overlay (repeated with `tile`) is composited over the image instead.
// `background` is set by the `background` / `b` modifier and, when given, the
// image is blended into it rather than made transparent.
// https://sharp.pixelplumbing.com/api-composite#composite
export const opacity: Handler = {
  args: [VRequired("opacity", VNumber("opacity", { min: 0, max: 1 }))],
  apply: (context, pipe, opacity) => {
    const overlay = opacityOverlay(opacity, context.background as string);
    // Scaling the alpha channel needs one to be there in the first place.
    return (context.background ? pipe : pipe.ensureAlpha()).composite([
      overlay,
    ]);
  },
};

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
