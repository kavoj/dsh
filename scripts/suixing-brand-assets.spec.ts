import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FAVICON_HREF,
  SUIXING_FAVICON_LINK,
  SUIXING_LOGO_PUBLIC_PATH,
  SUIXING_LOGO_REPOSITORY_PATH,
  SUIXING_LOGO_VECTOR_PATH,
  applySuixingDocumentIcon,
  readSuixingLogo,
  suixingWebAppManifest,
} from './suixing-brand-assets.ts'

const root = resolve(import.meta.dirname, '..')

/** Source form of the icon link, exactly as apps/web/index.html declares it. */
const SOURCE_FAVICON_LINK = `<link rel="icon" type="image/svg+xml" href="${DEFAULT_FAVICON_HREF}" />`

/** Vite re-serializes the parsed shell, dropping the self-closing slash. */
const SERIALIZED_FAVICON_LINK = `<link rel="icon" type="image/svg+xml" href="${DEFAULT_FAVICON_HREF}">`

/** Extract the base64 logo payload embedded in the SuiXing brand component. */
function embeddedLogoBase64(): string {
  const source = readFileSync(
    resolve(root, 'packages/client/ui-brand-suixing/src/client/Brand.tsx'),
    'utf8',
  )
  const match = source.match(/SUIXING_LOGO = 'data:image\/png;base64,([A-Za-z0-9+/=]+)'/)
  if (match === null) throw new Error('Brand.tsx no longer embeds a base64 PNG logo')
  return match[1]!
}

describe('suixing brand assets', () => {
  it('keeps the embedded Brand.tsx logo byte-identical to the shared asset file', () => {
    const embedded = Buffer.from(embeddedLogoBase64(), 'base64')
    expect(readSuixingLogo(root).equals(embedded)).toBe(true)
  })

  it('replaces the favicon link for suixing builds in both HTML serializations', () => {
    for (const link of [SOURCE_FAVICON_LINK, SERIALIZED_FAVICON_LINK]) {
      const html = `<!doctype html><head><title>SuiXing</title>${link}</head>`
      expect(applySuixingDocumentIcon(html, 'suixing')).toBe(
        `<!doctype html><head><title>SuiXing</title>${SUIXING_FAVICON_LINK}</head>`,
      )
    }
  })

  it('matches the real apps/web/index.html shell', () => {
    const shell = readFileSync(resolve(root, 'apps/web/index.html'), 'utf8')
    expect(applySuixingDocumentIcon(shell, 'suixing')).toContain(SUIXING_FAVICON_LINK)
  })

  it('leaves every other profile untouched', () => {
    const html = `<head>${SOURCE_FAVICON_LINK}</head>`
    for (const profile of [undefined, 'official', 'local']) {
      expect(applySuixingDocumentIcon(html, profile)).toBe(html)
    }
  })

  it('fails loudly when the index shell loses the default favicon link', () => {
    expect(() => applySuixingDocumentIcon('<head></head>', 'suixing'))
      .toThrow(/missing the default favicon link/)
  })

  it('serves the logo and names SuiXing in the web-app manifest', () => {
    const manifest = suixingWebAppManifest()
    expect(manifest.name).toBe('SuiXing')
    expect(manifest.short_name).toBe('SuiXing')
    expect(manifest.icons).toEqual([
      {
        src: SUIXING_LOGO_PUBLIC_PATH,
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
    ])
  })

  it('declares a manifest size that matches the shipped bitmap', () => {
    const buffer = readFileSync(resolve(root, SUIXING_LOGO_REPOSITORY_PATH))
    // IHDR width/height sit right after the 8-byte signature and 8-byte header.
    const declared = suixingWebAppManifest().icons as { sizes: string }[]
    expect(declared[0]!.sizes).toBe(`${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`)
  })

  it('ships the vector master the bitmap was exported from', () => {
    const svg = readFileSync(resolve(root, SUIXING_LOGO_VECTOR_PATH), 'utf8')
    expect(svg.startsWith('<svg ')).toBe(true)
    // The mark lives on the original 108px artboard, so the vector scales from it.
    expect(svg).toContain('viewBox="0 0 108 108"')
  })

  it('points the manifest at a real PNG inside the repository', () => {
    const assetPath = resolve(root, SUIXING_LOGO_REPOSITORY_PATH)
    const header = readFileSync(assetPath).subarray(0, 8)
    // PNG magic bytes, so a stray non-image can never masquerade as the logo.
    expect([...header]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  })
})
