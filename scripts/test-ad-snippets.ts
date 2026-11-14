import assert from 'node:assert/strict'
// @ts-expect-error Node 24 runs this standalone TypeScript test directly.
import { parseAdSnippet, safeGlobalScriptUrl } from '../lib/server/ad-snippets.ts'

const socialBar = '<script data-cfasync="false" src="https://czernik.org/14/e721736e3adeec281685c715274ce8d0"></script>'
const nativeBanner = '<script async="async" data-cfasync="false" src="https://czernik.org/21/745a757db1dca4fa2ba8896dff9f848c"></script>\n<div id="container-745a757db1dca4fa2ba8896dff9f848c"></div>'
const banner728 = `<script>\n  atOptions = { 'key' : ********, 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };\n</script>\n<script src="https://czernik.org/22/********"></script>`
const smartlink = 'https://budgetezy.org/4/af3b983bccb4671b602b69f8c288083c'

const accepted = [
  ['social bar global script', () => safeGlobalScriptUrl(socialBar) === 'https://czernik.org/14/e721736e3adeec281685c715274ce8d0'],
  ['native banner snippet', () => parseAdSnippet(nativeBanner).ok],
  ['728x90 banner snippet', () => parseAdSnippet(banner728).ok],
  ['plain smartlink URL', () => new URL(smartlink).protocol === 'https:' && new URL(smartlink).hostname === 'budgetezy.org'],
  ['global plain HTTPS URL without .js', () => safeGlobalScriptUrl('https://czernik.org/14/adcode') === 'https://czernik.org/14/adcode'],
  ['global script with protocol-relative src', () => safeGlobalScriptUrl('<script src="//czernik.org/14/code"></script>') === 'https://czernik.org/14/code'],
  ['global script with comments, whitespace, and trailing backslash', () => safeGlobalScriptUrl('  <!-- <script data-cfasync="false" src="https://czernik.org/14/code"></script> -->\\  ') === 'https://czernik.org/14/code'],
] as const

const rejected = [
  ['two scripts in a global field', () => !safeGlobalScriptUrl(`${socialBar}${socialBar}`)],
  ['inline script body in a global field', () => !safeGlobalScriptUrl('<script src="https://czernik.org/14/code">alert(1)</script>')],
  ['HTTP script src', () => !safeGlobalScriptUrl('<script src="http://czernik.org/14/code"></script>')],
  ['onload attribute', () => !safeGlobalScriptUrl('<script src="https://czernik.org/14/code" onload="alert(1)"></script>')],
] as const

for (const [name, test] of [...accepted, ...rejected]) {
  assert.equal(test(), true, name)
  console.log(`PASS ${name}`)
}
