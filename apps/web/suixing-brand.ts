/** Vite plugin that swaps web brand assets when building the SuiXing profile. */

import type { Plugin } from 'vite'
import {
  applySuixingDocumentIcon,
  applySuixingDocumentTitle,
  readSuixingLogo,
  suixingWebAppManifest,
} from '../../scripts/suixing-brand-assets.ts'

/** Public URL the built web app serves the SuiXing logo under. */
const SUIXING_LOGO_PUBLIC_PATH = '/suixing-logo.png'

/** Rewritten manifest filename inside the Vite output directory. */
const MANIFEST_FILE_NAME = 'manifest.webmanifest'

/**
 * Build a plugin that replaces the favicon link, web-app manifest, and logo
 * asset for SuiXing builds. Every other profile gets a no-op plugin, so the
 * default distribution keeps the upstream whale favicon and manifest.
 * @param repositoryRoot - absolute repository path used to read the logo.
 * @returns the SuiXing brand plugin (no-op outside the suixing profile).
 */
export function suixingBrandAssets(repositoryRoot: string): Plugin {
  const logo = readSuixingLogo(repositoryRoot)
  const manifest = `${JSON.stringify(suixingWebAppManifest(), null, 2)}\n`
  return {
    name: 'dsh-suixing-brand-assets',
    apply: 'build',
    transformIndexHtml(html) {
      const profile = process.env.DSH_CLIENT_BUILD_PROFILE
      return applySuixingDocumentTitle(applySuixingDocumentIcon(html, profile), profile)
    },
    generateBundle() {
      if (process.env.DSH_CLIENT_BUILD_PROFILE !== 'suixing') return
      // The public/ copy is emitted by Vite's public directory pass; emitting
      // the same fileName here replaces its content with the SuiXing one.
      this.emitFile({
        type: 'asset',
        fileName: MANIFEST_FILE_NAME,
        source: manifest,
      })
      this.emitFile({
        type: 'asset',
        fileName: SUIXING_LOGO_PUBLIC_PATH.slice(1),
        source: logo,
      })
    },
  }
}
