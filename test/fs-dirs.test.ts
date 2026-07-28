import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, copyFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type IPX, createIPX, ipxFSStorage } from "../src/index.ts";

describe("ipx: fs with multiple dirs", () => {
  let ipx: IPX;

  beforeAll(() => {
    ipx = createIPX({
      storage: ipxFSStorage({
        dir: ["assets", "assets2"].map((d) =>
          fileURLToPath(new URL(d, import.meta.url)),
        ),
      }),
    });
  });

  it("local file: 1st layer", async () => {
    const source = await ipx("giphy.gif");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("gif");
  });

  it("local file: 2nd layer", async () => {
    const source = await ipx("unjs.jpg");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
  });

  it("local file: priority", async () => {
    const source = await ipx("bliss.jpg");
    const { data, format, meta } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
    expect(meta?.height).toBe(2160);
  });

  it("error: not found", async () => {
    const source = await ipx("unknown.png");
    await expect(() => source.process()).rejects.toThrowError(
      "File not found: /unknown.png",
    );
  });

  it("error: forbidden path", async () => {
    const source = await ipx("*.png");
    await expect(() => source.process()).rejects.toThrowError(
      "Forbidden path: /*.png",
    );
  });
});

describe("isolation", () => {
  it("should not be able to access files outside the specified directories", async () => {
    const ipx = createIPX({
      storage: ipxFSStorage({
        dir: fileURLToPath(new URL("assets", import.meta.url)),
      }),
    });
    const source = await ipx("../assets2/bliss.jpg"); // access file outside ./public dir because of same prefix folder
    await expect(source.process()).rejects.toThrowError("Forbidden path");
  });
});

describe("symlinks", () => {
  const assetsDir = fileURLToPath(new URL("assets", import.meta.url));

  // Symlinks are created at runtime instead of being committed as fixtures: git does not
  // carry them portably (and they would be broken on a checkout without symlink support).
  let servedDir: string;
  let outsideDir: string;

  beforeAll(async () => {
    servedDir = await mkdtemp(join(tmpdir(), "ipx-served-"));
    outsideDir = await mkdtemp(join(tmpdir(), "ipx-outside-"));

    await copyFile(
      join(assetsDir, "bliss.jpg"),
      join(outsideDir, "secret.jpg"),
    );
    await copyFile(join(assetsDir, "giphy.gif"), join(servedDir, "inside.gif"));

    // Escaping symlinks planted inside the served dir
    await symlink(
      join(outsideDir, "secret.jpg"),
      join(servedDir, "escape.jpg"),
    );
    await symlink(outsideDir, join(servedDir, "escapedir"));
    await symlink(
      join(outsideDir, "missing.jpg"),
      join(servedDir, "broken.jpg"),
    );

    // Symlink that stays inside the served dir
    await mkdir(join(servedDir, "sub"));
    await copyFile(
      join(assetsDir, "bliss.jpg"),
      join(servedDir, "sub/real.jpg"),
    );
    await symlink(
      join(servedDir, "sub/real.jpg"),
      join(servedDir, "local.jpg"),
    );
  });

  afterAll(async () => {
    await rm(servedDir, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  });

  const createFSIPX = (allowSymlinksOutsideDir?: boolean, dir?: string[]) =>
    createIPX({
      storage: ipxFSStorage({
        dir: dir ?? [servedDir],
        allowSymlinksOutsideDir,
      }),
    });

  it("rejects a symlinked file resolving outside the dir", async () => {
    const source = await createFSIPX()("escape.jpg");
    await expect(source.process()).rejects.toThrowError(
      "Forbidden symlink: /escape.jpg",
    );
  });

  it("rejects a file under a symlinked directory resolving outside the dir", async () => {
    const source = await createFSIPX()("escapedir/secret.jpg");
    await expect(source.process()).rejects.toThrowError(
      "Forbidden symlink: /escapedir/secret.jpg",
    );
  });

  it("serves a symlink that stays inside the dir", async () => {
    const source = await createFSIPX()("local.jpg");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
  });

  it("serves an escaping symlink with `allowSymlinksOutsideDir`", async () => {
    const source = await createFSIPX(true)("escape.jpg");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
  });

  it("reports a broken symlink as not found", async () => {
    const source = await createFSIPX()("broken.jpg");
    await expect(source.process()).rejects.toThrowError(
      "File not found: /broken.jpg",
    );
  });

  it("still falls through to the next dir for a missing file", async () => {
    const source = await createFSIPX(undefined, [servedDir, assetsDir])(
      "bliss.jpg",
    );
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
  });

  it("still rejects lexical traversal", async () => {
    const source = await createFSIPX()("../etc/passwd");
    await expect(source.process()).rejects.toThrowError(
      "Forbidden path: /../etc/passwd",
    );
  });
});
