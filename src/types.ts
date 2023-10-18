import type { ImageMeta } from "image-meta";
import type { Sharp, Color, KernelEnum } from "sharp";

// ---- Handlers ----

export interface HandlerContext {
  quality?: number;
  fit?: "contain" | "cover" | "fill" | "inside" | "outside";
  position?: number | string;
  background?: Color;
  enlarge?: boolean;
  kernel?: keyof KernelEnum;
  meta: ImageMeta;
}

export interface Handler {
  args: ((argument: string) => any)[];
  order?: number;
  apply: (context: HandlerContext, pipe: Sharp, ...arguments_: any[]) => any;
}

// ---- Storage ----

export type IPXStorageMeta = {
  mtime?: Date | number | string;
  maxAge?: number | string;
};

export type IPXStorageOptions = Record<string, unknown>;

type MaybePromise<T> = T | Promise<T>;

export interface IPXStorage {
  name: string;

  getMeta: (
    id: string,
    opts?: IPXStorageOptions,
  ) => MaybePromise<IPXStorageMeta | undefined>;

  getData: (
    id: string,
    opts?: IPXStorageOptions,
  ) => MaybePromise<ArrayBuffer | undefined>;
}
