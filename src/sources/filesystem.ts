import { promises as fsp, Stats } from 'fs'
import { resolve, join } from 'pathe'
import { createError, cachedPromise } from '../utils'
import type { SourceFactory } from '../types'

export interface FilesystemSourceOptions {
  dir: string
  maxAge?: number
}

export const createFilesystemSource: SourceFactory<FilesystemSourceOptions> = (options) => {
  const rootDir = resolve(options.dir)

  return async (id: string) => {
    const fsPath = resolve(join(rootDir, id))
    if (!isValidPath(fsPath) || !fsPath.startsWith(rootDir)) {
      throw createError('Forbidden path', 403, id)
    }

    let stats: Stats
    try {
      stats = await fsp.stat(fsPath)
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw createError('File not found', 404, fsPath)
      } else {
        throw createError('File access error ' + err.code, 403, fsPath)
      }
    }
    if (!stats.isFile()) {
      throw createError('Path should be a file', 400, fsPath)
    }

    return {
      mtime: stats.mtime,
      maxAge: options.maxAge,
      getData: cachedPromise(() => fsp.readFile(fsPath))
    }
  }
}

function isValidPath (fp: string) {
  // Invalid windows path chars
  // https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file?redirectedfrom=MSDN#Naming_Conventions
  if (/[<>:"|?*]/.test(fp)) {
    return false
  }
  return true
}
