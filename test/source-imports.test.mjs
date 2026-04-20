import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC_ROOT = fileURLToPath(new URL('../src', import.meta.url))
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/
const TS_IMPORT_PATTERN = /(?:from\s+['"][^'"]+\.ts['"]|import\(\s*['"][^'"]+\.ts['"]\s*\))/g

function collectSourceFiles(directory) {
    const entries = readdirSync(directory)
    const files = []

    for (const entry of entries) {
        const fullPath = join(directory, entry)
        const stats = statSync(fullPath)

        if (stats.isDirectory()) {
            files.push(...collectSourceFiles(fullPath))
            continue
        }

        if (SOURCE_FILE_PATTERN.test(entry)) {
            files.push(fullPath)
        }
    }

    return files
}

test('TypeScript source files do not use .ts extension import specifiers', () => {
    const sourceFiles = collectSourceFiles(SRC_ROOT)
    const offenders = []

    for (const filePath of sourceFiles) {
        const contents = readFileSync(filePath, 'utf8')
        const matches = contents.match(TS_IMPORT_PATTERN)

        if (matches?.length) {
            offenders.push(`${relative(PROJECT_ROOT, filePath)} => ${matches.join(', ')}`)
        }
    }

    assert.deepEqual(offenders, [])
})
