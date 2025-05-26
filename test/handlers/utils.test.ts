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
    const sourceDimensions = { width: 200, height: 100 };
    const desiredDimensions = { width: 300, height: 150 };
    const result = clampDimensionsPreservingAspectRatio(
      sourceDimensions,
      desiredDimensions,
    );
    expect(result).toEqual({ width: 200, height: 100 });
  });
});
