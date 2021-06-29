export interface SourceData {
  mtime?: Date
  maxAge?: number
  getData: () => Promise<Buffer>
}

export type Source = (src: string) => Promise<SourceData>

export type SourceFactory = (options?: any) => Source

export interface Handler {
  args: Function[]
  order?: Number
  apply: (context: any, pipe: any, ...args: any[]) => any
}
