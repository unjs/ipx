import type { Sharp, Color, KernelEnum } from "sharp";

// TODO: Move to image-meta
export interface ImageMeta {
  width: number;
  height: number;
  type: string;
  mimeType: string;
}

export interface SourceData {
  mtime?: Date;
  maxAge?: number;
  getData: () => Promise<Buffer>;
}

export type Source = (
  source: string,
  requestOptions?: any,
) => Promise<SourceData>;

export type SourceFactory<T = Record<string, any>> = (options: T) => Source;

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
