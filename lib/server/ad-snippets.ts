import { parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5'

type ChildNode = DefaultTreeAdapterTypes.ChildNode
type ParentNode = DefaultTreeAdapterTypes.ParentNode
type ElementNode = DefaultTreeAdapterTypes.Element

type ParsedLiteral = string | number | boolean | { [key: string]: ParsedLiteral }

export type AdSnippetResult = {
  ok: boolean
  issues: string[]
  html: string
  width?: number
  height?: number
  unitId?: string
}

const allowedElements = new Set(['div', 'ins', 'iframe', 'script', 'noscript'])
const allowedIframeAttributes = new Set(['src', 'width', 'height', 'style', 'title', 'id', 'class', 'frameborder', 'scrolling', 'marginwidth', 'marginheight', 'allowtransparency', 'loading', 'data-aa'])
const allowedScriptAttributes = new Set(['src', 'async', 'defer', 'type', 'charset', 'data-cfasync'])
const allowedContainerAttributes = new Set(['id', 'class', 'style'])
const allowedStyleProperties = new Set(['width', 'max-width', 'min-height', 'height', 'margin', 'padding', 'border', 'overflow', 'display', 'position', 'z-index', 'text-align'])
const size = (value: string | undefined) => {
  if (!value) return undefined
  const match = value.trim().match(/^(\d{1,5})(?:px)?$/i)
  return match ? Number(match[1]) : undefined
}

export const isAadsUnitId = (value: string) => /^\d{3,12}$/.test(value)

export function aadsUnitSnippet(unitId: string, dimensions: { width: number; height: number }) {
  return `<iframe data-aa="${unitId}" src="//acceptable.a-ads.com/${unitId}/?size=Adaptive" width="${dimensions.width}" height="${dimensions.height}" style="border:0; padding:0; width:100%; height:auto; overflow:hidden; display:block; margin:auto"></iframe>`
}

function normalizedNetworkUrl(value: string) {
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value)
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null
    return url.toString()
  } catch {
    return null
  }
}

function safeStyle(value: string) {
  const declarations: string[] = []
  let valid = true
  for (const declaration of value.split(';')) {
    if (!declaration.trim()) continue
    const separator = declaration.indexOf(':')
    if (separator < 1) {
      valid = false
      continue
    }
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const propertyValue = declaration.slice(separator + 1).trim()
    if (!allowedStyleProperties.has(property) || !/^[a-z0-9\s.%#(),!:-]+$/i.test(propertyValue) || /url\s*\(|expression|javascript|@import/i.test(propertyValue)) {
      valid = false
      continue
    }
    declarations.push(`${property}: ${propertyValue}`)
  }
  return { valid, value: declarations.join('; ') }
}

function isLiteral(value: unknown): value is ParsedLiteral {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every(isLiteral)
}

function inlineOptions(body: string) {
  if (/[()`]|\b(?:function|eval|document|window|fetch|import)\b|=>|<\/|<!--/i.test(body)) return null
  const match = body.trim().match(/^(?:var\s+)?atOptions\s*=\s*(\{[\s\S]*\})\s*;$/)
  if (!match) return null
  try {
    const jsonText = match[1].replaceAll('********', '"********"').replaceAll("'", '"')
    const value: unknown = JSON.parse(jsonText)
    if (!isLiteral(value)) return null
    return value as Record<string, ParsedLiteral>
  } catch {
    return null
  }
}

export function parseAdSnippet(raw: string): AdSnippetResult {
  const issues: string[] = []
  if (raw.length > 8192) return { ok: false, issues: ['Snippet must be 8192 characters or fewer.'], html: '' }
  if (!raw.trim()) return { ok: false, issues: ['Snippet is empty.'], html: '' }

  const fragment = parseFragment(raw)
  let scriptAndIframeCount = 0
  let width: number | undefined
  let height: number | undefined
  let unitId: string | undefined

  const issue = (message: string) => { if (!issues.includes(message)) issues.push(message) }
  const cleanChildren = (parent: ParentNode) => {
    for (let index = 0; index < parent.childNodes.length;) {
      const node = parent.childNodes[index]
      if (node.nodeName === '#comment') {
        parent.childNodes.splice(index, 1)
        continue
      }
      if (node.nodeName === '#documentType') {
        issue('Document types are not allowed.')
        parent.childNodes.splice(index, 1)
        continue
      }
      if (!('tagName' in node)) {
        index += 1
        continue
      }
      const element = node as ElementNode
      const tag = element.tagName.toLowerCase()
      if (!allowedElements.has(tag)) {
        issue(`Element <${tag}> is not allowed.`)
        parent.childNodes.splice(index, 1)
        continue
      }
      if (tag === 'script' || tag === 'iframe') {
        scriptAndIframeCount += 1
        if (scriptAndIframeCount > 4) issue('A snippet may contain no more than 4 script or iframe elements.')
      }

      const allowed = tag === 'script' ? allowedScriptAttributes : tag === 'iframe' ? allowedIframeAttributes : tag === 'div' || tag === 'ins' ? allowedContainerAttributes : new Set<string>()
      const retained: typeof element.attrs = []
      for (const attr of element.attrs) {
        const name = attr.name.toLowerCase()
        const value = attr.value
        if (name.startsWith('on') || name === 'srcdoc') {
          issue(`Attribute ${name} is not allowed.`)
          continue
        }
        if (/^\s*(?:javascript|data):/i.test(value)) {
          issue(`Unsafe URL in ${name} attribute.`)
          continue
        }
        const isContainerData = (tag === 'div' || tag === 'ins') && name.startsWith('data-')
        if (!allowed.has(name) && !isContainerData) {
          issue(`Attribute ${name} is not allowed on <${tag}>.`)
          continue
        }
        if (name === 'style') {
          const parsedStyle = safeStyle(value)
          if (!parsedStyle.valid) issue('Style contains a property or value that is not allowed.')
          if (parsedStyle.value) retained.push({ ...attr, value: parsedStyle.value })
          continue
        }
        if ((tag === 'iframe' || tag === 'script') && name === 'src') {
          const src = normalizedNetworkUrl(value)
          if (!src) {
            issue(`The <${tag}> src must be an HTTPS or protocol-relative URL without credentials.`)
            continue
          }
          retained.push({ ...attr, value: src })
          if (tag === 'iframe') {
            width ??= size(element.attrs.find((item) => item.name === 'width')?.value)
            height ??= size(element.attrs.find((item) => item.name === 'height')?.value)
            const aaId = element.attrs.find((item) => item.name === 'data-aa')?.value
            const aadsHost = new URL(src).hostname.toLowerCase()
            const aadsPathId = (aadsHost === 'a-ads.com' || aadsHost.endsWith('.a-ads.com')) ? new URL(src).pathname.match(/\/(\d+)(?:\/|$)/)?.[1] : undefined
            unitId ??= aaId?.match(/^\d{3,12}$/) ? aaId : aadsPathId
          }
          continue
        }
        if (tag === 'script' && name === 'type' && value.toLowerCase() !== 'text/javascript') {
          issue('Script type must be text/javascript.')
          continue
        }
        retained.push(attr)
      }
      element.attrs = retained
      if (tag === 'iframe' && !retained.some((attr) => attr.name === 'src')) issue('Iframe requires an HTTPS or protocol-relative src URL.')

      if (tag === 'script') {
        const srcAttr = retained.find((attr) => attr.name === 'src')
        if (!srcAttr) {
          const body = element.childNodes.map((child) => 'value' in child ? child.value : '').join('')
          const options = inlineOptions(body)
          if (!options) issue('Inline scripts must contain only a single atOptions object assignment with literal values.')
          else {
            if (typeof options.width === 'number') width ??= options.width
            if (typeof options.height === 'number') height ??= options.height
          }
        }
      }

      if (tag === 'div' || tag === 'ins' || tag === 'noscript') cleanChildren(element)
      index += 1
    }
  }

  cleanChildren(fragment)
  if (scriptAndIframeCount > 4) {
    let remaining = 4
    const cap = (parent: ParentNode) => {
      for (let index = 0; index < parent.childNodes.length;) {
        const node = parent.childNodes[index]
        if ('tagName' in node) {
          const element = node as ElementNode
          if (element.tagName === 'script' || element.tagName === 'iframe') {
            remaining -= 1
            if (remaining < 0) {
              parent.childNodes.splice(index, 1)
              continue
            }
          }
          if (element.tagName === 'div' || element.tagName === 'ins' || element.tagName === 'noscript') cap(element)
        }
        index += 1
      }
    }
    cap(fragment)
  }

  return { ok: issues.length === 0, issues, html: serialize(fragment), ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}), ...(unitId ? { unitId } : {}) }
}
