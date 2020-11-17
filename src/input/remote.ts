import http from 'http'
import https from 'https'
import { stat, Stats } from 'fs-extra'
import fetch from 'node-fetch'
import BaseInputAdapter from './BaseInputAdapter'

export default class RemoteAdapter extends BaseInputAdapter {
  httpsAgent?: https.Agent = undefined
  httpAgent?: http.Agent = undefined
  init () {
    this.httpsAgent = new https.Agent({
      // keepAliveMsecs: 1000, // default
      // maxSockets: Infinity, // default
      keepAlive: true
    })
    this.httpAgent = new http.Agent({
      // keepAliveMsecs: 1000, // default
      // maxSockets: Infinity, // default
      keepAlive: true
    })
    this.options.accept = this.options.accept || ['.*']
  }

  getAgent (src: string) {
    return src.startsWith('https') ? this.httpsAgent : this.httpAgent
  }

  async _retrive (src: string) {
    const cacheKey = src.split(/[?#]/).shift()?.split('//').pop()!
    const cache = await this.ipx.cache?.get(cacheKey)
    if (cache) {
      return {
        cache: await this.ipx.cache?.resolve(cacheKey),
        buffer: cache
      }
    }
    const response = await fetch(src, {
      agent: this.getAgent(src)
    })
    const buffer = await response.buffer()

    if (this.ipx.cache) {
      await this.ipx.cache.set(cacheKey, buffer)
    }

    return {
      cache: await this.ipx.cache?.resolve(cacheKey),
      buffer
    }
  }

  accept (src: string) {
    if (!src.startsWith('http')) {
      return false
    }
    if (!this.options.accept.some((rule: string) => src.match(rule))) {
      return false
    }
    return true
  }

  async stats (src: string): Promise<Stats | false> {
    if (!this.accept(src)) {
      return false
    }
    const _src = await this._retrive(src)

    try {
      const stats = await stat(_src.cache as string)
      return stats
    } catch (e) {
      // TODO: check for permission errors
      return false
    }
  }

  /**
   * @param {String} src
   * @returns Promise<Buffer>
   */
  async get (src: string) {
    return (await this._retrive(src)).buffer
  }
};
