import {
  VArg,
  parseArgs,
  clampDimensionsPreservingAspectRatio,
} from "../../src/handlers/utils";
import { describe, expect, it } from "vitest";

describe("utils", () => {
  it("VArg", () => {
    expect(VArg("123")).toBe(123);
    expect(VArg("true")).toBe(true);
    expect(VArg("false")).toBe(false);
    expect(VArg("null")).toBe(null);
    expect(VArg("undefined")).toBe(undefined);
    expect(VArg("Infinity")).toBe(Infinity);
  });

  it("parseArgs", () => {
    const mappers = [(arg: string) => arg.toUpperCase()];
    const result = parseArgs("hello_world", mappers);
    expect(result).toEqual(["HELLO"]);
  });

  it("clampDimensionsPreservingAspectRatio", () => {
    const dimensions = [
      {
        source: [200, 100],
        desired: [300, 150],
        expected: [200, 100],
      },
      {
        source: [200, 150],
        desired: [150, 200],
        expected: [113, 150],
      },
      {
        source: [150, 200],
        desired: [200, 150],
        expected: [150, 113],
      },
      {
        source: [211, 40],
        desired: [170, 170, "contain"],
        expected: [170, 170],
      },
      {
        source: [211, 40],
        desired: [220, 110, "contain"],
        expected: [211, 106],
      },
      {
        source: [40, 211],
        desired: [110, 220, "contain"],
        expected: [106, 211],
      },
    ];

    for (const d of dimensions) {
      const result = clampDimensionsPreservingAspectRatio(
        d.desired[2] ?? null,
        { width: d.source[0], height: d.source[1] },
        { width: d.desired[0], height: d.desired[1] },
      );
      expect(result).toEqual({ width: d.expected[0], height: d.expected[1] });
    }
  });
});
