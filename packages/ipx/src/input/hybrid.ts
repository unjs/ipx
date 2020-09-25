import { Stats } from 'fs-extra'
import BaseInputAdapter from './BaseInputAdapter'
import FSAdapter from './fs'
import RemoteAdapter from './remote'

function isRemote(url: string) {
  return url.startsWith('http');
}

export default class HybridAdapter extends BaseInputAdapter {
  fsAdapter!: FSAdapter
  remoteAdapter!: RemoteAdapter

  init() {
    this.fsAdapter = new FSAdapter(this.ipx)
    this.remoteAdapter = new RemoteAdapter(this.ipx)
  }
  
  async stats (src: string): Promise<Stats | false> {
    if (isRemote(src)) {
      return this.remoteAdapter.stats(src)
    }
    return this.fsAdapter.stats(src)
  }

  /**
   * @param {String} src
   * @returns Promise<Buffer>
   */
  async get (src: string) {
    if (isRemote(src)) {
      return this.remoteAdapter.get(src)
    }
    return this.fsAdapter.get(src)
  }
};
