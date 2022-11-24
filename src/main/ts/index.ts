// @ts-ignore
import spawn from '@npmcli/promise-spawn'
import dargs from 'dargs'
import fg from 'fast-glob'
import minimist from 'minimist'
import { stat, writeFile } from 'node:fs/promises'
import { cpus } from 'node:os'

type ESLintFormat = 'stylish' | 'compact' | 'json'

export type ESLintResult = {
  stdout: string
  stderr: string
}

const getExtensions = (extension: string | string[]) => {
  return `.(${(Array.isArray(extension) ? extension : [extension])
    .reduce(
      (extensions, extension) => [...extensions, ...extension.split(',')],
      [] as string[],
    )
    .map((extension) => extension.replace(/^\./, ''))
    .join('|')})`
}

const getFiles = async ({
  entries,
  extension,
}: {
  entries: string[]
  extension: string | string[]
}) => {
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

const getResults = async (files: string[], forks: number, argv: any) => {
  const eslints = []
  const offset = files.length / forks
  for (let f = 0; f < files.length; f += offset) {
    eslints.push(
      spawn('eslint', [...files.slice(f, f + offset), ...dargs(argv)]),
    )
  }
  return Promise.allSettled<ESLintResult>(eslints)
}

const getFormatted = (
  results: PromiseSettledResult<Awaited<ESLintResult>>[],
  format: ESLintFormat,
) => {
  const outs = results
    .map((result) =>
      result.status === 'fulfilled'
        ? result.value.stdout
        : result.reason.stdout,
    )
    .filter((result) => result)
    .sort()
  if (format === 'json') {
    return `[${outs
      .map((out) => out.substring(1, out.length - 1))
      .filter((out) => out)
      .join(',')}]`
  }
  return outs.join('\n')
}

export const main = async (args: string[]) => {
  const {
    _: entries,
    ext: extension = ['js', 'ts', 'cjs', 'mjs', 'jsx', 'tsx'],
    'output-file': outputFile,
    o,
    help,
    h,
    version,
    v,
    format: outputFormat,
    f,
    concurrency = 4,
    ...argv
  } = minimist(args)
  if (h || help || v || version) {
    const res = await spawn('eslint', dargs({ v, version, h, help }))
    console.log(res.stdout)
    return
  }
  const format = f || outputFormat || 'stylish'
  const output = o || outputFile

  if (!['stylish', 'compact', 'json'].includes(format)) {
    console.error(`format ${format} is not supported yet`)
    return
  }

  const files = await getFiles({ entries, extension })
  const results = await getResults(
    files,
    Math.min(Math.max(1, concurrency | 0), cpus().length),
    { ...argv, format },
  )
  const formatted = getFormatted(results, format)
  if (output) {
    await writeFile(output, formatted)
  } else {
    if (formatted) {
      console.log(formatted)
    }
  }
  if (results.every((result) => result.status === 'fulfilled')) {
    return Promise.resolve()
  }
  // eslint-disable-next-line prefer-promise-reject-errors
  return Promise.reject()
}
