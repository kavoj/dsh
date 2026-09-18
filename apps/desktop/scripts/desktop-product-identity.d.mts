/** Resolve the product identity packaged into one release, defaulting to the upstream brand. */

/** Product name packaged when no release setting selects another brand. */
export const DEFAULT_DESKTOP_PRODUCT_NAME: 'DeepSeek Harness'

/** Artifact slug used in package filenames when no release setting selects another brand. */
export const DEFAULT_DESKTOP_ARTIFACT_SLUG: 'deepseek-harness'

/** Client build profile that selects the bundled SuiXing brand. */
export const SUIXING_CLIENT_BUILD_PROFILE: 'suixing'

/** Product name packaged for the SuiXing distribution. */
export const SUIXING_DESKTOP_PRODUCT_NAME: 'SuiXing'

/** Environment variable carrying the client build profile that selects the default identity. */
export const CLIENT_BUILD_PROFILE_ENV: 'DSH_CLIENT_BUILD_PROFILE'

/** Environment variable that overrides the packaged product name. */
export const DESKTOP_PRODUCT_NAME_ENV: 'DSH_DESKTOP_PRODUCT_NAME'

/** Environment variable that overrides the artifact slug used in package filenames. */
export const DESKTOP_ARTIFACT_SLUG_ENV: 'DSH_DESKTOP_ARTIFACT_SLUG'

/** Environment variable that supplies an alternative application icon directory. */
export const DESKTOP_ICON_DIRECTORY_ENV: 'DSH_DESKTOP_ICON_DIRECTORY'

/** File names one application icon directory must provide. */
export const DESKTOP_ICON_FILES: Readonly<{
  readonly macOS: 'icon-macos.png'
  readonly windows: 'icon.ico'
  readonly bundled: 'icon-windows.png'
}>

/** Repository file carrying the license every distribution ships under. */
export const LICENSE_FILE_NAME: 'LICENSE'

/** Repository file carrying the generated third-party notices. */
export const NOTICES_FILE_NAME: 'THIRD_PARTY_NOTICES.md'

/** Line a derived distribution shows in the native About panel. */
export const DERIVED_ATTRIBUTION: string

/** One repository file distributed beside the packaged runtime. */
export interface DesktopAttributionResource {
  /** Absolute source path inside the checkout. */
  readonly from: string
  /** Destination file name inside the application resources. */
  readonly to: string
}

/** Product identity packaged into one release. */
export interface DesktopProductIdentity {
  /** Installed application name. */
  readonly productName: string
  /** Slug shared by every published package filename. */
  readonly artifactSlug: string
  /** electron-builder artifact-name template. */
  readonly artifactName: string
  /** Directory holding the application icon set. */
  readonly iconDirectory: string
  /** macOS bundle icon. */
  readonly iconMacOS: string
  /** Windows executable icon. */
  readonly iconWindows: string
  /** Icon distributed beside the packaged runtime for the About panel and taskbar. */
  readonly iconBundled: string
  /** Manifest fields the native shell reads for a derived product; empty for the upstream identity. */
  readonly attributionMetadata: Readonly<Record<string, string>>
  /** Attribution files a derived distribution ships; empty for the upstream identity. */
  readonly attributionResources: readonly DesktopAttributionResource[]
}

/**
 * Derive the package-filename slug of one product name.
 * @param productName - Product name without surrounding whitespace.
 * @returns Lowercase hyphen-joined slug, for example `sui-xing` for `Sui Xing`.
 */
export function desktopArtifactSlug(productName: string): string

/**
 * Build the electron-builder artifact-name template for one slug.
 * @param artifactSlug - Validated lowercase artifact slug.
 * @returns Template carrying electron-builder's version, os, arch, and extension macros.
 */
export function desktopArtifactNameTemplate(artifactSlug: string): string

/**
 * Build the artifact basename electron-builder produces on one platform.
 * @param identity - Resolved product identity.
 * @param version - Release version packaged into the artifacts.
 * @param os - electron-builder platform name, one of `mac`, `win`, or `linux`.
 * @param arch - Target architecture.
 * @returns Artifact basename without its extension.
 */
export function desktopArtifactBasename(
  identity: DesktopProductIdentity,
  version: string,
  os: string,
  arch: string,
): string

/**
 * Resolve the product identity packaged into one release.
 * @param environment - Packaging environment.
 * @returns Complete packaged identity.
 */
export function resolveDesktopProductIdentity(environment?: NodeJS.ProcessEnv): DesktopProductIdentity
