#!/usr/bin/env node
/**
 * 从 ffdkj/Pixiv_Tag-Chinese-English-Translation-Table 的 tag.sqlite
 * 生成 lib/client.js 里的扩展标签对照表（EXTRA_TAG_TABLE）。
 *
 * 用法:
 *   node scripts/build-extratags.mjs <tag.sqlite 路径或下载 URL> [posts 阈值]
 *
 * 示例:
 *   node scripts/build-extratags.mjs ../pixiv-tag-table/tag.sqlite 1000
 *   node scripts/build-extratags.mjs https://github.com/ffdkj/Pixiv_Tag-Chinese-English-Translation-Table/raw/main/tag.sqlite 1000
 *
 * 需要 Node >= 22.13（node:sqlite）；下载走 HTTPS_PROXY 环境变量（如有）。
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

const [sourceArg = 'tag.sqlite', thresholdArg = '1000'] = process.argv.slice(2)
const threshold = Math.max(1, Number.parseInt(thresholdArg, 10) || 1000)

let dbPath = sourceArg
let cleanupDir = null
if (/^https?:\/\//.test(sourceArg)) {
  const tmp = mkdtempSync(join(tmpdir(), 'pixiv-tags-'))
  dbPath = join(tmp, 'tag.sqlite')
  cleanupDir = tmp
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || null
  console.log(`下载 ${sourceArg} ...`)
  const res = await undiciFetch(sourceArg, proxy ? { dispatcher: new ProxyAgent({ uri: proxy }) } : {})
  if (!res.ok) throw new Error(`下载失败: HTTP ${res.status}`)
  writeFileSync(dbPath, Buffer.from(await res.arrayBuffer()))
}

const db = new DatabaseSync(dbPath, { readOnly: true })
const rows = db.prepare('SELECT name, cn_name, posts FROM pixiv_tags WHERE posts >= ? ORDER BY posts DESC').all(threshold)
db.close()
if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true })

if (rows.length === 0) throw new Error(`阈值 posts >= ${threshold} 没有任何标签`)

const today = new Date().toISOString().slice(0, 10)
const block = [
  '    // <extra-tags:begin>',
  '    // 数据来源: https://github.com/ffdkj/Pixiv_Tag-Chinese-English-Translation-Table (MIT)',
  `    // 筛选: posts >= ${threshold} · ${rows.length} 条 · 生成日期 ${today} · 格式 [标签, 中文译名, 作品数]，按作品数降序`,
  `    const EXTRA_TAG_TABLE = ${JSON.stringify(rows.map((row) => [row.name, row.cn_name, row.posts]))}`,
  '    // <extra-tags:end>',
].join('\n')

const scriptDir = dirname(fileURLToPath(import.meta.url))
const clientPath = resolve(scriptDir, '..', 'lib', 'client.js')
const source = readFileSync(clientPath, 'utf8')
const BEGIN = '    // <extra-tags:begin>'
const END = '    // <extra-tags:end>'
const start = source.indexOf(BEGIN)
const end = source.indexOf(END)
if (start === -1 || end === -1 || end <= start) {
  throw new Error('lib/client.js 中找不到 <extra-tags:begin>/<extra-tags:end> 标记区间')
}
const endLineEnd = source.indexOf('\n', end)
const replaced = source.slice(0, start) + block + source.slice(endLineEnd + 1)
writeFileSync(clientPath, replaced)
console.log(`已写入 ${rows.length} 条标签（posts >= ${threshold}）到 lib/client.js`)
