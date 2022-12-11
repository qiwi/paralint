import '../../main/ts/promise-spawn.d.ts'
import spawn from '@npmcli/promise-spawn'
import { expect } from 'earljs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { temporaryFileTask } from 'tempy'
import { test } from 'uvu'

import type { ParaLintResult } from '../../main/ts'

const src = resolve(__dirname, '../../../src')

const srcPattern = `${src}/**/*.(ts|js)`

const cwd = process.cwd()

const fix = (content: string) => {
  return content.replaceAll(cwd, '')
}

const json = (content: string) => {
  return JSON.parse(content)
}

const paralintCli = resolve(__dirname, '../../../target/es6/cli.js')

const paralint = async (args: string[]) => {
  try {
    return await spawn('node', [paralintCli, '--no-inline-config', ...args])
  } catch (e) {
    return e as ParaLintResult
  }
}

test('runs with -h', async () => {
  const result = await paralint(['-h'])
  expect(fix(result.stdout)).toMatchSnapshot()
})

test('runs with --help', async () => {
  const result = await paralint(['--help'])
  expect(fix(result.stdout)).toMatchSnapshot()
})

test('runs with -v', async () => {
  const result = await paralint(['-v'])
  expect(fix(result.stdout)).toMatchSnapshot()
})

test('runs with --version', async () => {
  const result = await paralint(['--version'])
  expect(fix(result.stdout)).toMatchSnapshot()
})

test('runs with -f html', async () => {
  const result = await paralint(['-f', 'html'])
  expect(fix(result.stderr)).toMatchSnapshot()
})

test('runs with --format html', async () => {
  const result = await paralint(['--format', 'html'])
  expect(fix(result.stderr)).toMatchSnapshot()
})

test('runs with directory', async () => {
  const result = await paralint([src])
  expect(fix(result.stdout)).toMatchSnapshot()
})

test('runs with directory and ext', async () => {
  const result = await paralint([src, '--ext', 'ts'])
  expect(fix(result.stdout)).toMatchSnapshot()
})

test('runs with file', async () => {
  const result = await paralint([`${src}/main/ts/cli.ts`])
  expect(fix(result.stdout)).toMatchSnapshot()
})

test('runs with pattern', async () => {
  const result = await paralint([srcPattern])
  expect(fix(result.stdout)).toMatchSnapshot()
})

test('runs with pattern root, ext and ignore pattern', async () => {
  const result = await paralint([
    '.',
    '--ext',
    'ts',
    '--ignore-pattern',
    'target',
  ])
  expect(fix(result.stdout)).toMatchSnapshot()
})

test('runs with -f json', async () => {
  const result = await paralint([srcPattern, '-f', 'json'])
  expect(json(fix(result.stdout))).toMatchSnapshot()
})

test('runs with -o eslint.txt', async () => {
  await temporaryFileTask(
    async (file) => {
      await paralint([srcPattern, '-o', file])
      const content = await readFile(file, 'utf8')
      expect(fix(content)).toMatchSnapshot()
    },
    { name: 'eslint.txt' },
  )
})

test('runs with --format json and --output-file eslint.json', async () => {
  await temporaryFileTask(
    async (file) => {
      await paralint([srcPattern, '--format', 'json', '--output-file', file])
      const content = await readFile(file, 'utf8')
      expect(json(fix(content))).toMatchSnapshot()
    },
    { name: 'eslint.json' },
  )
})

test.run()
