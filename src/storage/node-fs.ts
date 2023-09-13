import type { Stats } from "node:fs";
import { resolve, parse, join } from "pathe";
import { cachedPromise, createError } from "../utils";
import type { IPXStorage } from "../types";

export type NodeFSSOptions = {
  dir?: string;
  maxAge?: number;
};

export function ipxFSStorage(_options: NodeFSSOptions): IPXStorage {
  const rootDir = resolve(_options.dir || process.env.IPX_FS_DIR || ".");
  const maxAge = _options.maxAge || process.env.IPX_FS_MAX_AGE;

  const _resolve = (id: string) => {
    const resolved = join(rootDir, id);
    if (!isValidPath(resolved) || !resolved.startsWith(rootDir)) {
      throw createError("Forbidden path", 403, id);
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
      } catch (error_: any) {
        const error =
          error_.code === "ENOENT"
            ? createError("File not found", 404, fsPath)
            : createError("File access error " + error_.code, 403, fsPath);
        throw error;
      }
      if (!stats.isFile()) {
        throw createError("Path should be a file", 400, fsPath);
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
