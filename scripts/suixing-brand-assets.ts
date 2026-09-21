/** SuiXing web brand assets: profile-gated favicon, manifest, and logo payload. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Repository-relative directory holding the product logo artwork. */
const SUIXING_BRAND_PACKAGE = 'packages/client/ui-brand-suixing'

/** Repository-relative path of the shipped 256px logo bitmap. */
export const SUIXING_LOGO_REPOSITORY_PATH = `${SUIXING_BRAND_PACKAGE}/assets/logo.png`

/** Repository-relative path of the vector master the bitmap is exported from. */
export const SUIXING_LOGO_VECTOR_PATH = `${SUIXING_BRAND_PACKAGE}/assets/logo.svg`

/** Public URL the built web app serves the SuiXing logo under. */
export const SUIXING_LOGO_PUBLIC_PATH = '/suixing-logo.png'

/** Icon link emitted by apps/web/index.html for the default distribution. */
export const DEFAULT_FAVICON_HREF = '/favicon.svg'

/** Icon link that replaces the default one in SuiXing builds. */
export const SUIXING_FAVICON_LINK = `<link rel="icon" type="image/png" href="${SUIXING_LOGO_PUBLIC_PATH}" />`

/** Title emitted by apps/web/index.html for the default distribution. */
export const DEFAULT_DOCUMENT_TITLE = 'DSH Local Build'

/** Title that replaces the default one in SuiXing builds. */
export const SUIXING_DOCUMENT_TITLE = 'SuiXing'

/** SuiXing title element substituted for the default one. */
const SUIXING_TITLE_ELEMENT = `<title>${SUIXING_DOCUMENT_TITLE}</title>`

/**
 * Vite serializes the parsed index.html before post transforms run, so the
 * title element's inner whitespace is not stable. Match the element by its
 * shape instead of exact text.
 */
const TITLE_ELEMENT_PATTERN = /<title>[^<]*<\/title>/

/**
 * Vite serializes the parsed index.html before post transforms run, so the
 * self-closing slash and attribute spacing of the source link are not
 * stable. Match the icon link by its attributes instead of exact text.
 */
const FAVICON_LINK_PATTERN = /<link\s+rel="icon"[^>]*>/

/** SuiXing web-app manifest mirroring the default manifest's structural fields. */
export function suixingWebAppManifest(): Record<string, unknown> {
  return {
    id: '/',
    name: 'SuiXing',
    short_name: 'SuiXing',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    icons: [
      {
        src: SUIXING_LOGO_PUBLIC_PATH,
        // The shipped bitmap is the 256px export of assets/logo.svg; declaring
        // anything larger would upscale it again.
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}

/**
 * Rewrite the document icon link for a SuiXing build, leaving every other
 * profile's HTML untouched.
 * @param html - the transformed index.html source.
 * @param buildProfile - value of DSH_CLIENT_BUILD_PROFILE for this build.
 * @returns HTML with the SuiXing icon link when building SuiXing.
 */
export function applySuixingDocumentIcon(html: string, buildProfile: string | undefined): string {
  if (buildProfile !== 'suixing') return html
  const pattern = new RegExp(FAVICON_LINK_PATTERN.source)
  if (!pattern.test(html)) {
    throw new Error('suixing brand: index.html is missing the default favicon link')
  }
  return html.replace(pattern, SUIXING_FAVICON_LINK)
}

/**
 * Rewrite the document title for a SuiXing build, leaving every other
 * profile's HTML untouched.
 * @param html - the transformed index.html source.
 * @param buildProfile - value of DSH_CLIENT_BUILD_PROFILE for this build.
 * @returns HTML with the SuiXing title element when building SuiXing.
 */
export function applySuixingDocumentTitle(html: string, buildProfile: string | undefined): string {
  if (buildProfile !== 'suixing') return html
  const pattern = new RegExp(TITLE_ELEMENT_PATTERN.source)
  if (!pattern.test(html)) {
    throw new Error('suixing brand: index.html is missing the document title element')
  }
  return html.replace(pattern, SUIXING_TITLE_ELEMENT)
}

/**
 * Read the shipped logo bitmap for embedding into one web build.
 * @param repositoryRoot - absolute path of the repository checkout.
 * @returns the exact bytes of the shipped logo PNG.
 */
export function readSuixingLogo(repositoryRoot: string): Buffer {
  return readFileSync(resolve(repositoryRoot, SUIXING_LOGO_REPOSITORY_PATH))
}
