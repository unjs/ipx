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
}

export interface IPXOptions {
    port: number;
    input: {
        adapter: string | { new(ipx: IPX): BaseInputAdapter };
        dir: string;
    },
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
