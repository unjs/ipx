export interface SourceData {
  mtime?: Date;
  maxAge?: number;
  getData: () => Promise<Buffer>;
}

export type Source = (
  source: string,
  requestOptions?: any
) => Promise<SourceData>;

export type SourceFactory<T = Record<string, any>> = (options: T) => Source;

export interface Handler {
  args: ((...args: any[]) => any)[];
  order?: number;
  apply: (context: any, pipe: any, ...arguments_: any[]) => any;
}
