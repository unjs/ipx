export interface SourceData {
  mtime?: Date
  maxAge?: number
  getData: () => Promise<Buffer>
}

export type Source = (src: string, reqOptions?: any) => Promise<SourceData>

export type SourceFactory<T=Record<string, any>> = (options: T) => Source

export interface Handler {
  args: Function[]
  order?: Number
  apply: (context: any, pipe: any, ...args: any[]) => any
}
