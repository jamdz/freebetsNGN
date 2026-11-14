import assert from 'node:assert/strict'
// @ts-expect-error Node 24 runs this standalone TypeScript test directly.
import { parseAdSnippet, safeGlobalScriptUrl, parseAdcashInput } from '../lib/server/ad-snippets.ts'

const socialBar = '<script data-cfasync="false" src="https://czernik.org/14/e721736e3adeec281685c715274ce8d0"></script>'
const nativeBanner = '<script async="async" data-cfasync="false" src="https://czernik.org/21/745a757db1dca4fa2ba8896dff9f848c"></script>\n<div id="container-745a757db1dca4fa2ba8896dff9f848c"></div>'
const banner728 = `<script>\n  atOptions = { 'key' : ********, 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };\n</script>\n<script src="https://czernik.org/22/********"></script>`
const smartlink = 'https://budgetezy.org/4/af3b983bccb4671b602b69f8c288083c'
const adcashOfficial = `<script id="aclib" type="text/javascript" src="//acscdn.com/script/aclib.js"></script>
<script type="text/javascript">
    aclib.runAutoTag({
        zoneId: 'z02emphdm5',
    });
</script>`

const accepted = [
  ['social bar global script', () => safeGlobalScriptUrl(socialBar) === 'https://czernik.org/14/e721736e3adeec281685c715274ce8d0'],
  ['native banner snippet', () => parseAdSnippet(nativeBanner).ok],
  ['728x90 banner snippet', () => parseAdSnippet(banner728).ok],
  ['plain smartlink URL', () => new URL(smartlink).protocol === 'https:' && new URL(smartlink).hostname === 'budgetezy.org'],
  ['global plain HTTPS URL without .js', () => safeGlobalScriptUrl('https://czernik.org/14/adcode') === 'https://czernik.org/14/adcode'],
  ['global script with protocol-relative src', () => safeGlobalScriptUrl('<script src="//czernik.org/14/code"></script>') === 'https://czernik.org/14/code'],
  ['global script with comments, whitespace, and trailing backslash', () => safeGlobalScriptUrl('  <!-- <script data-cfasync="false" src="https://czernik.org/14/code"></script> -->\\  ') === 'https://czernik.org/14/code'],
  ['official Adcash two-block snippet yields autotag zone', () => { const result = parseAdcashInput(adcashOfficial); return result.ok && result.format === 'autotag' && result.zoneId === 'z02emphdm5' }],
  ['Adcash zone ID alone defaults to autotag', () => { const result = parseAdcashInput('z02emphdm5'); return result.ok && result.format === 'autotag' && result.zoneId === 'z02emphdm5' }],
  ['Adcash pop format is detected', () => { const result = parseAdcashInput(adcashOfficial.replace('runAutoTag', 'runPop')); return result.ok && result.format === 'pop' && result.zoneId === 'z02emphdm5' }],
  ['Adcash trailing backslash after final script is tolerated', () => parseAdcashInput(`${adcashOfficial}\\`).ok],
] as const

const rejected = [
  ['two scripts in a global field', () => !safeGlobalScriptUrl(`${socialBar}${socialBar}`)],
  ['inline script body in a global field', () => !safeGlobalScriptUrl('<script src="https://czernik.org/14/code">alert(1)</script>')],
  ['HTTP script src', () => !safeGlobalScriptUrl('<script src="http://czernik.org/14/code"></script>')],
  ['onload attribute', () => !safeGlobalScriptUrl('<script src="https://czernik.org/14/code" onload="alert(1)"></script>')],
  ['Adcash library from another host rejected', () => !parseAdcashInput(adcashOfficial.replace('//acscdn.com/script/aclib.js', '//evil.example/script/aclib.js')).ok],
  ['Adcash inline script with extra code rejected', () => !parseAdcashInput(adcashOfficial.replace("    });", "    });\n    alert(1);")).ok],
  ['Adcash zone ID with spaces rejected', () => !parseAdcashInput('z02 emp hdm5').ok],
] as const

for (const [name, test] of [...accepted, ...rejected]) {
  assert.equal(test(), true, name)
  console.log(`PASS ${name}`)
}
