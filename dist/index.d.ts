import { IncomingMessage, ServerResponse } from 'http';

interface SourceData {
    mtime?: Date;
    maxAge?: number;
    getData: () => Promise<Buffer>;
}
declare type Source = (src: string, reqOptions?: any) => Promise<SourceData>;
declare type SourceFactory = (options?: any) => Source;

interface ImageMeta {
    width: number;
    height: number;
    type: string;
    mimeType: string;
}
interface IPXCTX {
    sources: Record<string, Source>;
}
declare type IPX = (id: string, modifiers?: Record<string, string>, reqOptions?: any) => {
    src: () => Promise<SourceData>;
    data: () => Promise<{
        data: Buffer;
        meta: ImageMeta;
        format: string;
    }>;
};
interface IPXOptions {
    dir?: false | string;
    domains?: false | string[];
    alias: Record<string, string>;
    sharp?: {
        [key: string]: any;
    };
}
declare function createIPX(userOptions: Partial<IPXOptions>): IPX;

interface IPXHRequest {
    url: string;
    headers?: Record<string, string>;
    options?: any;
}
interface IPXHResponse {
    statusCode: number;
    statusMessage: string;
    headers: Record<string, string>;
    body: any;
}
declare function handleRequest(req: IPXHRequest, ipx: IPX): Promise<IPXHResponse>;
declare function createIPXMiddleware(ipx: IPX): (req: IncomingMessage, res: ServerResponse) => void;

export { IPX, IPXCTX, IPXHRequest, IPXHResponse, IPXOptions, ImageMeta, Source, SourceData, SourceFactory, createIPX, createIPXMiddleware, handleRequest };
