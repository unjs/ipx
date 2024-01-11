import type { Storage, Driver } from "unstorage";
import { createError } from "h3";
import type { IPXStorage, IPXStorageMeta } from "../types";

export type UnstorageIPXStorageOptions = {
  prefix?: string;
};

export function unstorageToIPXStorage(
  storage: Storage | Driver,
  _options: UnstorageIPXStorageOptions | string = {},
): IPXStorage {
  const options =
    typeof _options === "string" ? { prefix: _options } : _options;

  const resolveKey = (id: string) =>
    options.prefix ? `${options.prefix}:${id}` : id;

  return {
    name: "ipx:" + ((storage as any).name || "unstorage"),
    async getMeta(id, opts = {}) {
      if (!storage.getMeta) {
        return;
      }
      const storageKey = resolveKey(id);
      const meta = await storage.getMeta(storageKey, opts);
      return meta as IPXStorageMeta;
    },
    async getData(id, opts = {}) {
      if (!storage.getItemRaw) {
        return;
      }
      const storageKey = resolveKey(id);

      // Known possible data types: ArrayBuffer, Buffer, String, Blob
      let data = await storage.getItemRaw(storageKey, opts);

      if (!data) {
        // File not found, do not attempt to parse
        return;
      }

      if (data instanceof Blob) {
        data = await data.arrayBuffer();
      }

      try {
        // IPX requires a Buffer, attempt parse and normalize error
        return Buffer.from(data as ArrayBuffer);
      } catch (error: any) {
        throw createError({
          statusCode: 500,
          statusText: `IPX_STORAGE_ERROR`,
          message: `Failed to parse storage data to Buffer:\n${error.message}`,
        });
      }
    },
  };
}
