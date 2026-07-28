import { HTTPError } from "h3";
import { getEnv } from "../utils.ts";

import type { IPXStorage } from "../types.ts";

/**
 * `node:path` is loaded through `getBuiltinModule` instead of a static import so the bundle
 * stays loadable on runtimes without node builtins. `#__PURE__` lets a bundler drop the call
 * entirely when nothing in this module is used.
 *
 * The platform flavour is used throughout, so paths handed to `node:fs` keep the separators
 * the filesystem actually uses. Nothing below compares separators by hand: {@link isInsideDir}
 * is expressed with `relative()`, which is separator-agnostic.
 */
const { join, parse, resolve, relative, isAbsolute, sep } =
  /* #__PURE__ */ globalThis.process.getBuiltinModule("node:path") || {};

export type NodeFSSOptions = {
  /**
   * The directory or list of directories from which to serve files. If not specified, the current directory is used by default.
   * @optional
   */
  dir?: string | string[];

  /**
   * The directory or list of directories from which to serve files. If not specified, the current directory is used by default.
   * @optional
   */
  maxAge?: number;

  /**
   * If set to true, a symlink inside {@link NodeFSSOptions.dir} may resolve to a file outside
   * of it. By default such files are rejected with `403 IPX_FORBIDDEN_SYMLINK`, since the
   * lexical `../` check alone says nothing about where a path physically ends up.
   *
   * Symlinks that stay inside `dir` are always followed, whatever this is set to.
   *
   * This is **defense in depth**, not a fix for a remotely reachable hole: planting a symlink
   * in the served directory already requires a symlink-create or arbitrary-write primitive
   * there, and the served filesystem is assumed to be trusted. Comparable static file servers
   * (`express.static`, nginx with `disable_symlinks off`) follow symlinks by default too.
   *
   * Enable it for the deployments where symlinking assets into the served directory is
   * deliberate — monorepo `public/` layouts, CI artifact linking, Docker layer tricks.
   * @optional
   * @default false
   */
  allowSymlinksOutsideDir?: boolean;
};

/**
 * Creates a file system storage handler for IPX that allows images to be served from local directories specified in the options.
 * This handler resolves directories and handles file access, ensuring that files are served safely.
 *
 * @param {NodeFSSOptions} [_options={}] - File system storage configuration options, with optional directory paths and caching configuration. See {@link NodeFSSOptions}.
 * @returns {IPXStorage} An implementation of the IPXStorage interface for accessing images stored on the local file system. See {@link IPXStorage}.
 * @throws {H3Error} If there is a problem accessing the file system module or resolving/reading files. See {@link H3Error}.
 */
export function ipxFSStorage(_options: NodeFSSOptions = {}): IPXStorage {
  const dirs = resolveDirs(_options.dir);
  const maxAge = _options.maxAge || getEnv("IPX_FS_MAX_AGE");
  const allowSymlinksOutsideDir =
    _options.allowSymlinksOutsideDir ??
    getEnv<boolean>("IPX_FS_ALLOW_SYMLINKS_OUTSIDE_DIR") ??
    false;

  const fs = globalThis.process.getBuiltinModule("node:fs/promises");

  /**
   * Symlink-free form of each configured dir, cached by index.
   *
   * Cached instead of resolved per request: the served dirs are near-static and `realpath` is
   * a syscall per path segment. A dir that cannot be resolved — it does not exist yet, or is
   * not readable — falls back to its lexical path, which only ever makes the boundary check
   * stricter, never looser: files under it are an `ENOENT` anyway.
   *
   * An entry is dropped and re-resolved before a rejection (see {@link resolveFile}), so a
   * `dir` that is itself a symlink can be repointed at runtime without serving 403s forever.
   */
  const realDirCache: (Promise<string> | undefined)[] = [];
  const getRealDir = (index: number, dir: string) => {
    let realDir = realDirCache[index];
    if (!realDir) {
      realDir = fs.realpath(dir).catch(() => dir);
      realDirCache[index] = realDir;
    }
    return realDir;
  };

  const resolveFile = async (id: string) => {
    for (const [index, dir] of dirs.entries()) {
      const filePath = join(dir, id);
      if (!isValidPath(filePath) || !isInsideDir(filePath, dir)) {
        throw new HTTPError({
          statusCode: 403,
          statusText: `IPX_FORBIDDEN_PATH`,
          message: `Forbidden path: ${id}`,
        });
      }
      let stats: Awaited<ReturnType<typeof fs.stat>>;
      let realPath: string | undefined;
      try {
        stats = await fs.stat(filePath);
        if (stats.isFile() && !allowSymlinksOutsideDir) {
          // The check above is lexical, but `stat`/`readFile` follow symlinks. `realpath`
          // resolves *every* segment, so a symlinked parent directory (`/etcdir/passwd`) is
          // caught as well as a symlinked leaf.
          realPath = await fs.realpath(filePath);
        }
      } catch (error: any) {
        if (error.code === "ENOENT") {
          // Keep looking in other dirs
          // (also covers a broken symlink, which `stat` reports as ENOENT)
          continue;
        }
        throw new HTTPError({
          statusCode: 403,
          statusText: `IPX_FORBIDDEN_FILE`,
          message: `Cannot access file: ${id}`,
        });
      }
      if (!stats.isFile()) {
        // Keep looking in other dirs we are looking for a file!
        continue;
      }
      if (realPath !== undefined) {
        let realDir = await getRealDir(index, dir);
        if (!isInsideDir(realPath, realDir)) {
          // The cached `realDir` can be stale: `dir` itself may be a symlink that was
          // repointed since it was resolved, which is how atomic deploys work
          // (`current -> releases/N`). Drop it and resolve once more before rejecting, so a
          // swap costs one extra `realpath` on the rejection path rather than turning every
          // request into a 403 until the process restarts.
          realDirCache[index] = undefined;
          realDir = await getRealDir(index, dir);
        }
        if (!isInsideDir(realPath, realDir)) {
          throw new HTTPError({
            statusCode: 403,
            statusText: `IPX_FORBIDDEN_SYMLINK`,
            message: `Forbidden symlink: ${id}`,
          });
        }
      }
      return {
        stats,
        // Read the resolved physical path so that swapping the symlink after the check does
        // not change what is read. This narrows the TOCTOU window but does not close it: the
        // file at `realPath` can still be replaced by a symlink between here and the read.
        // Closing it needs an fd opened with `O_NOFOLLOW` on every segment, which the
        // promises API does not expose.
        read: () => fs.readFile(realPath ?? filePath),
      };
    }
    throw new HTTPError({
      statusCode: 404,
      statusText: `IPX_FILE_NOT_FOUND`,
      message: `File not found: ${id}`,
    });
  };

  return {
    name: "ipx:node-fs",
    async getMeta(id) {
      const { stats } = await resolveFile(id);
      return {
        mtime: stats.mtime,
        maxAge,
      };
    },
    async getData(id) {
      const { read } = await resolveFile(id);
      return read();
    },
  };
}

const isWindows = process.platform === "win32";

function isValidPath(fp: string) {
  // Invalid windows path chars
  // https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file?redirectedfrom=MSDN#Naming_Conventions
  if (isWindows) {
    // Remove C:\ as next we are validating :
    fp = fp.slice(parse(fp).root.length);
  }
  if (/["*:<>?|]/.test(fp)) {
    return false;
  }
  return true;
}

/**
 * Whether `filePath` lives strictly below `dir`. Both are expected to be absolute; the
 * realpath call site additionally passes symlink-free paths.
 *
 * Phrased with `relative()` rather than a string prefix so it holds whatever separator the
 * platform uses, and so the near-miss cases fall out of one rule instead of hand-rolled
 * ones: a sibling sharing a prefix (`/srv/public-other` against `/srv/public`) and a
 * different Windows drive both come back as `..`-prefixed or absolute.
 *
 * Compared case-insensitively on Windows because `realpath` returns the on-disk casing
 * there, which does not have to match how the dir was configured.
 */
function isInsideDir(filePath: string, dir: string) {
  if (isWindows) {
    filePath = filePath.toLowerCase();
    dir = dir.toLowerCase();
  }
  const rel = relative(dir, filePath);
  // `rel === ""` is `dir` itself, which is a directory and never a file we may serve.
  // The `..` cases are checked against `sep` so a real file named `..foo` still passes.
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  );
}

function resolveDirs(dirs?: string | string[]) {
  if (!dirs || !Array.isArray(dirs)) {
    const dir = resolve(dirs || getEnv("IPX_FS_DIR") || ".");
    return [dir];
  }
  return dirs.map((dirs) => resolve(dirs));
}
