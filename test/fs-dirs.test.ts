import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import {
  mkdtemp,
  mkdir,
  copyFile,
  symlink,
  rm,
  writeFile,
} from "node:fs/promises";
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

describe("dir fall-through", () => {
  it("falls through to the next dir when a segment is a file, not a dir", async () => {
    // `stat` reports ENOTDIR here, which means "not in this dir" just as much as ENOENT
    // does: a stray file named `sub` must not shadow a later dir's `sub/` subtree.
    const d1 = await mkdtemp(join(tmpdir(), "ipx-notdir-1-"));
    const d2 = await mkdtemp(join(tmpdir(), "ipx-notdir-2-"));
    try {
      await writeFile(join(d1, "sub"), "not a directory");
      await mkdir(join(d2, "sub"));
      await copyFile(
        fileURLToPath(new URL("assets/bliss.jpg", import.meta.url)),
        join(d2, "sub/bliss.jpg"),
      );
      const storage = ipxFSStorage({ dir: [d1, d2] });
      await expect(storage.getData("/sub/bliss.jpg")).resolves.toBeInstanceOf(
        Buffer,
      );
    } finally {
      await rm(d1, { recursive: true, force: true });
      await rm(d2, { recursive: true, force: true });
    }
  });

  it("reports a symlink cycle as not found", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ipx-loop-"));
    try {
      await symlink(join(dir, "b.jpg"), join(dir, "a.jpg"));
      await symlink(join(dir, "a.jpg"), join(dir, "b.jpg"));
      const storage = ipxFSStorage({ dir });
      await expect(storage.getData("/a.jpg")).rejects.toMatchObject({
        statusCode: 404,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("maxAge", () => {
  it("passes an explicit 0 through instead of falling back to the default", async () => {
    const storage = ipxFSStorage({
      dir: fileURLToPath(new URL("assets", import.meta.url)),
      maxAge: 0,
    });
    await expect(storage.getMeta("/bliss.jpg")).resolves.toMatchObject({
      maxAge: 0,
    });
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

  it("should not be able to reach a sibling dir sharing the served dir's prefix", async () => {
    // `/srv/pub` vs `/srv/pub-other`: a plain `startsWith(dir)` boundary would let this
    // through, so the check has to be separator-aware.
    const root = await mkdtemp(join(tmpdir(), "ipx-prefix-"));
    try {
      await mkdir(join(root, "pub"));
      await mkdir(join(root, "pub-other"));
      await copyFile(
        fileURLToPath(new URL("assets/bliss.jpg", import.meta.url)),
        join(root, "pub-other/secret.jpg"),
      );
      const ipx = createIPX({
        storage: ipxFSStorage({ dir: join(root, "pub") }),
      });
      const source = await ipx("../pub-other/secret.jpg");
      await expect(source.process()).rejects.toThrowError("Forbidden path");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
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

  // A backslash is a legal filename character on POSIX but a separator on Windows.
  it.skipIf(process.platform === "win32")(
    "serves a symlink whose target contains a literal backslash",
    async () => {
      // Regression: normalizing the realpath with a library that rewrites `\` to `/` turned
      // the target into a path that does not exist, so `getMeta` passed and the read blew up
      // with a bare ENOENT (an unhandled 500) instead of serving the file.
      await copyFile(
        join(assetsDir, "bliss.jpg"),
        join(servedDir, String.raw`sub/we\ird.jpg`),
      );
      await symlink(
        join(servedDir, String.raw`sub/we\ird.jpg`),
        join(servedDir, "weird.jpg"),
      );
      const source = await createFSIPX()("weird.jpg");
      const { data, format } = await source.process();
      expect(data).toBeInstanceOf(Buffer);
      expect(format).toBe("jpeg");
    },
  );

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
