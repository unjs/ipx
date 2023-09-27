import type { Stats } from "node:fs";
import { resolve, parse, join } from "pathe";
import { createError } from "h3";
import { cachedPromise, getEnv } from "../utils";
import type { IPXStorage } from "../types";

export type NodeFSSOptions = {
  dir?: string;
  maxAge?: number;
};

export function ipxFSStorage(_options: NodeFSSOptions = {}): IPXStorage {
  const rootDir = resolve(_options.dir || getEnv("IPX_FS_DIR") || ".");
  const maxAge = _options.maxAge || getEnv("IPX_FS_MAX_AGE");

  const _resolve = (id: string) => {
    const resolved = join(rootDir, id);
    if (!isValidPath(resolved) || !resolved.startsWith(rootDir)) {
      throw createError({
        statusCode: 403,
        message: `Forbidden path: ${id}`,
      });
    }
    return resolved;
  };

  const _getFS = cachedPromise(() => import("node:fs/promises"));

  return {
    name: "ipx:node-fs",
    async getMeta(id) {
      const fsPath = _resolve(id);

      let stats: Stats;
      try {
        const fs = await _getFS();
        stats = await fs.stat(fsPath);
      } catch (error: any) {
        throw error.code === "ENOENT"
          ? createError({
              statusCode: 404,
              message: `File not found: ${id}`,
            })
          : createError({
              statusCode: 403,
              message: `File access error: (${error.code}) ${id}`,
            });
      }
      if (!stats.isFile()) {
        throw createError({
          statusCode: 400,
          message: `Path should be a file: ${id}`,
        });
      }

      return {
        mtime: stats.mtime,
        maxAge,
      };
    },
    async getData(id) {
      const fsPath = _resolve(id);
      const fs = await _getFS();
      const contents = await fs.readFile(fsPath);
      return contents;
    },
  };
}

const isWindows = process.platform === "win32";

function isValidPath(fp: string) {
  // Invalid windows path chars
  // https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file?redirectedfrom=MSDN#Naming_Conventions
  if (isWindows) {
    // Remove C:/ as next we are validating :
    fp = fp.slice(parse(fp).root.length);
  }
  if (/["*:<>?|]/.test(fp)) {
    return false;
  }
  return true;
}
