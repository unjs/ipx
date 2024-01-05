import { resolve, parse, join } from "pathe";
import { createError } from "h3";
import { cachedPromise, getEnv } from "../utils";
import type { IPXStorage } from "../types";

export type NodeFSSOptions = {
  dir?: string | string[];
  maxAge?: number;
};

function resolveDirs(options: NodeFSSOptions) {
  if (!options.dir || !Array.isArray(options.dir)) {
    const dir = resolve(options.dir || getEnv("IPX_FS_DIR") || ".");
    return [dir];
  }

  return options.dir.map((dir) => {
    return resolve(dir);
  });
}

export function ipxFSStorage(_options: NodeFSSOptions = {}): IPXStorage {
  const dirs = resolveDirs(_options);
  const maxAge = _options.maxAge || getEnv("IPX_FS_MAX_AGE");

  const _getFS = cachedPromise(() => import("node:fs/promises"));

  const resolveFile = async (id: string) => {
    const errors = new Set<string>();

    for (const dir of dirs) {
      const filePath = join(dir, id);

      if (!isValidPath(filePath) || !filePath.startsWith(dir)) {
        errors.add("IPX_FORBIDDEN_PATH");
      }

      try {
        const fs = await _getFS();
        const stats = await fs.stat(filePath);
        return { stats, filePath };
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          errors.add("IPX_FORBIDDEN_FILE");
        }
      }
    }

    if (errors.has("IPX_FORBIDDEN_PATH")) {
      throw createError({
        statusCode: 403,
        statusText: `IPX_FORBIDDEN_PATH`,
        message: `Forbidden path: ${id}`,
      });
    }

    if (errors.has("IPX_FORBIDDEN_FILE")) {
      throw createError({
        statusCode: 403,
        statusText: `IPX_FORBIDDEN_FILE`,
        message: `File access forbidden: ${id}`,
      });
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
