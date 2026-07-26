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

    blur.apply({} as any, sharpMock as any, 100);

    expect(sharpMock.blur).toHaveBeenCalledWith(100);
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
    blur: { handler: blur, args: "5", pipe: ["blur", 5] },
    "blur (no args)": { handler: blur, args: "", pipe: ["blur", undefined] },
    flatten: {
      handler: flatten,
      args: "",
      pipe: ["flatten", { background: undefined }],
    },
    unflatten: { handler: unflatten, args: "", pipe: ["unflatten"] },
    gamma: { handler: gamma, args: "2.2_1.8", pipe: ["gamma", 2.2, 1.8] },
    negate: { handler: negate, args: "", pipe: ["negate"] },
    normalize: { handler: normalize, args: "", pipe: ["normalize"] },
    threshold: { handler: threshold, args: "128", pipe: ["threshold", 128] },
    modulate: {
      handler: modulate,
      args: "2_1.2_90_10",
      pipe: [
        "modulate",
        { brightness: 2, saturation: 1.2, hue: 90, lightness: 10 },
      ],
    },
    tint: { handler: tint, args: "00ff00", pipe: ["tint", "#00ff00"] },
    grayscale: { handler: grayscale, args: "", pipe: ["grayscale"] },
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
    blur: [blur, ["abc", "0.2", "1001", "true"]],
    gamma: [gamma, ["abc", "0.5", "3.5", "2.2_abc", "2.2_4"]],
    threshold: [threshold, ["abc", "-1", "256", "1.5"]],
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
