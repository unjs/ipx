import type { Sharp, Color, Metadata } from "sharp";

export interface SourceData {
  mtime?: Date
  maxAge?: number
  getData: () => Promise<Buffer>
}

export type ImageMeta = Omit<Metadata, "format" | "width" | "height"> & { format: string, width: number, height: number }

export type Source = (source: string) => Promise<SourceData>

export type SourceFactory<T=Record<string, any>> = (options: T) => Source

export interface Context {
  quality?: number
  fit?: "contain" | "cover" | "fill" | "inside" | "outside"
  position?: number | string
  background?: Color
  enlarge?: boolean
  meta: ImageMeta
}

export interface Handler {
  args: ((argument: string) => any)[]
  order?: number
  apply: (context: Context, pipe: Sharp, ...arguments_: any[]) => any
}
