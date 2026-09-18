/** Resolve the product identity packaged into one release, defaulting to the upstream brand. */

import { accessSync, constants, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Product name packaged when no release setting selects another brand. */
export const DEFAULT_DESKTOP_PRODUCT_NAME = 'DeepSeek Harness'

/** Artifact slug used in package filenames when no release setting selects another brand. */
export const DEFAULT_DESKTOP_ARTIFACT_SLUG = 'deepseek-harness'

/** Client build profile that selects the bundled SuiXing brand. */
export const SUIXING_CLIENT_BUILD_PROFILE = 'suixing'

/** Product name packaged for the SuiXing distribution. */
export const SUIXING_DESKTOP_PRODUCT_NAME = 'SuiXing'

/** Environment variable carrying the client build profile that selects the default identity. */
export const CLIENT_BUILD_PROFILE_ENV = 'DSH_CLIENT_BUILD_PROFILE'

/** Environment variable that overrides the packaged product name. */
export const DESKTOP_PRODUCT_NAME_ENV = 'DSH_DESKTOP_PRODUCT_NAME'

/** Environment variable that overrides the artifact slug used in package filenames. */
export const DESKTOP_ARTIFACT_SLUG_ENV = 'DSH_DESKTOP_ARTIFACT_SLUG'

/** Environment variable that supplies an alternative application icon directory. */
export const DESKTOP_ICON_DIRECTORY_ENV = 'DSH_DESKTOP_ICON_DIRECTORY'

/**
 * File names one application icon directory must provide.
 *
 * The Windows executable and installer take a multi-resolution .ico so the
 * shell can pick a crisp frame per context; the About-panel and taskbar bitmap
 * reuses the Windows PNG artwork, so it carries no separate file name.
 */
export const DESKTOP_ICON_FILES = Object.freeze({
  macOS: 'icon-macos.png',
  windows: 'icon.ico',
  bundled: 'icon-windows.png',
})

/** Repository file carrying the license every distribution ships under. */
export const LICENSE_FILE_NAME = 'LICENSE'

/** Repository file carrying the generated third-party notices. */
export const NOTICES_FILE_NAME = 'THIRD_PARTY_NOTICES.md'

/** Line a derived distribution shows in the native About panel. */
export const DERIVED_ATTRIBUTION = `Built on DeepSeek Harness (DSH), MIT-licensed, Copyright (c) 2026 DeepSeek. Third-party notices ship in ${NOTICES_FILE_NAME}.`

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const REPOSITORY_ROOT = resolve(APP_ROOT, '..', '..')
const DEFAULT_ICON_DIRECTORY = join(APP_ROOT, 'resources')
const ARTIFACT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
/** Characters no platform accepts inside a packaged application name. */
const RESERVED_NAME_PATTERN = /[\u0000-\u001F/\\:*?"<>|]/u

/** Read one optional setting, treating an empty value as absent. */
function optionalValue(environment, name) {
  const value = environment[name]?.trim()
  return value === undefined || value === '' ? undefined : value
}

/**
 * Derive the package-filename slug of one product name.
 * @param {string} productName - Product name without surrounding whitespace.
 * @returns {string} Lowercase hyphen-joined slug, for example `sui-xing` for `Sui Xing`.
 */
export function desktopArtifactSlug(productName) {
  return productName.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
}

/**
 * Build the electron-builder artifact-name template for one slug.
 * @param {string} artifactSlug - Validated lowercase artifact slug.
 * @returns {string} Template carrying electron-builder's version, os, arch, and extension macros.
 */
export function desktopArtifactNameTemplate(artifactSlug) {
  return `${artifactSlug}-\${version}-\${os}-\${arch}.\${ext}`
}

/**
 * Build the artifact basename electron-builder produces on one platform.
 * @param {{ artifactSlug: string }} identity - Resolved product identity.
 * @param {string} version - Release version packaged into the artifacts.
 * @param {string} os - electron-builder platform name, one of `mac`, `win`, or `linux`.
 * @param {string} arch - Target architecture.
 * @returns {string} Artifact basename without its extension.
 */
export function desktopArtifactBasename(identity, version, os, arch) {
  return `${identity.artifactSlug}-${version}-${os}-${arch}`
}

/** Reject a product name that cannot become an application name on every supported platform. */
function requireProductName(productName, source) {
  if (RESERVED_NAME_PATTERN.test(productName) || productName === '.' || productName === '..'
    || productName.endsWith(' ') || productName.endsWith('.')) {
    throw new Error(`desktop product: ${source} ${JSON.stringify(productName)} cannot name an installed application`)
  }
  return productName
}

/** Reject an artifact slug that would produce filenames other release tooling cannot reconstruct. */
function requireArtifactSlug(artifactSlug) {
  if (!ARTIFACT_SLUG_PATTERN.test(artifactSlug)) {
    throw new Error(`desktop product: ${DESKTOP_ARTIFACT_SLUG_ENV} must be lowercase alphanumeric words joined by single hyphens; got ${JSON.stringify(artifactSlug)}`)
  }
  return artifactSlug
}

/** Report whether one path is a readable regular file. */
function isReadableFile(path) {
  try {
    if (!statSync(path).isFile()) return false
    accessSync(path, constants.R_OK)
    return true
  }
  catch {
    return false
  }
}

/** Resolve the icon directory, refusing to ship upstream artwork under another product name. */
function requireIconDirectory(environment, productName) {
  const configured = optionalValue(environment, DESKTOP_ICON_DIRECTORY_ENV)
  if (configured === undefined) {
    if (productName !== DEFAULT_DESKTOP_PRODUCT_NAME) {
      throw new Error(`desktop product: ${DESKTOP_PRODUCT_NAME_ENV} ${JSON.stringify(productName)} also requires ${DESKTOP_ICON_DIRECTORY_ENV} so upstream artwork never ships under another name`)
    }
    return DEFAULT_ICON_DIRECTORY
  }
  const directory = isAbsolute(configured) ? configured : resolve(APP_ROOT, configured)
  for (const file of new Set(Object.values(DESKTOP_ICON_FILES))) {
    const path = join(directory, file)
    if (!isReadableFile(path)) {
      throw new Error(`desktop product: ${DESKTOP_ICON_DIRECTORY_ENV} must contain a readable ${file}; ${path} is not a readable file`)
    }
  }
  return directory
}

/**
 * Resolve the attribution a derived distribution must carry.
 *
 * The upstream product attributes nothing to itself: its own About panel and
 * release bytes stay exactly as published. Any other product name ships the
 * license and the generated third-party notices beside the runtime and names
 * its lineage, so a derived distribution can never present upstream work as
 * its own.
 *
 * @param {string} productName - Resolved product name.
 * @returns {{ attributionMetadata: Record<string, string>, attributionResources: { from: string, to: string }[] }} Manifest metadata and packaged attribution files; both empty for the upstream identity.
 */
function resolveAttribution(productName) {
  if (productName === DEFAULT_DESKTOP_PRODUCT_NAME) return { attributionMetadata: {}, attributionResources: [] }
  const attributionResources = [LICENSE_FILE_NAME, NOTICES_FILE_NAME].map(file => ({
    from: join(REPOSITORY_ROOT, file), to: file,
  }))
  for (const { from } of attributionResources) {
    if (!isReadableFile(from)) {
      throw new Error(`desktop product: a derived distribution must ship ${from}; the release cannot attribute upstream work without it`)
    }
  }
  return {
    attributionMetadata: { dshDesktopProductName: productName, dshDesktopAttribution: DERIVED_ATTRIBUTION },
    attributionResources,
  }
}

/**
 * Resolve the product identity packaged into one release.
 *
 * An explicit product name wins over the client build profile, and the profile
 * wins over the upstream default. An explicit artifact slug always wins, so a
 * brand whose name cannot slugify to its published filenames stays correct.
 *
 * @param {NodeJS.ProcessEnv} environment - Packaging environment.
 * @returns {{ productName: string, artifactSlug: string, artifactName: string, iconDirectory: string, iconMacOS: string, iconWindows: string, iconBundled: string, attributionMetadata: Record<string, string>, attributionResources: { from: string, to: string }[] }} Complete packaged identity.
 */
export function resolveDesktopProductIdentity(environment = process.env) {
  const configuredName = optionalValue(environment, DESKTOP_PRODUCT_NAME_ENV)
  const suixingProfile = optionalValue(environment, CLIENT_BUILD_PROFILE_ENV) === SUIXING_CLIENT_BUILD_PROFILE
  const productName = configuredName === undefined
    ? (suixingProfile ? SUIXING_DESKTOP_PRODUCT_NAME : DEFAULT_DESKTOP_PRODUCT_NAME)
    : requireProductName(configuredName, DESKTOP_PRODUCT_NAME_ENV)
  const configuredSlug = optionalValue(environment, DESKTOP_ARTIFACT_SLUG_ENV)
  const artifactSlug = configuredSlug === undefined
    ? requireArtifactSlug(desktopArtifactSlug(productName))
    : requireArtifactSlug(configuredSlug)
  const iconDirectory = requireIconDirectory(environment, productName)
  return {
    productName,
    artifactSlug,
    artifactName: desktopArtifactNameTemplate(artifactSlug),
    iconDirectory,
    iconMacOS: join(iconDirectory, DESKTOP_ICON_FILES.macOS),
    iconWindows: join(iconDirectory, DESKTOP_ICON_FILES.windows),
    iconBundled: join(iconDirectory, DESKTOP_ICON_FILES.bundled),
    ...resolveAttribution(productName),
  }
}
