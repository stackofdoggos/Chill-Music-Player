#!/usr/bin/env node
/**
 * Scan dist/ for common secret / PII patterns before upload.
 * Usage: npm run build && node scripts/check-deploy.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(process.cwd(), 'dist')
const PATTERNS = [
  { name: 'API key style', re: /\b(AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36})\b/ },
  { name: 'Bearer token', re: /Bearer\s+[a-zA-Z0-9._\-]+/ },
  { name: 'Private key block', re: /BEGIN (RSA |OPENSSH )?PRIVATE KEY/ },
  { name: 'Local home path', re: /\/Users\/[a-zA-Z0-9._-]+\// },
  { name: 'Email address', re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { name: 'Dev globals', re: /__store|__engine|__proj|__hits/ },
]

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, files)
    else if (/\.(html|js|css|json|txt|md)$/i.test(name)) files.push(path)
  }
  return files
}

let failed = false
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8')
  for (const { name, re } of PATTERNS) {
    const m = text.match(re)
    if (m) {
      console.error(`FAIL ${file}: ${name} → ${m[0].slice(0, 80)}`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log('deploy check passed — no secrets or dev leaks found in dist/')
