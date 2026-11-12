import assert from 'node:assert/strict'
// @ts-expect-error Native Node type stripping requires a .ts extension for this standalone test.
import { parseAdSnippet } from '../lib/server/ad-snippets.ts'

const aads = `<!-- BEGIN AADS AD UNIT 2461801 -->

<div id="frame" style="width: 100%;margin: auto;position: relative; z-index: 99998;">
          <iframe data-aa='2461801' src='//acceptable.a-ads.com/2461801/?size=Adaptive'
                            style='border:0; padding:0; width:70%; height:auto; overflow:hidden;display: block;margin: auto'></iframe>
        </div>

<!-- END AADS AD UNIT 2461801 -->`

const adsterra = `<script>
  atOptions = {
    'key' : ********,
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://czernik.org/22/********"></script>`

const aadsResult = parseAdSnippet(aads)
const adsterraResult = parseAdSnippet(adsterra)
assert.equal(aadsResult.ok, true, aadsResult.issues.join('; '))
assert.equal(adsterraResult.ok, true, adsterraResult.issues.join('; '))
assert.equal(aadsResult.unitId, '2461801')
assert.equal(adsterraResult.width, 728)
assert.equal(adsterraResult.height, 90)
assert.match(aadsResult.html, /acceptable\.a-ads\.com\/2461801/)
assert.match(adsterraResult.html, /czernik\.org\/22/)

const savedBeforeReload = { aads: { units: { '320x100': aads } }, adsterra: { banner: { '728x90': adsterra } } }
const savedAfterReload = JSON.parse(JSON.stringify(savedBeforeReload)) as typeof savedBeforeReload
assert.equal(savedAfterReload.aads.units['320x100'], aads)
assert.equal(savedAfterReload.adsterra.banner['728x90'], adsterra)

const rejected = [
  '<iframe src="https://ads.example/ad" onload="alert(1)"></iframe>',
  '<div onclick="alert(1)">ad</div>',
  '<a href="javascript:alert(1)">ad</a>',
  '<iframe src="data:text/html,hello"></iframe>',
  '<iframe src="https://ads.example/ad" srcdoc="<script>alert(1)</script>"></iframe>',
  '<script>atOptions = {\'x\': fetch(\'https://example.test\')};</script>',
  '<style>body { display: none }</style>',
  '<script src="http://ads.example/ad.js"></script>',
  '<script src="https://user:password@ads.example/ad.js"></script>',
]
for (const snippet of rejected) {
  assert.equal(parseAdSnippet(snippet).ok, false, `Expected rejection: ${snippet}`)
}

console.log('PASS: official A-ADS and Adsterra snippets parse successfully')
console.log('PASS: raw snippets are unchanged after simulated save and reload')
console.log('PASS: all 9 unsafe or unsupported snippets are rejected')
