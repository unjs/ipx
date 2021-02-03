import Sharp from 'sharp'
import defu from 'defu'
import type { Source, SourceData } from './types'
import { createFilesystemSource, createHTTPSource } from './source'
import { applyHandler } from './handler'
import { cachedPromise, getEnv, createError } from './utils'

export interface IPXInputOptions {
  source?: string
  modifiers?: Record<string, string>
}

export interface IPXCTX {
  sources: Record<string, Source>
}

export type IPX = (id: string, opts?: IPXInputOptions) => {
  meta: () => Promise<SourceData>,
  data: () => Promise<Buffer>
}

export interface IPXOptions {
  dir: false | string
  domains: false | string[]
  // TODO: Create types
  // https://github.com/lovell/sharp/blob/master/lib/constructor.js#L130
  sharp: { [key: string]: any }
}

export function createIPX (userOptions: Partial<IPXOptions>): IPX {
  const defaults = {
    dir: getEnv('IPX_DIR', '.'),
    domains: getEnv('IPX_DOMAINS', []),
    sharp: {}
  }
  const options: IPXOptions = defu(userOptions, defaults) as IPXOptions

  const ctx: IPXCTX = {
    sources: {}
  }

  // Init sources
  if (options.dir) {
    ctx.sources.filesystem = createFilesystemSource({
      dir: options.dir
    })
  }
  if (options.domains) {
    ctx.sources.http = createHTTPSource({
      domains: options.domains
    })
  }

  return function ipx (id, inputOpts: IPXInputOptions = {}) {
    if (!id) {
      throw createError('resource id is missing', 400)
    }

    const meta = cachedPromise(() => {
      const source = inputOpts.source || id.startsWith('http') ? 'http' : 'filesystem'
      if (!ctx.sources[source]) {
        throw createError('Unknown source: ' + source, 400)
      }
      return ctx.sources[source](id)
    })

    const data = async () => {
      const src = await meta()
      const data = await src.getData()

      if (!inputOpts.modifiers || Object.values(inputOpts.modifiers).length === 0) {
        return data
      }

      let sharp = Sharp(data)
      Object.assign((sharp as any).options, options.sharp)

      const modifierCtx: any = {}
      for (const key in inputOpts.modifiers) {
        sharp = applyHandler(modifierCtx, sharp, key, inputOpts.modifiers[key]) || sharp
      }
      return sharp.toBuffer()
    }

    return {
      meta,
      data
    }
  }
}
