import { Sharp, Color, SharpOptions } from 'sharp';
import { IncomingMessage, ServerResponse } from 'node:http';

interface ImageMeta {
    width: number;
    height: number;
    type: string;
    mimeType: string;
}
interface SourceData {
    mtime?: Date;
    maxAge?: number;
    getData: () => Promise<Buffer>;
}
type Source = (source: string, requestOptions?: any) => Promise<SourceData>;
type SourceFactory<T = Record<string, any>> = (options: T) => Source;
interface HandlerContext {
    quality?: number;
    fit?: "contain" | "cover" | "fill" | "inside" | "outside";
    position?: number | string;
    background?: Color;
    enlarge?: boolean;
    meta: ImageMeta;
}
interface Handler {
    args: ((argument: string) => any)[];
    order?: number;
    apply: (context: HandlerContext, pipe: Sharp, ...arguments_: any[]) => any;
}

declare const quality: Handler;
declare const fit: Handler;
declare const position: Handler;
declare const background: Handler;
declare const enlarge: Handler;
declare const width: Handler;
declare const height: Handler;
declare const resize: Handler;
declare const trim: Handler;
declare const extend: Handler;
declare const extract: Handler;
declare const rotate: Handler;
declare const flip: Handler;
declare const flop: Handler;
declare const sharpen: Handler;
declare const median: Handler;
declare const blur: Handler;
declare const flatten: Handler;
declare const gamma: Handler;
declare const negate: Handler;
declare const normalize: Handler;
declare const threshold: Handler;
declare const modulate: Handler;
declare const tint: Handler;
declare const grayscale: Handler;
declare const crop: Handler;
declare const q: Handler;
declare const b: Handler;
declare const w: Handler;
declare const h: Handler;
declare const s: Handler;
declare const pos: Handler;

declare const Handlers_b: typeof b;
declare const Handlers_background: typeof background;
declare const Handlers_blur: typeof blur;
declare const Handlers_crop: typeof crop;
declare const Handlers_enlarge: typeof enlarge;
declare const Handlers_extend: typeof extend;
declare const Handlers_extract: typeof extract;
declare const Handlers_fit: typeof fit;
declare const Handlers_flatten: typeof flatten;
declare const Handlers_flip: typeof flip;
declare const Handlers_flop: typeof flop;
declare const Handlers_gamma: typeof gamma;
declare const Handlers_grayscale: typeof grayscale;
declare const Handlers_h: typeof h;
declare const Handlers_height: typeof height;
declare const Handlers_median: typeof median;
declare const Handlers_modulate: typeof modulate;
declare const Handlers_negate: typeof negate;
declare const Handlers_normalize: typeof normalize;
declare const Handlers_pos: typeof pos;
declare const Handlers_position: typeof position;
declare const Handlers_q: typeof q;
declare const Handlers_quality: typeof quality;
declare const Handlers_resize: typeof resize;
declare const Handlers_rotate: typeof rotate;
declare const Handlers_s: typeof s;
declare const Handlers_sharpen: typeof sharpen;
declare const Handlers_threshold: typeof threshold;
declare const Handlers_tint: typeof tint;
declare const Handlers_trim: typeof trim;
declare const Handlers_w: typeof w;
declare const Handlers_width: typeof width;
declare namespace Handlers {
  export {
    Handlers_b as b,
    Handlers_background as background,
    Handlers_blur as blur,
    Handlers_crop as crop,
    Handlers_enlarge as enlarge,
    Handlers_extend as extend,
    Handlers_extract as extract,
    Handlers_fit as fit,
    Handlers_flatten as flatten,
    Handlers_flip as flip,
    Handlers_flop as flop,
    Handlers_gamma as gamma,
    Handlers_grayscale as grayscale,
    Handlers_h as h,
    Handlers_height as height,
    Handlers_median as median,
    Handlers_modulate as modulate,
    Handlers_negate as negate,
    Handlers_normalize as normalize,
    Handlers_pos as pos,
    Handlers_position as position,
    Handlers_q as q,
    Handlers_quality as quality,
    Handlers_resize as resize,
    Handlers_rotate as rotate,
    Handlers_s as s,
    Handlers_sharpen as sharpen,
    Handlers_threshold as threshold,
    Handlers_tint as tint,
    Handlers_trim as trim,
    Handlers_w as w,
    Handlers_width as width,
  };
}

type HandlerName = keyof typeof Handlers;

interface IPXCTX {
    sources: Record<string, Source>;
}
type IPX = (id: string, modifiers?: Partial<Record<HandlerName | "f" | "format" | "a" | "animated", string>>, requestOptions?: any) => {
    src: () => Promise<SourceData>;
    data: () => Promise<{
        data: Buffer;
        meta: ImageMeta;
        format: string;
    }>;
};
interface IPXOptions {
    dir?: false | string;
    maxAge?: number;
    domains?: false | string[];
    alias: Record<string, string>;
    fetchOptions: RequestInit;
    sharp?: SharpOptions;
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
    error?: any;
}
interface MiddlewareOptions {
    fallthrough?: boolean;
}
declare function handleRequest(request: IPXHRequest, ipx: IPX): Promise<IPXHResponse>;
declare function createIPXMiddleware(ipx: IPX, options?: Partial<MiddlewareOptions>): (request: IncomingMessage, res: ServerResponse, next?: ((err?: any) => void) | undefined) => Promise<void>;

export { IPX, IPXCTX, IPXHRequest, IPXHResponse, IPXOptions, MiddlewareOptions, Source, SourceData, SourceFactory, createIPX, createIPXMiddleware, handleRequest };
