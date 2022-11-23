// @ts-ignore
import spawn from '@npmcli/promise-spawn'
import dargs from 'dargs'
import fg from 'fast-glob'
import minimist from 'minimist'
import { stat, writeFile } from 'node:fs/promises'

type ESLintFormat = 'stylish' | 'compact' | 'json'

const getFiles = async ({
  entry,
  ext,
}: {
  entry: string | string[]
  ext: string | string[]
}) => {
  const entries = Array.isArray(entry) ? entry : [entry]
  const exts = ext
    ? `.(${(Array.isArray(ext) ? ext : [ext])
        .reduce((exts, ext) => [...exts, ...ext.split(',')], [] as string[])
        .map((ext) => ext.replace(/^\./, ''))
        .join('|')})`
    : ''
  const patterns = await entries.reduce(async (entries, entry) => {
    return [
      ...(await entries),
      !entry.includes('*') && (await stat(entry)).isDirectory()
        ? `${entry}/**/*${exts}`
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
  return Promise.all(eslints)
}

const getFormatted = (results: { stdout: string }[], format: ESLintFormat) => {
  if (format === 'json') {
    return `[${results
      .map((result) => result.stdout.substring(1, result.stdout.length - 1))
      .join(',')}]`
  }
  return results
    .map((result) => result.stdout)
    .filter((result) => result)
    .join('\n')
}

export const main = async (args: string[]) => {
  const {
    _: entry,
    ext = ['js', 'ts', 'jsx', 'tsx'],
    'output-file': outputFile,
    o,
    help,
    h,
    version,
    v,
    format: outputFormat,
    f,
    ...argv
  } = minimist(args)
  if (h || help || v || version) {
    const res = await spawn('eslint', dargs({ v, version, h, help }))
    console.log(res.stdout)
    return
  }
  const files = await getFiles({ entry, ext })
  const output = o || outputFile
  const format = f || outputFormat || 'stylish'
  if (!['stylish', 'compact', 'json'].includes(format)) {
    throw new Error('format is not supported yet')
  }
  const results = await getResults(files, 4, { ...argv, format })
  const formatted = getFormatted(results, format)
  if (output) {
    await writeFile(output, formatted)
  } else {
    if (formatted) {
      console.log(formatted)
    }
  }
}
