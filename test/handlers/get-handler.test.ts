import { describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";
// Must be imported before `src/index.ts`: `utils.ts` and `handlers.ts` import
// each other, and only the importer that enters the cycle first gets the mock.
import { getHandler, type HandlerName } from "../../src/handlers/utils.ts";
import {
  createIPX,
  createIPXFetchHandler,
  ipxFSStorage,
} from "../../src/index.ts";

// The bundler turns `import * as Handlers` into a plain object that inherits
// from `Object.prototype`, unlike the null-prototype module namespace vitest
// gives us. Mirror the bundled shape so these tests catch the regression.
vi.mock("../../src/handlers/handlers.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  __mockMarker: {},
}));

const prototypeKeys = [
  "constructor",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "__proto__",
] as unknown as HandlerName[];

describe("getHandler", () => {
  it("sees the mocked handlers", () => {
    // Otherwise the tests below pass vacuously.
    expect(getHandler("__mockMarker" as HandlerName)).toBeDefined();
  });

  it("resolves own handlers", () => {
    expect(getHandler("width")).toBeTypeOf("object");
  });

  it.each(prototypeKeys)(
    "does not resolve `%s` from Object.prototype",
    (key) => {
      expect(getHandler(key)).toBeUndefined();
    },
  );

  it.each(prototypeKeys)("ignores a `%s` modifier end to end", async (key) => {
    const ipx = createIPX({
      storage: ipxFSStorage({ dir: resolve(__dirname, "../assets") }),
    });
    const res = await createIPXFetchHandler(ipx)(
      `http://localhost/${key}_1/bliss.jpg`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });
});
