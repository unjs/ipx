import type { Storage, Driver } from "unstorage";
import type { IPXStorage, IPXStorageMeta } from "../types";

export function unstorageToIPXStorage(
  storage: Storage | Driver,
  prefix: string,
): IPXStorage {
  const resolveKey = (id: string) => prefix + ":" + id;
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
      const data = await storage.getItemRaw(storageKey, opts);
      // TODO: Convert Buffer to ArrayBuffer
      return data as ArrayBuffer;
    },
  };
}
