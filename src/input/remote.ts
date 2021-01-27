import http from 'http'
import https from 'https'
import { stat, Stats } from 'fs-extra'
import fetch from 'node-fetch'
import { allowList, Matcher } from 'allowlist'
import BaseInputAdapter from './BaseInputAdapter'

export default class RemoteAdapter extends BaseInputAdapter {
  httpsAgent?: https.Agent = undefined
  httpAgent?: http.Agent = undefined

  isAcceptedSource?: Matcher<string>
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
    this.isAcceptedSource = allowList<string>(this.options.accept)
  }

  getAgent (src: string) {
    return src.startsWith('https') ? this.httpsAgent : this.httpAgent
  }

  async _retrieve (src: string) {
    const cache = await this.ipx.cache?.get(src)
    if (cache) {
      return {
        cache: await this.ipx.cache?.resolve(src),
        buffer: cache
      }
    }
    const response = await fetch(src, {
      agent: this.getAgent(src)
    })
    const buffer = await response.buffer()

    if (this.ipx.cache) {
      await this.ipx.cache.set(src, buffer)
    }

    return {
      cache: await this.ipx.cache?.resolve(src),
      buffer
    }
  }

  accept (src: string) {
    if (!src.startsWith('http')) {
      return false
    }
    if (!this.isAcceptedSource(src)) {
      return false
    }
    return true
  }

  async stats (src: string): Promise<Stats | false> {
    if (!this.accept(src)) {
      return false
    }
    const _src = await this._retrieve(src)

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
    return (await this._retrieve(src)).buffer
  }
};
