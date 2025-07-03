import {
  quality,
  fit,
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
  gamma,
  negate,
  normalize,
  threshold,
  modulate,
  tint,
  grayscale,
} from "../../src/handlers/handlers";
import { describe, it, vi, expect } from "vitest";

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

    background.apply(context as any, {} as any, "ffffff");

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

  it("resize.apply() returns expected values when width is null", () => {
    const context = {
      enlarge: false,
    };
    const pipe = {
      resize: vi.fn(),
    };

    const actual = resize.apply(context as any, pipe as any, "x");

    expect(actual).toBe(undefined);
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

    resize.apply(context as any, pipe as any, "100x100");

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

    trim.apply({} as any, sharpMock as any);

    expect(sharpMock.trim).toHaveBeenCalled();
  });

  it("extend.apply() returns expected values", () => {
    const context = {
      background: "ffffff",
    };
    const sharpMock = {
      extend: vi.fn(),
    };

    extend.apply(context as any, sharpMock as any, 100, 100, 100, 100);

    expect(sharpMock.extend).toHaveBeenCalledWith({
      top: 100,
      bottom: 100,
      left: 100,
      right: 100,
      background: context.background,
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

    sharpen.apply({} as any, sharpMock as any, 100, 200, 300);

    expect(sharpMock.sharpen).toHaveBeenCalledWith(100, 200, 300);
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

    modulate.apply({} as any, sharpMock as any, 100, 200, 300);

    expect(sharpMock.modulate).toHaveBeenCalledWith({
      brightness: 100,
      saturation: 200,
      hue: 300,
    });
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
