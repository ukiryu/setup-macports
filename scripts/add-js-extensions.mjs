#!/usr/bin/env node

/**
 * Add .js extensions to all relative imports in TypeScript files
 * This is required for ESM with NodeNext module resolution
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '..', 'src')

// Process all .ts files in src directory
function processDirectory(dir) {
  const files = readdirSync(dir)
  for (const file of files) {
    const fullPath = join(dir, file)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      processDirectory(fullPath)
    } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
      processFile(fullPath)
    }
  }
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8')
  let modified = false

  // Pattern to match relative imports
  // Matches: from './...' or from "../..."
  const importRegex = /(\bfrom\s+['"])(\.\.?\/[^'"]*)(['"])/g

  content = content.replace(importRegex, (match, prefix, path, suffix) => {
    // Don't modify if it already has .js or .json extension
    if (path.endsWith('.js') || path.endsWith('.json') || path.endsWith('.mjs')) {
      return match
    }

    // Add .js extension
    modified = true
    return `${prefix}${path}.js${suffix}`
  })

  if (modified) {
    writeFileSync(filePath, content)
    console.log(`Updated: ${filePath}`)
  }
}

// Run the processor
processDirectory(srcDir)
console.log('ESM import extension update complete!')
