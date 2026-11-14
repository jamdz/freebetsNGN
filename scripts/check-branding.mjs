import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const searchRoots = ['app', 'components', 'lib']
const brandedNames = ['FreeBetNGN', 'FreeBetsNGN']
const matches = []

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'docs') await collect(fullPath)
      continue
    }
    if (!/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) continue
    if (path.relative(root, fullPath) === path.join('lib', 'site-settings.ts')) continue
    const source = await readFile(fullPath, 'utf8')
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    withoutComments.split('\n').forEach((line, index) => {
      for (const name of brandedNames) {
        if (line.includes(name)) matches.push(`${path.relative(root, fullPath)}:${index + 1}: ${name}`)
      }
    })
  }
}

for (const directory of searchRoots) await collect(path.join(root, directory))
if (matches.length) {
  console.error('Fixed brand references remain:')
  console.error(matches.join('\n'))
  process.exitCode = 1
} else {
  console.log('Branding check passed: no fixed brand strings found in app, components, or lib.')
}
