import { Stats } from 'fs-extra'
import BaseCacheAdapter from './cache/BaseCacheAdapter' /* TODO */
import BaseInputAdapter from './input/BaseInputAdapter' /* TODO */
import IPX from './ipx' /* TODO */

export type IPXOperationHandler = (context: any, pipe: any, ...args: any[]) => any

export interface IPXOperation {
  key?: string;
  name: string;
  handler: IPXOperationHandler;
  multiply?: boolean;
  order?: boolean;
  args: Array<any>;
}
export interface IPXParsedOperation {
  operation: IPXOperation;
  args: string[]
  cacheKey?: string;
}

export interface IPXOperations {
  [key: string]: IPXOperation;
}

export interface IPXInputOption {
  name: string;
  adapter: string | { new(ipx: IPX): BaseInputAdapter };
  [key: string]: any;
}

export interface IPXOptions {
  port: number;
  inputs: IPXInputOption[],
  cache: {
    adapter: string | { new(ipx: IPX): BaseCacheAdapter };
    dir: string;
    cleanCron: string;
    maxUnusedMinutes: number | string;
  },
  operations?: IPXOperations
  sharp?: {
    [key: string]: any;
  }
}

export interface IPXImage {
  format: string;
  operations: string;
  src: string;
  adapter: string;
}
export interface IPXImageInfo {
  cacheKey: string;
  stats: Stats | false;
  operations: IPXParsedOperation[];
  format: string;
  mimeType: string;
  src: string;
  adapter: string;
}

export interface IPXAdapterOptions {
  name: string;
  [key: string]: any;
}
