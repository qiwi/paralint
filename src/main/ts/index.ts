import spawn from '@npmcli/promise-spawn'
import dargs from 'dargs'
import fg from 'fast-glob'
import minimist from 'minimist'
import { statSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'

type ParaLintArgs = {
  entries: string[]
  ignorePattern: string | string[]
  help: boolean
  version: boolean
  extension: string | string[]
  format: 'stylish' | 'compact' | 'json'
  outputFile: string
  concurrency: number
  argv: Record<string, any>
}

export type ParaLintResult = {
  stdout: string
  stderr: string
}

const cpusLength = cpus().length

const defaultExtension = ['js', 'ts', 'cjs', 'mjs', 'jsx', 'tsx']

const defaultIgnorePattern = ['node_modules']

const compatibleFormats = [
  'stylish',
  'compact',
  'json',
] as ParaLintArgs['format'][]

const isDirectory: (path: string) => boolean = (path) => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

const getExtensions: (extension: ParaLintArgs['extension']) => string = (
  extension,
) => {
  return `.(${(Array.isArray(extension) ? extension : [extension])
    .reduce<string[]>(
      (extensions, extension) => [...extensions, ...extension.split(',')],
      [],
    )
    .map((extension) => extension.replace(/^\./, ''))
    .join('|')})`
}

const getFiles: (args: ParaLintArgs) => string[] = ({
  entries,
  extension,
  ignorePattern,
}) => {
  const extensions = getExtensions(extension)
  const patterns = entries.reduce<string[]>(
    (entries, entry) => [
      ...entries,
      isDirectory(entry) ? `${entry}/**/*${extensions}` : entry,
    ],
    [],
  )
  return fg.sync(patterns, {
    onlyFiles: true,
    ignore: [
      ...defaultIgnorePattern,
      ...(Array.isArray(ignorePattern) ? ignorePattern : [ignorePattern]),
    ],
  })
}

const getResults: (
  files: string[],
  forks: number,
  argv: Record<string, any>,
) => Promise<PromiseSettledResult<Awaited<ParaLintResult>>[]> = async (
  files,
  forks,
  argv,
) => {
  const eslints = []
  const offset = files.length / forks
  for (let f = 0; f < files.length; f += offset) {
    eslints.push(
      spawn('eslint', [...files.slice(f, f + offset), ...dargs(argv)]),
    )
  }
  return Promise.allSettled<ParaLintResult>(eslints)
}

const getFormatted: (
  results: PromiseSettledResult<Awaited<ParaLintResult>>[],
  format: ParaLintArgs['format'],
) => string = (results, format) => {
  const outs = results
    .map((result) =>
      result.status === 'fulfilled'
        ? result.value.stdout
        : result.reason.stdout,
    )
    .filter(Boolean)
    .sort()
  if (format === 'json') {
    return `[${outs
      .map((out) => out.slice(1, -1))
      .filter(Boolean)
      .join(',')}]`
  }
  return outs.join('\n')
}

const getArgs: (args: string[]) => ParaLintArgs = (args) => {
  const {
    _: entries,
    'ignore-pattern': ignorePattern = [],
    h,
    help = h,
    v,
    version = v,
    ext: extension = defaultExtension,
    f = 'stylish',
    format = f,
    o,
    'output-file': outputFile = o,
    concurrency = cpusLength / 2,
    ...argv
  } = minimist(args)
  return {
    entries,
    ignorePattern,
    help,
    version,
    extension,
    format,
    outputFile,
    concurrency,
    argv,
  }
}

const lint: (args: ParaLintArgs) => Promise<void> = async (args) => {
  const { format, outputFile, concurrency, argv } = args
  const files = getFiles(args)
  const results = await getResults(
    files,
    Math.min(Math.max(1, concurrency | 0), cpusLength),
    { ...argv, format },
  )
  const formatted = getFormatted(results, format)
  if (outputFile) {
    writeFileSync(outputFile, formatted)
  } else if (formatted) {
    console.log(formatted)
  }
  if (results.every(({ status }) => status === 'fulfilled')) {
    return
  }

  const err = results.find(({status}) => status === 'rejected') as PromiseRejectedResult
  throw new Error(err?.reason)
}

export const main: (argv: string[]) => Promise<void> = async (argv) => {
  const args = getArgs(argv)
  const { help, version, format } = args
  if (help || version) {
    const res = await spawn('eslint', dargs({ version, help }))
    console.log(res.stdout)
    return
  }
  if (!compatibleFormats.includes(format)) {
    const msg = `format ${format} is not supported yet`
    console.error(msg)
    throw new Error(msg)
  }
  return lint(args)
}
