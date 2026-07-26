import { describe, expect, it } from "vitest";

import {
  VArg,
  VColor,
  VEnum,
  VNumber,
  VRequired,
  VSize,
  parseArgs,
  clampDimensionsPreservingAspectRatio,
} from "../../src/handlers/utils.ts";

function catchError(function_: () => unknown) {
  try {
    function_();
  } catch (error) {
    return error;
  }
}

describe("utils", () => {
  it("VArg", () => {
    expect(VArg("123")).toBe(123);
    expect(VArg("true")).toBe(true);
    expect(VArg("false")).toBe(false);
    expect(VArg("null")).toBe(null);
    expect(VArg("undefined")).toBe(undefined);
    expect(VArg("Infinity")).toBe(Infinity);
    expect(VArg("450x300")).toBe("450x300");
    expect(VArg("cover")).toBe("cover");
    expect(VArg("ff0000")).toBe("ff0000");
  });

  it("VNumber", () => {
    const vNumber = VNumber("gamma", { min: 1, max: 3 });
    expect(vNumber("1")).toBe(1);
    expect(vNumber("2.2")).toBe(2.2);
    expect(vNumber("3")).toBe(3);
    // Omitted args are left to sharp defaults
    expect(vNumber(undefined as unknown as string)).toBe(undefined);
    expect(vNumber("")).toBe(undefined);
    expect(vNumber("undefined")).toBe(undefined);
    for (const invalid of ["abc", "0.9", "3.1", "true", "null", "Infinity"]) {
      expect(() => vNumber(invalid)).toThrowError(
        `Invalid \`gamma\` modifier argument: \`${invalid}\` (expected a number between 1 and 3)`,
      );
    }
    expect(catchError(() => vNumber("abc"))).toMatchObject({
      statusCode: 400,
      statusText: "IPX_INVALID_MODIFIER_ARG",
    });
  });

  it("VNumber (integer)", () => {
    const vPixels = VNumber("extend.top", { min: 0, integer: true });
    expect(vPixels("0")).toBe(0);
    expect(vPixels("100")).toBe(100);
    for (const invalid of ["-1", "1.5", "abc", "true", "Infinity", "null"]) {
      expect(() => vPixels(invalid)).toThrowError(
        `Invalid \`extend.top\` modifier argument: \`${invalid}\` (expected an integer greater than or equal to 0)`,
      );
    }
  });

  it("VNumber (max only)", () => {
    const vNumber = VNumber("threshold", { max: 255 });
    expect(vNumber("-10")).toBe(-10);
    expect(() => vNumber("256")).toThrowError(
      "(expected a number less than or equal to 255)",
    );
  });

  it("VEnum", () => {
    const vEnum = VEnum("extend.extendWith", ["background", "mirror"]);
    expect(vEnum("background")).toBe("background");
    expect(vEnum("mirror")).toBe("mirror");
    // Omitted args are left to sharp defaults
    expect(vEnum(undefined as unknown as string)).toBe(undefined);
    expect(vEnum("")).toBe(undefined);
    expect(vEnum("undefined")).toBe(undefined);
    for (const invalid of ["foo", "0", "true", "MIRROR"]) {
      expect(() => vEnum(invalid)).toThrowError(
        `Invalid \`extend.extendWith\` modifier argument: \`${invalid}\` (expected one of: background, mirror)`,
      );
    }
    expect(catchError(() => vEnum("foo"))).toMatchObject({
      statusCode: 400,
      statusText: "IPX_INVALID_MODIFIER_ARG",
    });
  });

  it("VColor", () => {
    const vColor = VColor("background");
    // Hex colours get the `#` that cannot be used in a URL path back
    expect(vColor("f00")).toBe("#f00");
    expect(vColor("ff0000")).toBe("#ff0000");
    expect(vColor("f00f")).toBe("#f00f");
    expect(vColor("ff000080")).toBe("#ff000080");
    expect(vColor("#ff0000")).toBe("#ff0000");
    expect(vColor("red")).toBe("red");
    expect(vColor("rebeccapurple")).toBe("rebeccapurple");
    expect(vColor("rgba(255, 0, 0, 0.5)")).toBe("rgba(255, 0, 0, 0.5)");
    expect(vColor("")).toBe(undefined);
    for (const invalid of ["12345", "#", "not a colour", "0", "ff00000"]) {
      expect(() => vColor(invalid)).toThrowError(
        `Invalid \`background\` modifier argument: \`${invalid}\``,
      );
    }
  });

  it("VSize", () => {
    const vSize = VSize("resize");
    expect(vSize("100x50")).toEqual({ width: 100, height: 50 });
    // A single dimension is a square
    expect(vSize("100")).toEqual({ width: 100, height: 100 });
    expect(vSize("")).toBe(undefined);
    for (const invalid of ["x", "100x", "x100", "0x100", "100x0", "-1", "a"]) {
      expect(() => vSize(invalid)).toThrowError(
        `Invalid \`resize\` modifier argument: \`${invalid}\` (expected \`{width}x{height}\` of positive integers)`,
      );
    }
  });

  it("VRequired", () => {
    const vRequired = VRequired(
      "extract.left",
      VNumber("extract.left", { min: 0, integer: true }),
    );
    expect(vRequired("10")).toBe(10);
    expect(() => vRequired("")).toThrowError(
      "Missing `extract.left` modifier argument",
    );
    expect(catchError(() => vRequired(""))).toMatchObject({
      statusCode: 400,
      statusText: "IPX_MISSING_MODIFIER_ARG",
    });
    // Invalid values still report the more specific error
    expect(() => vRequired("abc")).toThrowError(
      "Invalid `extract.left` modifier argument",
    );
  });

  it("parseArgs", () => {
    const mappers = [(arg: string) => arg.toUpperCase()];
    const result = parseArgs("hello_world", mappers);
    expect(result).toEqual(["HELLO"]);
  });

  it("clampDimensionsPreservingAspectRatio", () => {
    const sourceDimensions = { width: 200, height: 100 };
    const desiredDimensions = { width: 300, height: 150 };
    const result = clampDimensionsPreservingAspectRatio(
      sourceDimensions,
      desiredDimensions,
    );
    expect(result).toEqual({ width: 200, height: 100 });
  });
});
