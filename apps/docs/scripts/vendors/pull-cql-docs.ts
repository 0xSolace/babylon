#!/usr/bin/env bun
/**
 * Fetch CQL (CovenantSQL) / Jeju docs from the Jeju monorepo.
 *
 * Strategy:
 * - Use the GitHub trees API to list files under the docs path.
 * - Download raw files via raw.githubusercontent.com.
 * - Write them under `docs/vendors/cql/`
 *
 * Usage:
 *   bun run apps/docs/scripts/vendors/pull-cql-docs.ts [--repo jeju-labs/jeju] [--branch main] [--output docs/vendors/cql]
 */

import { mkdir } from 'node:fs/promises'

const DEFAULT_REPO = 'jeju-labs/jeju'
const DEFAULT_BRANCH = 'main'
const DEFAULT_OUTPUT = 'docs/vendors/cql'
const DEFAULT_WORKERS = 16
const DEFAULT_PREFIX = 'docs/'

type Options = {
  repo: string
  branch: string
  output: string
  workers: number
  docsPrefix: string
}

type Page = {
  path: string
  output: string
}

const args = Bun.argv.slice(2)

function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) {
    const value = args[idx + 1]
    if (value) return value
  }
  return fallback
}

const opts: Options = {
  repo: getArg('--repo', DEFAULT_REPO),
  branch: getArg('--branch', DEFAULT_BRANCH),
  output: getArg('--output', DEFAULT_OUTPUT),
  workers: Number(getArg('--workers', String(DEFAULT_WORKERS))),
  docsPrefix: getArg('--docs-prefix', DEFAULT_PREFIX),
}

type GitTreeResponse = {
  tree: { path: string; type: string }[]
}

async function fetchJson(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

async function fetchText(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()
}

async function listDocsFromRepo(options: Options): Promise<Page[]> {
  const treeUrl = `https://api.github.com/repos/${options.repo}/git/trees/${options.branch}?recursive=1`
  const data = (await fetchJson(treeUrl)) as GitTreeResponse
  const tree = data.tree
  if (!Array.isArray(tree)) throw new Error('Unexpected tree response')

  const pages: Page[] = []
  for (const entry of tree) {
    if (entry.type !== 'blob') continue
    if (!entry.path.startsWith(options.docsPrefix)) continue
    if (!entry.path.match(/\.(md|mdx|json)$/i)) continue

    const rel = entry.path.replace(options.docsPrefix, '')
    const parts = rel.split('/')
    const filename = parts.pop() || 'index'
    const dir = [options.output, ...parts].join('/')
    const output = `${dir ? `${dir}/` : ''}${filename}`
    pages.push({ path: entry.path, output })
  }
  return pages
}

async function ensureDir(path: string) {
  const dir = path.split('/').slice(0, -1).join('/')
  if (!dir) return
  await mkdir(dir, { recursive: true })
}

async function writeFile(path: string, content: string) {
  await ensureDir(path)
  await Bun.write(path, content.endsWith('\n') ? content : `${content}\n`)
}

export async function pullCqlDocs(options: Options = opts) {
  const pages = await listDocsFromRepo(options)
  console.log(
    `Discovered ${pages.length} docs files from repo ${options.repo} @ ${options.branch} (prefix: ${options.docsPrefix}).`,
  )

  let active = 0
  let idx = 0
  let ok = 0
  const skipped = 0
  const results: Promise<void>[] = []

  async function worker(page: Page) {
    const rawUrl = `https://raw.githubusercontent.com/${options.repo}/${options.branch}/${page.path}`
    const content = await fetchText(rawUrl)
    await writeFile(page.output, content)
    ok++
    console.log(`[ok] ${page.output}`)
  }

  function next(): void {
    if (idx >= pages.length) return
    const page = pages[idx++]
    if (!page) return
    active++
    const p = worker(page).finally(() => {
      active--
      next()
    })
    results.push(p)
    if (active < options.workers && idx < pages.length) next()
  }

  for (let i = 0; i < options.workers && i < pages.length; i++) next()
  await Promise.all(results)
  console.log(`Done. ok=${ok} skipped=${skipped}`)
  return { ok, skipped }
}

if (import.meta.main) {
  pullCqlDocs(opts).catch((err: Error) => {
    console.error(err)
    process.exit(1)
  })
}
