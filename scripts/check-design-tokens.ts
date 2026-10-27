/**
 * 千机工坊 Design Token Compliance Scanner
 *
 * Scans all .vue / .ts / .tsx files under apps/ for hardcoded color values
 * that should instead use design-system tokens (brand.*, semantic.*, surface.*, text.*).
 *
 * Usage:
 *   npx tsx scripts/check-design-tokens.ts
 *   # or in CI:
 *   node --loader ts-node/esm scripts/check-design-tokens.ts
 *
 * Exit codes:
 *   0 = all clean
 *   1 = violations found
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Config ──────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const SCAN_DIRS = [join(ROOT, 'apps')]
const FILE_EXTS = ['.vue', '.ts', '.tsx', '.jsx']
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.nuxt', '.output', 'coverage'])

// Allowlist: colors that are acceptable as raw values (pure utility colors)
const HEX_ALLOWLIST = new Set([
  '#fff', '#ffffff', '#FFF', '#FFFFFF',  // pure white
  '#000', '#000000',                      // pure black
  '#0000', '#00000000',                   // transparent
  '#fff0', '#ffffff00',                   // transparent white
])

const FORBIDDEN_NEON = new Map([
  ['#ec4899', 'pink-500 (neon pink — forbidden, see VISUAL_BOUNDARY.md)'],
  ['#8b5cf6', 'violet-500 (neon violet — forbidden as neon glow, see VISUAL_BOUNDARY.md)'],
  ['#d946ef', 'fuchsia-500 (neon fuchsia — forbidden)'],
  ['#f472b6', 'pink-400 (neon pink variant — forbidden)'],
])

// ── Regex patterns ──────────────────────────────────────────────

// Match #RGB, #RRGGBB, #RGBA, #RRGGBBAA in template/script/style contexts
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g

// Match rgb(...) and rgba(...) with numeric values
const RGB_RE = /rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/g

// Match hsl(...) and hsla(...)
const HSL_RE = /hsla?\(\s*\d{1,3}/g

// ── Helpers ─────────────────────────────────────────────────────

interface Violation {
  file: string
  line: number
  col: number
  match: string
  reason: string
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return // directory may not exist yet
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkDir(full)
    } else if (FILE_EXTS.some(ext => entry.name.endsWith(ext))) {
      yield full
    }
  }
}

function isInsideComment(line: string, col: number): boolean {
  // Simple heuristic: skip lines that are pure comments
  const trimmed = line.trimStart()
  if (trimmed.startsWith('//')) return true
  if (trimmed.startsWith('/*')) return true
  if (trimmed.startsWith('*')) return true
  if (trimmed.startsWith('<!--')) return true
  // Skip if inside a string that references a CSS variable fallback
  const before = line.slice(0, col)
  if (before.includes('var(--') && !before.includes(')')) return true
  return false
}

function isTailwindArbitraryValue(line: string, match: string, col: number): boolean {
  // Detect Tailwind arbitrary values like bg-[#00BFA5] — still a violation
  // but also detect class names like "text-brand-cyan" which are fine
  const before = line.slice(Math.max(0, col - 30), col)
  return /\[[\w-]*$/.test(before) // inside square brackets = arbitrary value = violation
}

function checkLine(filePath: string, lineText: string, lineNum: number): Violation[] {
  const violations: Violation[] = []
  const relPath = relative(ROOT, filePath)

  // Check hex colors
  let m: RegExpExecArray | null
  HEX_RE.lastIndex = 0
  while ((m = HEX_RE.exec(lineText)) !== null) {
    const hex = m[0].toLowerCase()
    if (isInsideComment(lineText, m.index)) continue
    if (HEX_ALLOWLIST.has(m[0])) continue

    // Check if this is inside a CSS variable fallback: var(--x, #xxx) — allowed
    const before = lineText.slice(Math.max(0, m.index - 40), m.index)
    if (/var\(--[\w-]+,\s*$/.test(before)) continue

    // Check forbidden neon colors
    const forbidden = FORBIDDEN_NEON.get(hex.toLowerCase())
    if (forbidden) {
      violations.push({
        file: relPath,
        line: lineNum,
        col: m.index + 1,
        match: m[0],
        reason: `FORBIDDEN NEON: ${forbidden}`,
      })
      continue
    }

    violations.push({
      file: relPath,
      line: lineNum,
      col: m.index + 1,
      match: m[0],
      reason: 'Hardcoded hex — use a design token (brand.*/semantic.*/surface.*/text.*) instead',
    })
  }

  // Check rgb/rgba
  RGB_RE.lastIndex = 0
  while ((m = RGB_RE.exec(lineText)) !== null) {
    if (isInsideComment(lineText, m.index)) continue
    // Allow rgba inside CSS variable fallbacks
    const before = lineText.slice(Math.max(0, m.index - 40), m.index)
    if (/var\(--[\w-]+,\s*$/.test(before)) continue

    violations.push({
      file: relPath,
      line: lineNum,
      col: m.index + 1,
      match: m[0],
      reason: 'Hardcoded rgb/rgba — use a design token instead',
    })
  }

  // Check hsl/hsla
  HSL_RE.lastIndex = 0
  while ((m = HSL_RE.exec(lineText)) !== null) {
    if (isInsideComment(lineText, m.index)) continue
    const before = lineText.slice(Math.max(0, m.index - 40), m.index)
    if (/var\(--[\w-]+,\s*$/.test(before)) continue

    violations.push({
      file: relPath,
      line: lineNum,
      col: m.index + 1,
      match: m[0],
      reason: 'Hardcoded hsl/hsla — use a design token instead',
    })
  }

  return violations
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  const allViolations: Violation[] = []
  let filesScanned = 0

  for (const scanDir of SCAN_DIRS) {
    for await (const filePath of walkDir(scanDir)) {
      filesScanned++
      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const violations = checkLine(filePath, lines[i], i + 1)
        allViolations.push(...violations)
      }
    }
  }

  // ── Report ──────────────────────────────────────────────────

  if (allViolations.length === 0) {
    console.log(`\x1b[32m✓\x1b[0m Design token scan passed — ${filesScanned} files checked, 0 violations.`)
    process.exit(0)
  }

  // Group by file
  const byFile = new Map<string, Violation[]>()
  for (const v of allViolations) {
    const list = byFile.get(v.file) ?? []
    list.push(v)
    byFile.set(v.file, list)
  }

  console.error(`\n\x1b[31m✗\x1b[0m Design token violations found: ${allViolations.length} issues in ${byFile.size} files\n`)

  for (const [file, violations] of byFile) {
    console.error(`  \x1b[1m${file}\x1b[0m`)
    for (const v of violations) {
      const severity = v.reason.startsWith('FORBIDDEN') ? '\x1b[31m' : '\x1b[33m'
      console.error(`    L${v.line}:${v.col}  ${severity}${v.match}\x1b[0m  ${v.reason}`)
    }
    console.error('')
  }

  console.error('─'.repeat(60))
  console.error(`Fix: Replace hardcoded colors with Tailwind design tokens.`)
  console.error(`  Example: bg-[#00BFA5] → bg-brand-cyan`)
  console.error(`           text-[#EF4444] → text-semantic-error`)
  console.error(`  Token reference: packages/ui/tailwind.base.ts`)
  console.error(`  Visual rules: docs/design/VISUAL_BOUNDARY.md`)
  console.error('')

  process.exit(1)
}

main().catch((err) => {
  console.error('Scanner failed:', err)
  process.exit(2)
})
