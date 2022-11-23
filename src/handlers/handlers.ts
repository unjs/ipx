import type { Handler } from "../types";
import { clampDimensionsPreservingAspectRatio, VArg as VArgument } from "./utils";

// --------- Context Modifers ---------

export const quality: Handler = {
  args: [VArgument],
  order: -1,
  apply: (context, _pipe, quality) => {
    context.quality = quality;
  }
};

// https://sharp.pixelplumbing.com/api-resize#resize
export const fit: Handler = {
  args: [VArgument],
  order: -1,
  apply: (context, _pipe, fit) => {
    context.fit = fit;
  }
};

// https://sharp.pixelplumbing.com/api-resize#resize
export const position: Handler = {
  args: [VArgument],
  order: -1,
  apply: (context, _pipe, position) => {
    context.position = position;
  }
};

const HEX_RE = /^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;
const SHORTHEX_RE = /^([\da-f])([\da-f])([\da-f])$/i;
export const background: Handler = {
  args: [VArgument],
  order: -1,
  apply: (context, _pipe, background) => {
    background = String(background);
    if (!background.startsWith("#") && (HEX_RE.test(background) || SHORTHEX_RE.test(background))) {
      background = "#" + background;
    }
    context.background = background;
  }
};

// --------- Resize ---------

export const enlarge: Handler = {
  args: [],
  apply: (context) => {
    context.enlarge = true;
  }
};

export const width: Handler = {
  args: [VArgument],
  apply: (context, pipe, width) => {
    return pipe.resize(width, undefined, { withoutEnlargement: !context.enlarge });
  }
};

export const height: Handler = {
  args: [VArgument],
  apply: (context, pipe, height) => {
    return pipe.resize(undefined, height, { withoutEnlargement: !context.enlarge });
  }
};

export const resize: Handler = {
  args: [VArgument, VArgument, VArgument],
  apply: (context, pipe, size) => {
    let [width, height] = String(size).split("x").map(Number);
    if (!width) {
      return;
    }
    if (!height) {
      height = width;
    }
    // sharp's `withoutEnlargement` doesn't respect the requested aspect ratio, so we need to do it ourselves
    if (!context.enlarge) {
      const clamped = clampDimensionsPreservingAspectRatio(context.meta, { width, height });
      width = clamped.width;
      height = clamped.height;
    }
    return pipe.resize(width, height, {
      fit: context.fit,
      position: context.position,
      background: context.background
    });
  }
};

// https://sharp.pixelplumbing.com/api-resize#trim
export const trim: Handler = {
  args: [VArgument],
  apply: (_context, pipe, threshold) => {
    return pipe.trim(threshold);
  }
};

// https://sharp.pixelplumbing.com/api-resize#extend
export const extend: Handler = {
  args: [VArgument, VArgument, VArgument, VArgument],
  apply: (context, pipe, top, right, bottom, left) => {
    return pipe.extend({
      top,
      left,
      bottom,
      right,
      background: context.background
    });
  }
};

// https://sharp.pixelplumbing.com/api-resize#extract
export const extract: Handler = {
  args: [VArgument, VArgument, VArgument, VArgument],
  apply: (context, pipe, top, right, bottom, left) => {
    return pipe.extend({
      top,
      left,
      bottom,
      right,
      background: context.background
    });
  }
};

// --------- Operations ---------

// https://sharp.pixelplumbing.com/api-operation#rotate
export const rotate: Handler = {
  args: [VArgument],
  apply: (context, pipe, angel) => {
    return pipe.rotate(angel, {
      background: context.background
    });
  }
};

// https://sharp.pixelplumbing.com/api-operation#flip
export const flip: Handler = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.flip();
  }
};

// https://sharp.pixelplumbing.com/api-operation#flop
export const flop: Handler = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.flop();
  }
};

// https://sharp.pixelplumbing.com/api-operation#sharpen
export const sharpen: Handler = {
  args: [VArgument, VArgument, VArgument],
  apply: (_context, pipe, sigma, flat, jagged) => {
    return pipe.sharpen(sigma, flat, jagged);
  }
};

// https://sharp.pixelplumbing.com/api-operation#median
export const median: Handler = {
  args: [VArgument, VArgument, VArgument],
  apply: (_context, pipe, size) => {
    return pipe.median(size);
  }
};

// https://sharp.pixelplumbing.com/api-operation#blur
export const blur: Handler = {
  args: [VArgument, VArgument, VArgument],
  apply: (_context, pipe) => {
    return pipe.blur();
  }
};

// https://sharp.pixelplumbing.com/api-operation#flatten
// TODO: Support background
export const flatten: Handler = {
  args: [VArgument, VArgument, VArgument],
  apply: (context, pipe) => {
    return pipe.flatten({
      background: context.background
    });
  }
};

// https://sharp.pixelplumbing.com/api-operation#gamma
export const gamma: Handler = {
  args: [VArgument, VArgument, VArgument],
  apply: (_context, pipe, gamma, gammaOut) => {
    return pipe.gamma(gamma, gammaOut);
  }
};

// https://sharp.pixelplumbing.com/api-operation#negate
export const negate: Handler = {
  args: [VArgument, VArgument, VArgument],
  apply: (_context, pipe) => {
    return pipe.negate();
  }
};

// https://sharp.pixelplumbing.com/api-operation#normalize
export const normalize: Handler = {
  args: [VArgument, VArgument, VArgument],
  apply: (_context, pipe) => {
    return pipe.normalize();
  }
};

// https://sharp.pixelplumbing.com/api-operation#threshold
export const threshold: Handler = {
  args: [VArgument],
  apply: (_context, pipe, threshold) => {
    return pipe.threshold(threshold);
  }
};

// https://sharp.pixelplumbing.com/api-operation#modulate
export const modulate: Handler = {
  args: [VArgument],
  apply: (_context, pipe, brightness, saturation, hue) => {
    return pipe.modulate({
      brightness,
      saturation,
      hue
    });
  }
};

// --------- Colour Manipulation ---------

// https://sharp.pixelplumbing.com/api-colour#tint
export const tint: Handler = {
  args: [VArgument],
  apply: (_context, pipe, rgb) => {
    return pipe.tint(rgb);
  }
};

// https://sharp.pixelplumbing.com/api-colour#grayscale
export const grayscale: Handler = {
  args: [VArgument],
  apply: (_context, pipe) => {
    return pipe.grayscale();
  }
};

// --------- Aliases ---------

export const crop = extract;
export const q = quality;
export const b = background;
export const w = width;
export const h = height;
export const s = resize;
export const pos = position;
