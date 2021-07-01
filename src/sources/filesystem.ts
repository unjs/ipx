import { resolve, join } from 'path'
import isValidPath from 'is-valid-path'
import { readFile, stat, Stats } from 'fs-extra'
import { createError, cachedPromise } from '../utils'
import type { SourceFactory } from '../types'

export const createFilesystemSource: SourceFactory = (options: any) => {
  const rootDir = resolve(options.dir)

  return async (id: string) => {
    const fsPath = resolve(join(rootDir, id))

    if (!isValidPath(id) || id.includes('..') || !fsPath.startsWith(rootDir)) {
      throw createError('Forbidden path:' + id, 403)
    }

    let stats: Stats
    try {
      stats = await stat(fsPath)
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw createError('File not found: ' + fsPath, 404)
      } else {
        throw createError('File access error for ' + fsPath + ':' + err.code, 403)
      }
    }
    if (!stats.isFile()) {
      throw createError('Path should be a file: ' + fsPath, 400)
    }

    return {
      mtime: stats.mtime,
      maxAge: options.maxAge || 300,
      getData: cachedPromise(() => readFile(fsPath))
    }
  }
}
