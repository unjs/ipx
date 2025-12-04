import { type IPX, createIPXWebHandler } from "../src/index.ts";
import { describe, expect, it } from "vitest";
import { H3Event } from "h3";

describe("server", () => {
  const ipx: IPX = (
    id,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    modifiers = undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    requestOptions = undefined,
  ) => {
    return {
      getSourceMeta: async () => {
        return {
          maxAge: 3600,
          mtime: new Date(),
        };
      },
      process: async () => {
        return {
          data: "data",
          meta: {
            width: 100,
            height: 100,
          },
          format: "jpg",
        };
      },
    };
  };

  describe("createIPXH3Handler", () => {
    it("IPX_MISSING_MODIFIERS", async () => {
      const handler = createIPXH3Handler(ipx);
      const event = {
        path: "",
        node: {
          req: new Request("http://example.com/test"),
          res: new Response(),
        },
        context: {},
      } as unknown as H3Event;

      await expect(handler(event)).resolves.toEqual({
        error: {
          message: "[400] [IPX_MISSING_MODIFIERS] Modifiers are missing: ",
        },
      });
    });

    it("IPX_MISSING_ID", async () => {
      const handler = createIPXH3Handler(ipx);
      const event = {
        path: "/path",
        node: {
          req: new Request("http://example.com/test"),
          res: new Response(),
        },
        context: {},
      } as unknown as H3Event;

      await expect(handler(event)).resolves.toEqual({
        error: {
          message: "[400] [IPX_MISSING_ID] Resource id is missing: /path",
        },
      });
    });

    it("[IPX_ERROR] ipx is not a function", async () => {
      const handler = createIPXH3Handler(ipx);
      const event = {
        path: "/foo/bar/baz",
        node: {
          req: new Request("http://example.com/test"),
          res: new Response(),
        },
        context: {},
      } as unknown as H3Event;

      await expect(handler(event)).resolves.toEqual({
        error: {
          message:
            "[500] [IPX_ERROR] event.node.res.getHeader is not a function",
        },
      });
    });

    it("createIPXH3Handler returns expected value", async () => {
      const handler = createIPXH3Handler(ipx);
      const event = {
        path: "/foo/bar/baz",
        node: {
          req: new Request("http://example.com/test"),
          res: {
            getHeader: (_: string) => {
              return "value";
            },
          },
        },
        context: {},
      } as unknown as H3Event;

      await expect(handler(event)).resolves.toEqual("data");
    });
  });

  describe("createIPXH3App", () => {
    it("createIPXH3App returns expected value", () => {
      const actual = createIPXH3App(ipx);
      expect(actual.options.debug).toBe(true);
    });
  });
});
