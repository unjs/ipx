import { Stats } from 'fs-extra'
import BaseCacheAdapter from './cache/BaseCacheAdapter'
import BaseInputAdapter from './input/BaseInputAdapter'
import IPX from './ipx'

export type IPXOperationHandler = (context: any, pipe: any, ...args:any[]) => any

export interface IPXOperations {
    [key: string]: IPXOperation;
}

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
}

export interface IPXImage {
    format: string;
    operations: string;
    src: string;
    adapter: string;
}
export interface IPXImageInfo{
    cacheKey: string;
    stats: Stats | false;
    operations: IPXParsedOperation[];
    format: string;
    src: string;
    adapter: string;
}

export interface IPXAdapterOptions {
    name: string;
    [key: string]: any;
}
