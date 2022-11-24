// @ts-ignore
import spawn from '@npmcli/promise-spawn'
import dargs from 'dargs'
import fg from 'fast-glob'
import minimist from 'minimist'
import { stat, writeFile } from 'node:fs/promises'
import { cpus } from 'node:os'

type ParaLintArgs = {
  entries: string[]
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

const compatibleFormats = [
  'stylish',
  'compact',
  'json',
] as ParaLintArgs['format'][]

const getExtensions: (extension: ParaLintArgs['extension']) => string = (
  extension,
) => {
  return `.(${(Array.isArray(extension) ? extension : [extension])
    .reduce(
      (extensions, extension) => [...extensions, ...extension.split(',')],
      [] as string[],
    )
    .map((extension) => extension.replace(/^\./, ''))
    .join('|')})`
}

const getFiles: ({
  entries,
  extension,
}: ParaLintArgs) => Promise<string[]> = async ({ entries, extension }) => {
  const patterns = await entries.reduce(async (entries, entry) => {
    return [
      ...(await entries),
      !entry.includes('*') && (await stat(entry)).isDirectory()
        ? `${entry}/**/*${getExtensions(extension)}`
        : entry,
    ]
  }, Promise.resolve([] as string[]))
  return fg(patterns, { onlyFiles: true })
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
    .filter((out) => out)
    .sort()
  if (format === 'json') {
    return `[${outs
      .map((out) => out.substring(1, out.length - 1))
      .filter((out) => out)
      .join(',')}]`
  }
  return outs.join('\n')
}

const getArgs: (args: string[]) => ParaLintArgs = (args) => {
  const {
    _: entries,
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
    help,
    version,
    extension,
    format,
    outputFile,
    concurrency,
    argv,
  }
}

const lint: (args: ParaLintArgs) => Promise<any> = async (args) => {
  const { format, outputFile, concurrency, argv } = args
  const files = await getFiles(args)
  const results = await getResults(
    files,
    Math.min(Math.max(1, concurrency | 0), cpusLength),
    { ...argv, format },
  )
  const formatted = getFormatted(results, format)
  if (outputFile) {
    await writeFile(outputFile, formatted)
  } else if (formatted) {
    console.log(formatted)
  }
  if (results.every(({ status }) => status === 'fulfilled')) {
    return Promise.resolve()
  }
  // eslint-disable-next-line prefer-promise-reject-errors
  return Promise.reject()
}

export const main: (argv: string[]) => Promise<any> = async (argv) => {
  const args = getArgs(argv)
  const { help, version, format } = args
  if (help || version) {
    const res = await spawn('eslint', dargs({ version, help }))
    console.log(res.stdout)
    return Promise.resolve()
  }
  if (!compatibleFormats.includes(format)) {
    console.error(`format ${format} is not supported yet`)
    // eslint-disable-next-line prefer-promise-reject-errors
    return Promise.reject()
  }
  return lint(args)
}
