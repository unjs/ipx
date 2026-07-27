import { describe, it, vi, expect } from "vitest";
import type { Sharp } from "sharp";

import type { Handler } from "../../src/types.ts";
import {
  quality,
  fit,
  position,
  background,
  enlarge,
  kernel,
  width,
  height,
  resize,
  trim,
  extend,
  extract,
  rotate,
  flip,
  flop,
  sharpen,
  median,
  blur,
  flatten,
  unflatten,
  gamma,
  negate,
  normalize,
  threshold,
  modulate,
  tint,
  grayscale,
  autoOrient,
  dilate,
  erode,
  clahe,
  linear,
  brightness,
  saturation,
  hue,
  lightness,
  opacity,
} from "../../src/handlers/handlers.ts";
import { applyHandler } from "../../src/handlers/utils.ts";

describe("handlers", () => {
  it("quality.apply() returns expected values", () => {
    const context = {
      quality: 0,
    };

    quality.apply(context as any, {} as any, 100);

    expect(context.quality).toBe(100);
  });

  it("fit.apply() returns expected values", () => {
    const context = {
      fit: 0,
    };

    fit.apply(context as any, {} as any, 100);

    expect(context.fit).toBe(100);
  });

  it("background.apply() returns expected values", () => {
    const context = {
      background: "",
    };

    background.apply(context as any, {} as any, "#ffffff");

    expect(context.background).toBe("#ffffff");
  });

  it("enlarge.apply() returns expected values", () => {
    const context = {
      enlarge: false,
    };

    enlarge.apply(context as any, {} as any);

    expect(context.enlarge).toBeTruthy();
  });

  it("kernel.apply() returns expected values", () => {
    const context = {
      kernel: "",
    };

    kernel.apply(context as any, {} as any, "lanczos3");

    expect(context.kernel).toBe("lanczos3");
  });

  it("width.apply() returns expected values", () => {
    const context = {
      enlarge: false,
    };
    const pipe = {
      resize: vi.fn(),
    };

    width.apply(context as any, pipe as any, 100);

    expect(pipe.resize).toHaveBeenCalledWith(100, undefined, {
      withoutEnlargement: !context.enlarge,
    });
  });

  it("height.apply() returns expected values", () => {
    const context = {
      enlarge: false,
    };
    const pipe = {
      resize: vi.fn(),
    };

    height.apply(context as any, pipe as any, 100);

    expect(pipe.resize).toHaveBeenCalledWith(undefined, 100, {
      withoutEnlargement: !context.enlarge,
    });
  });

  it("resize.apply() returns expected values when size is missing", () => {
    const context = {
      enlarge: false,
    };
    const pipe = {
      resize: vi.fn(),
    };

    const actual = resize.apply(context as any, pipe as any, undefined);

    expect(actual).toBe(undefined);
    expect(pipe.resize).not.toHaveBeenCalled();
  });

  it("resize.apply() returns expected values", () => {
    const context = {
      enlarge: true,
      fit: false,
      position: "top",
      background: "ffffff",
      kernel: "lanczos3",
    };
    const pipe = {
      resize: vi.fn(),
    };

    resize.apply(context as any, pipe as any, { width: 100, height: 100 });

    expect(pipe.resize).toHaveBeenCalledWith(100, 100, {
      fit: context.fit,
      position: context.position,
      background: context.background,
      kernel: context.kernel,
    });
  });

  it("trim.apply() returns expected values", () => {
    const sharpMock = {
      trim: vi.fn(),
    };

    trim.apply({} as any, sharpMock as any, 100);

    expect(sharpMock.trim).toHaveBeenCalledWith({ threshold: 100 });
  });

  it("extend.apply() returns expected values", () => {
    const context = {
      background: "ffffff",
    };
    const sharpMock = {
      extend: vi.fn(),
    };

    extend.apply(
      context as any,
      sharpMock as any,
      100,
      100,
      100,
      100,
      "background",
    );

    expect(sharpMock.extend).toHaveBeenCalledWith({
      top: 100,
      bottom: 100,
      left: 100,
      right: 100,
      background: context.background,
      extendWith: "background",
    });
  });

  it("extract.apply() returns expected values", () => {
    const sharpMock = {
      extract: vi.fn(),
    };

    extract.apply({} as any, sharpMock as any, 100, 100, 100, 100);

    expect(sharpMock.extract).toHaveBeenCalledWith({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
    });
  });

  it("rotate.apply() returns expected values", () => {
    const context = {
      background: "ffffff",
    };
    const sharpMock = {
      rotate: vi.fn(),
    };

    rotate.apply(context as any, sharpMock as any, 100);

    expect(sharpMock.rotate).toHaveBeenCalledWith(100, {
      background: context.background,
    });
  });

  it("flip.apply() returns expected values", () => {
    const sharpMock = {
      flip: vi.fn(),
    };

    flip.apply({} as any, sharpMock as any);

    expect(sharpMock.flip).toHaveBeenCalledOnce();
  });

  it("flop.apply() returns expected values", () => {
    const sharpMock = {
      flop: vi.fn(),
    };

    flop.apply({} as any, sharpMock as any);

    expect(sharpMock.flop).toHaveBeenCalledOnce();
  });

  it("sharpen.apply() returns expected values", () => {
    const sharpMock = {
      sharpen: vi.fn(),
    };

    sharpen.apply({} as any, sharpMock as any, 5, 200, 300);

    expect(sharpMock.sharpen).toHaveBeenCalledWith({
      sigma: 5,
      m1: 200,
      m2: 300,
    });
  });

  // Sharp rejects an options object without a `sigma`, so it has to be left off
  // entirely to get the default (mild) sharpening.
  it("sharpen.apply() falls back to sharp defaults without a sigma", () => {
    const sharpMock = {
      sharpen: vi.fn(),
    };

    sharpen.apply({} as any, sharpMock as any, undefined, undefined, undefined);

    expect(sharpMock.sharpen).toHaveBeenCalledWith();
  });

  // libvips rejects a window larger than the image ("window too large"), so it
  // is clamped to the source rather than surfacing as a 500.
  it("clahe.apply() clamps its window to the source", () => {
    const sharpMock = {
      clahe: vi.fn(),
    };

    clahe.apply(
      { meta: { width: 40, height: 30 } } as any,
      sharpMock as any,
      100,
      100,
      undefined,
    );

    expect(sharpMock.clahe).toHaveBeenCalledWith({ width: 40, height: 30 });
  });

  it("median.apply() returns expected values", () => {
    const sharpMock = {
      median: vi.fn(),
    };

    median.apply({} as any, sharpMock as any, 100);

    expect(sharpMock.median).toHaveBeenCalledWith(100);
  });

  it("blur.apply() returns expected values", () => {
    const sharpMock = {
      blur: vi.fn(),
    };

    blur.apply({} as any, sharpMock as any, 100, "approximate", 0.5);

    expect(sharpMock.blur).toHaveBeenCalledWith({
      sigma: 100,
      precision: "approximate",
      minAmplitude: 0.5,
    });
  });

  // Sharp rejects an options object without a `sigma`, so it has to be left off
  // entirely to get the default (mild) blur.
  it("blur.apply() falls back to sharp defaults without a sigma", () => {
    const sharpMock = {
      blur: vi.fn(),
    };

    blur.apply({} as any, sharpMock as any, undefined, undefined, undefined);

    expect(sharpMock.blur).toHaveBeenCalledWith();
  });

  it("flatten.apply() returns expected values", () => {
    const context = {
      background: "ffffff",
    };
    const sharpMock = {
      flatten: vi.fn(),
    };

    flatten.apply(context as any, sharpMock as any);

    expect(sharpMock.flatten).toHaveBeenCalledWith({
      background: context.background,
    });
  });

  it("gamma.apply() returns expected values", () => {
    const sharpMock = {
      gamma: vi.fn(),
    };

    gamma.apply({} as any, sharpMock as any, 100, 200);

    expect(sharpMock.gamma).toHaveBeenCalledWith(100, 200);
  });

  it("negate.apply() returns expected values", () => {
    const sharpMock = {
      negate: vi.fn(),
    };

    negate.apply({} as any, sharpMock as any);

    expect(sharpMock.negate).toHaveBeenCalledOnce();
  });

  it("normalize.apply() returns expected values", () => {
    const sharpMock = {
      normalize: vi.fn(),
    };

    normalize.apply({} as any, sharpMock as any);

    expect(sharpMock.normalize).toHaveBeenCalledOnce();
  });

  it("threshold.apply() returns expected values", () => {
    const sharpMock = {
      threshold: vi.fn(),
    };

    threshold.apply({} as any, sharpMock as any, 100);

    expect(sharpMock.threshold).toHaveBeenCalledWith(100);
  });

  it("modulate.apply() returns expected values", () => {
    const sharpMock = {
      modulate: vi.fn(),
    };

    modulate.apply({} as any, sharpMock as any, 100, 200, 300, 400);

    expect(sharpMock.modulate).toHaveBeenCalledWith({
      brightness: 100,
      saturation: 200,
      hue: 300,
      lightness: 400,
    });
  });

  // Regression: `args` used to declare a single mapper, so `parseArgs` never
  // reached saturation/hue/lightness. Drive the handler through applyHandler so
  // the arg-count contract itself is covered.
  it("modulate parses every arg", () => {
    const sharpMock = {
      modulate: vi.fn(),
    };

    applyHandler({} as any, sharpMock as any, modulate, "2_1.2_90_10");

    expect(sharpMock.modulate).toHaveBeenCalledWith({
      brightness: 2,
      saturation: 1.2,
      hue: 90,
      lightness: 10,
    });
  });

  // Sharp checks `key in options`, so omitted args must not be forwarded at all.
  it("modulate omits trailing args that were not provided", () => {
    const sharpMock = {
      modulate: vi.fn(),
    };

    applyHandler({} as any, sharpMock as any, modulate, "2");

    expect(sharpMock.modulate).toHaveBeenCalledWith({ brightness: 2 });
  });

  it("tint.apply() returns expected values", () => {
    const sharpMock = {
      tint: vi.fn(),
    };

    tint.apply({} as any, sharpMock as any, "#ffffff");

    expect(sharpMock.tint).toHaveBeenCalledWith("#ffffff");
  });

  it("grayscale.apply() returns expected values", () => {
    const sharpMock = {
      grayscale: vi.fn(),
    };

    grayscale.apply({} as any, sharpMock as any);

    expect(sharpMock.grayscale).toHaveBeenCalledOnce();
  });
});

// Modifiers are user input and sharp only limits the *input* size, so handlers
// growing the output are capped by `context.maxOutputDimension`.
describe("maxOutputDimension", () => {
  const context = (maxOutputDimension: number | false | undefined) =>
    ({
      // `enlarge` disables every other bound on the output size
      enlarge: true,
      maxOutputDimension,
      meta: { width: 400, height: 200 },
    }) as any;

  it("resize is clamped, preserving the requested aspect ratio", () => {
    const pipe = { resize: vi.fn() };

    applyHandler(context(1000), pipe as any, resize, "8000x4000");

    expect(pipe.resize).toHaveBeenCalledWith(1000, 500, expect.anything());
  });

  it("width is clamped", () => {
    const pipe = { resize: vi.fn() };

    applyHandler(context(1000), pipe as any, width, "8000");

    expect(pipe.resize).toHaveBeenCalledWith(1000, undefined, {
      withoutEnlargement: false,
    });
  });

  it("height is clamped", () => {
    const pipe = { resize: vi.fn() };

    applyHandler(context(1000), pipe as any, height, "8000");

    // 500, not 1000: the source is twice as wide as it is tall, so a height of
    // 1000 would give a derived width of 2000.
    expect(pipe.resize).toHaveBeenCalledWith(undefined, 500, {
      withoutEnlargement: false,
    });
  });

  // Sharp derives the omitted side from the source aspect ratio, so a single
  // dimension within the limit can still blow up the other one.
  it("width is clamped for the derived height", () => {
    const pipe = { resize: vi.fn() };
    const tall = { ...context(1000), meta: { width: 200, height: 4000 } };

    applyHandler(tall, pipe as any, width, "1000");

    expect(pipe.resize).toHaveBeenCalledWith(50, undefined, {
      withoutEnlargement: false,
    });
  });

  it("extend edges are clamped to fit the canvas within the limit", () => {
    const pipe = { extend: vi.fn() };

    applyHandler(context(1000), pipe as any, extend, "5000_5000_5000_5000");

    expect(pipe.extend).toHaveBeenCalledWith({
      top: 400,
      bottom: 400,
      left: 300,
      right: 300,
      background: undefined,
      extendWith: undefined,
    });
  });

  it.each<false | undefined>([false, undefined])(
    "is disabled with `%s`",
    (max) => {
      const pipe = { resize: vi.fn(), extend: vi.fn() };

      applyHandler(context(max), pipe as any, resize, "8000x4000");
      applyHandler(context(max), pipe as any, extend, "5000");

      expect(pipe.resize).toHaveBeenCalledWith(8000, 4000, expect.anything());
      expect(pipe.extend).toHaveBeenCalledWith(
        expect.objectContaining({ top: 5000 }),
      );
    },
  );

  it("does not affect requests within the limit", () => {
    const pipe = { resize: vi.fn(), extend: vi.fn() };

    applyHandler(context(1000), pipe as any, resize, "300x150");
    applyHandler(context(1000), pipe as any, extend, "10_20_30_40");

    expect(pipe.resize).toHaveBeenCalledWith(300, 150, expect.anything());
    expect(pipe.extend).toHaveBeenCalledWith(
      expect.objectContaining({ top: 10, right: 20, bottom: 30, left: 40 }),
    );
  });
});

// Every modifier argument is validated up front so that bad input is a 400
// instead of an unhandled sharp error (a 500) further down the pipeline.
describe("handler args", () => {
  type Case = {
    handler: Handler;
    /** Modifier args, as parsed out of the URL. */
    args: string;
    /** Expected sharp call arguments, if the handler calls sharp. */
    pipe?: [keyof Sharp & string, ...unknown[]];
    /** Expected `context` mutations, if the handler is a context modifier. */
    context?: Record<string, unknown>;
  };

  const valid: Record<string, Case> = {
    quality: { handler: quality, args: "80", context: { quality: 80 } },
    fit: { handler: fit, args: "cover", context: { fit: "cover" } },
    position: { handler: position, args: "top", context: { position: "top" } },
    // `_` separates args, so multi-word positions use `-` (or `%20`).
    "position (multi-word)": {
      handler: position,
      args: "right-top",
      context: { position: "right top" },
    },
    "position (space)": {
      handler: position,
      args: "left bottom",
      context: { position: "left bottom" },
    },
    // sharp also accepts the numeric gravity/strategy constants
    "position (gravity)": {
      handler: position,
      args: "3",
      context: { position: 3 },
    },
    "position (strategy)": {
      handler: position,
      args: "17",
      context: { position: 17 },
    },
    background: {
      handler: background,
      args: "ff0000",
      context: { background: "#ff0000" },
    },
    "background (shorthand hex)": {
      handler: background,
      args: "f00",
      context: { background: "#f00" },
    },
    "background (alpha hex)": {
      handler: background,
      args: "ff000080",
      context: { background: "#ff000080" },
    },
    "background (named)": {
      handler: background,
      args: "red",
      context: { background: "red" },
    },
    enlarge: { handler: enlarge, args: "", context: { enlarge: true } },
    kernel: {
      handler: kernel,
      args: "lanczos3",
      context: { kernel: "lanczos3" },
    },
    width: {
      handler: width,
      args: "100",
      pipe: ["resize", 100, undefined, { withoutEnlargement: true }],
    },
    height: {
      handler: height,
      args: "100",
      pipe: ["resize", undefined, 100, { withoutEnlargement: true }],
    },
    resize: {
      handler: resize,
      args: "100x50",
      pipe: [
        "resize",
        100,
        50,
        {
          fit: undefined,
          position: undefined,
          background: undefined,
          kernel: undefined,
        },
      ],
    },
    "resize (square)": {
      handler: resize,
      args: "100",
      pipe: [
        "resize",
        100,
        100,
        {
          fit: undefined,
          position: undefined,
          background: undefined,
          kernel: undefined,
        },
      ],
    },
    trim: { handler: trim, args: "10", pipe: ["trim", { threshold: 10 }] },
    "trim (no args)": {
      handler: trim,
      args: "",
      pipe: ["trim", { threshold: undefined }],
    },
    extend: {
      handler: extend,
      args: "1_2_3_4_mirror",
      pipe: [
        "extend",
        {
          top: 1,
          right: 2,
          bottom: 3,
          left: 4,
          background: undefined,
          extendWith: "mirror",
        },
      ],
    },
    "extend (partial)": {
      handler: extend,
      args: "10",
      pipe: [
        "extend",
        {
          top: 10,
          right: undefined,
          bottom: undefined,
          left: undefined,
          background: undefined,
          extendWith: undefined,
        },
      ],
    },
    extract: {
      handler: extract,
      args: "1_2_3_4",
      pipe: ["extract", { left: 1, top: 2, width: 3, height: 4 }],
    },
    rotate: {
      handler: rotate,
      args: "90",
      pipe: ["rotate", 90, { background: undefined }],
    },
    "rotate (negative)": {
      handler: rotate,
      args: "-90",
      pipe: ["rotate", -90, { background: undefined }],
    },
    flip: { handler: flip, args: "", pipe: ["flip"] },
    flop: { handler: flop, args: "", pipe: ["flop"] },
    sharpen: {
      handler: sharpen,
      args: "2_1_2",
      pipe: ["sharpen", { sigma: 2, m1: 1, m2: 2 }],
    },
    "sharpen (no args)": { handler: sharpen, args: "", pipe: ["sharpen"] },
    median: { handler: median, args: "5", pipe: ["median", 5] },
    blur: { handler: blur, args: "5", pipe: ["blur", { sigma: 5 }] },
    "blur (all args)": {
      handler: blur,
      args: "5_float_0.5",
      pipe: ["blur", { sigma: 5, precision: "float", minAmplitude: 0.5 }],
    },
    "blur (no args)": { handler: blur, args: "", pipe: ["blur"] },
    dilate: { handler: dilate, args: "3", pipe: ["dilate", 3] },
    "dilate (no args)": {
      handler: dilate,
      args: "",
      pipe: ["dilate", undefined],
    },
    erode: { handler: erode, args: "3", pipe: ["erode", 3] },
    clahe: {
      handler: clahe,
      args: "10",
      // An omitted height falls back to the width, for a square window.
      pipe: ["clahe", { width: 10, height: 10 }],
    },
    "clahe (all args)": {
      handler: clahe,
      args: "10_20_5",
      pipe: ["clahe", { width: 10, height: 20, maxSlope: 5 }],
    },
    flatten: {
      handler: flatten,
      args: "",
      pipe: ["flatten", { background: undefined }],
    },
    unflatten: { handler: unflatten, args: "", pipe: ["unflatten"] },
    gamma: { handler: gamma, args: "2.2_1.8", pipe: ["gamma", 2.2, 1.8] },
    negate: { handler: negate, args: "", pipe: ["negate"] },
    "negate (alpha)": {
      handler: negate,
      args: "false",
      pipe: ["negate", { alpha: false }],
    },
    normalize: {
      handler: normalize,
      args: "",
      pipe: ["normalize", { lower: undefined, upper: undefined }],
    },
    "normalize (range)": {
      handler: normalize,
      args: "5_95",
      pipe: ["normalize", { lower: 5, upper: 95 }],
    },
    threshold: { handler: threshold, args: "128", pipe: ["threshold", 128] },
    "threshold (grayscale)": {
      handler: threshold,
      args: "128_false",
      pipe: ["threshold", 128, { grayscale: false }],
    },
    linear: { handler: linear, args: "1.2_-10", pipe: ["linear", 1.2, -10] },
    "linear (no args)": {
      handler: linear,
      args: "",
      pipe: ["linear", undefined, undefined],
    },
    modulate: {
      handler: modulate,
      args: "2_1.2_90_10",
      pipe: [
        "modulate",
        { brightness: 2, saturation: 1.2, hue: 90, lightness: 10 },
      ],
    },
    brightness: {
      handler: brightness,
      args: "1.5",
      pipe: ["modulate", { brightness: 1.5 }],
    },
    saturation: {
      handler: saturation,
      args: "0.5",
      pipe: ["modulate", { saturation: 0.5 }],
    },
    hue: { handler: hue, args: "90", pipe: ["modulate", { hue: 90 }] },
    lightness: {
      handler: lightness,
      args: "10",
      pipe: ["modulate", { lightness: 10 }],
    },
    tint: { handler: tint, args: "00ff00", pipe: ["tint", "#00ff00"] },
    grayscale: { handler: grayscale, args: "", pipe: ["grayscale"] },
    autoOrient: { handler: autoOrient, args: "", pipe: ["autoOrient"] },
  };

  for (const [name, { handler, args, pipe, context }] of Object.entries(
    valid,
  )) {
    it(`${name} accepts \`${args}\``, () => {
      const sharpMock = pipe ? { [pipe[0]]: vi.fn() } : {};
      const handlerContext = { meta: { width: 400, height: 300 } } as any;

      applyHandler(handlerContext, sharpMock as any, handler, args);

      if (pipe) {
        const [method, ...expected] = pipe;
        expect(sharpMock[method]).toHaveBeenCalledWith(...expected);
      }
      if (context) {
        expect(handlerContext).toMatchObject(context);
      }
    });
  }

  const invalid: Record<string, [Handler, string[]]> = {
    quality: [quality, ["abc", "0", "101", "80.5", "true", "null"]],
    fit: [fit, ["foo", "COVER", "0"]],
    position: [position, ["foo", "9", "18", "-1", "right top top"]],
    background: [background, ["12345", "not a colour", "#", "0"]],
    kernel: [kernel, ["foo", "LANCZOS3"]],
    width: [width, ["abc", "0", "-1", "1.5", "Infinity"]],
    height: [height, ["abc", "0", "-1", "1.5"]],
    resize: [resize, ["x", "abc", "0x100", "100x", "100xabc", "-1x-1"]],
    trim: [trim, ["abc", "-1", "null"]],
    extend: [
      extend,
      ["-10", "1.5", "abc", "10_10_10_10_foo", "10001", "10_10_10_abc"],
    ],
    extract: [extract, ["abc_0_10_10", "0_0_0_10", "0_0_10", "", "0_-1_1_1"]],
    rotate: [rotate, ["abc", "Infinity", "null", "1e10", "-3601"]],
    sharpen: [sharpen, ["abc", "0", "11", "2_-1", "2_1_abc"]],
    median: [median, ["abc", "0", "1001", "1.5"]],
    blur: [
      blur,
      ["abc", "0.2", "1001", "true", "5_nearest", "5_float_0", "5_float_1.5"],
    ],
    dilate: [dilate, ["abc", "0", "1.5", "101"]],
    erode: [erode, ["abc", "0", "1.5", "101"]],
    clahe: [clahe, ["", "abc", "0", "1.5", "101", "10_0", "10_10_101"]],
    linear: [linear, ["abc", "true", "Infinity", "1_abc"]],
    brightness: [brightness, ["", "abc", "-1"]],
    saturation: [saturation, ["", "abc", "-1"]],
    hue: [hue, ["", "abc", "1.5"]],
    lightness: [lightness, ["", "abc"]],
    opacity: [opacity, ["", "abc", "-0.1", "1.1"]],
    gamma: [gamma, ["abc", "0.5", "3.5", "2.2_abc", "2.2_4"]],
    threshold: [threshold, ["abc", "-1", "256", "1.5", "128_yes", "128_2"]],
    negate: [negate, ["yes", "2", "null"]],
    normalize: [normalize, ["abc", "-1", "100", "1_0.5", "1_101"]],
    modulate: [modulate, ["abc", "-1", "1_-1", "1_1_1.5", "1_1_1_abc"]],
    tint: [tint, ["not a colour", "12345", "#"]],
  };

  for (const [name, [handler, cases]] of Object.entries(invalid)) {
    it(`${name} rejects invalid args`, () => {
      for (const args of cases) {
        const sharpMock = new Proxy({}, { get: () => vi.fn() });
        // A full context: an incomplete one would make `apply` throw on its own,
        // so these cases would pass even if the arg mappers accepted everything.
        const context = { meta: { width: 400, height: 300 } } as any;
        expect(
          () => applyHandler(context, sharpMock as any, handler, args),
          `expected \`${name}\` to reject \`${args}\``,
        ).toThrowError(
          expect.objectContaining({
            statusCode: 400,
          }),
        );
      }
    });
  }

  // Sharp validates colour names itself; the error still has to be a 400.
  it("surfaces sharp errors as a 400", () => {
    const sharpMock = {
      tint: vi.fn(() => {
        throw new Error("Unable to parse color from string: notacolour");
      }),
    };

    expect(() =>
      applyHandler({} as any, sharpMock as any, tint, "notacolour"),
    ).toThrowError(
      expect.objectContaining({
        statusCode: 400,
        statusText: "IPX_INVALID_MODIFIER",
      }),
    );
  });
});
