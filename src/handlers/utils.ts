import destr from 'destr'

export function VArg (arg: string) {
  return destr(arg)
}

export function parseArgs (args: string, mappers: Function[]) {
  const vargs = args.split('_')
  return mappers.map((v, i) => v(vargs[i]))
}
