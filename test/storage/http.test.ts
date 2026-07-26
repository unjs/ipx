import { describe, expect, it } from "vitest";

import { ipxHttpStorage } from "../../src/storage/http.ts";

describe("http", () => {
  describe("getMeta", () => {
    const storage = ipxHttpStorage({});
    const sut = storage.getMeta;
    it("id has no hostname, throw Error ", async () => {
      await expect(sut("file://")).rejects.toThrow(
        "Hostname is missing: file://",
      );
    });
    it("id is not allowed domain, throw Error ", async () => {
      await expect(sut("http://localhost")).rejects.toThrow(
        "Forbidden host: localhost",
      );
    });
  });
});
