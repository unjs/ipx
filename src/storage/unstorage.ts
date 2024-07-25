import type { Storage, Driver } from "unstorage";
import { createError } from "h3";
import type { IPXStorage, IPXStorageMeta } from "../types";

export type UnstorageIPXStorageOptions = {
  /**
   * Optional prefix to be placed in front of each storage key, which can help to name or categorise stored items.
   * @optional
   */
  prefix?: string;
};

/**
 * Adapts an Unstorage driver or storage system to comply with the IPXStorage interface required by IPX.
 * This allows various Unstorage-compatible storage systems to be used to manage image data with IPX.
 *
 * @param {Storage | Driver} storage - The Unstorage driver or storage instance to adapt. See {@link Storage} and {@link Driver}.
 * @param {UnstorageIPXStorageOptions | string} [_options={}] - Configuration options for the adapter, which can be a simple string prefix or an options object. See {@link UnstorageIPXStorageOptions}.
 * @returns {IPXStorage}. An IPXStorage compliant object that implements the necessary methods to interact with the provided unstorage driver or storage system. See {@link IPXStorage}.
 * @throws {H3Error} If there is a problem retrieving or converting the storage data, detailed error information is thrown. See {@link H3Error}.
 */
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
          cause: error,
        });
      }
    },
  };
}
