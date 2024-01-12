import { resolve, parse, join } from "pathe";
import { createError } from "h3";
import { cachedPromise, getEnv } from "../utils";
import type { IPXStorage } from "../types";

export type NodeFSSOptions = {
  dir?: string | string[];
  maxAge?: number;
};

export function ipxFSStorage(_options: NodeFSSOptions = {}): IPXStorage {
  const dirs = resolveDirs(_options.dir);
  const maxAge = _options.maxAge || getEnv("IPX_FS_MAX_AGE");

  const _getFS = cachedPromise(() =>
    import("node:fs/promises").catch(() => {
      throw createError({
        statusCode: 500,
        statusText: `IPX_FILESYSTEM_ERROR`,
        message: `Failed to resolve filesystem module`,
      });
    }),
  );

  const resolveFile = async (id: string) => {
    const fs = await _getFS();

    for (const dir of dirs) {
      const filePath = join(dir, id);

      if (!isValidPath(filePath) || !filePath.startsWith(dir)) {
        throw createError({
          statusCode: 403,
          statusText: `IPX_FORBIDDEN_PATH`,
          message: `Forbidden path: ${id}`,
        });
      }

      try {
        const stats = await fs.stat(filePath);
        return { stats, filePath };
      } catch (error: any) {
        if (error.code === "ENOENT") {
          continue; // Keep looking in other dirs
        }
        throw createError({
          statusCode: 403,
          statusText: `IPX_FORBIDDEN_FILE`,
          message: `Cannot acess file: ${id}`,
        });
      }
    }

    throw createError({
      statusCode: 404,
      statusText: `IPX_FILE_NOT_FOUND`,
      message: `File not found: ${id}`,
    });
  };

  return {
    name: "ipx:node-fs",
    async getMeta(id) {
      const { stats } = await resolveFile(id);

      if (!stats.isFile()) {
        throw createError({
          statusCode: 400,
          statusText: `IPX_INVALID_FILE`,
          message: `Path should be a file: ${id}`,
        });
      }

      return {
        mtime: stats.mtime,
        maxAge,
      };
    },
    async getData(id) {
      const { filePath } = await resolveFile(id);
      const fs = await _getFS();
      return fs.readFile(filePath);
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

function resolveDirs(dirs?: string | string[]) {
  if (!dirs || !Array.isArray(dirs)) {
    const dir = resolve(dirs || getEnv("IPX_FS_DIR") || ".");
    return [dir];
  }
  return dirs.map((dirs) => resolve(dirs));
}
