import { describe, expect, it } from "vitest";
import { defaultUrlParser, parseModifiersString } from "../src";
import { H3Event } from "h3";

describe("ipx: defaultUrlParser", () => {
  it("path with modifiers", async () => {
    const { id, modifiers } = defaultUrlParser({
      path: "/w_300&h_300&f_webp/assets/bliss.jpg",
    } as unknown as H3Event);

    expect(id).toBe("assets/bliss.jpg");
    expect(modifiers).toEqual({
      w: "300",
      h: "300",
      f: "webp",
    });
  });

  it("path with empty modifiers", async () => {
    const { id, modifiers } = defaultUrlParser({
      path: "/_/assets2/unjs.jpg",
    } as unknown as H3Event);

    expect(id).toBe("assets2/unjs.jpg");
    expect(modifiers).toEqual({});
  });
});

describe("ipx: parseModifiersString", () => {
  it("ordinary modifiers", async () => {
    const modifiers = parseModifiersString("w_300&h_600&f_webp");

    expect(modifiers).toEqual({
      w: "300",
      h: "600",
      f: "webp",
    });
  });

  it("alternative modifier value separators", async () => {
    const modifiers = parseModifiersString("w:300&h=600&f_jpeg");

    expect(modifiers).toEqual({
      w: "300",
      h: "600",
      f: "jpeg",
    });
  });

  it("boolean modifier", async () => {
    const modifiers = parseModifiersString("animated&s_300x300");

    expect(modifiers).toEqual({
      animated: "",
      s: "300x300",
    });
  });
});
