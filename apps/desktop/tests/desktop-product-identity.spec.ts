import { copyFileSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CLIENT_BUILD_PROFILE_ENV,
  DEFAULT_DESKTOP_ARTIFACT_SLUG,
  DEFAULT_DESKTOP_PRODUCT_NAME,
  DESKTOP_ARTIFACT_SLUG_ENV,
  DESKTOP_ICON_DIRECTORY_ENV,
  DESKTOP_ICON_FILES,
  DESKTOP_PRODUCT_NAME_ENV,
  LICENSE_FILE_NAME,
  NOTICES_FILE_NAME,
  SUIXING_DESKTOP_PRODUCT_NAME,
  desktopArtifactBasename,
  desktopArtifactNameTemplate,
  desktopArtifactSlug,
  resolveDesktopProductIdentity,
} from '../scripts/desktop-product-identity.mjs'

const RESOURCES = fileURLToPath(new URL('../resources', import.meta.url))
const DEFAULT_MACOS_ICON = fileURLToPath(new URL('../resources/icon-macos.png', import.meta.url))
const DEFAULT_WINDOWS_ICON = fileURLToPath(new URL('../resources/icon.ico', import.meta.url))
const DEFAULT_BUNDLED_ICON = fileURLToPath(new URL('../resources/icon-windows.png', import.meta.url))
const ICON_FILE_NAMES = [...new Set(Object.values(DESKTOP_ICON_FILES))]

/** Release settings the builder needs before it reaches the identity it packages. */
const RELEASE = {
  DSH_DESKTOP_APP_ID: 'com.example.desktop',
  DSH_DESKTOP_MANDATORY_UPDATE_TEST_ORIGIN: 'https://policy.example.com',
  DSH_DESKTOP_TARGET_PLATFORM: 'win32',
  DSH_DESKTOP_TARGET_ARCH: 'x64',
  DSH_DESKTOP_UNSIGNED: '1',
}

/** Create a directory holding the named subset of one complete icon set. */
async function withIcons(skip: string | undefined, action: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'desktop-brand-'))
  try {
    for (const file of ICON_FILE_NAMES) {
      if (file !== skip) copyFileSync(join(RESOURCES, file), join(directory, file))
    }
    await action(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('desktop product identity', () => {
  it('packages the upstream brand when no release setting selects another one', () => {
    const identity = resolveDesktopProductIdentity({})
    expect(identity.productName).toBe(DEFAULT_DESKTOP_PRODUCT_NAME)
    expect(identity.artifactSlug).toBe(DEFAULT_DESKTOP_ARTIFACT_SLUG)
    expect(identity.artifactName).toBe('deepseek-harness-${version}-${os}-${arch}.${ext}')
    expect(identity.iconDirectory).toBe(RESOURCES)
    expect(identity.iconMacOS).toBe(DEFAULT_MACOS_ICON)
    expect(identity.iconWindows).toBe(DEFAULT_WINDOWS_ICON)
    expect(identity.iconBundled).toBe(DEFAULT_BUNDLED_ICON)
  })

  it('keeps the documented default slug equal to the slug its product name derives', () => {
    expect(desktopArtifactSlug(DEFAULT_DESKTOP_PRODUCT_NAME)).toBe(DEFAULT_DESKTOP_ARTIFACT_SLUG)
    expect(desktopArtifactSlug(SUIXING_DESKTOP_PRODUCT_NAME)).toBe('suixing')
    expect(desktopArtifactSlug('  Sui Xing  ')).toBe('sui-xing')
    expect(desktopArtifactNameTemplate('sui-xing')).toBe('sui-xing-${version}-${os}-${arch}.${ext}')
  })

  it('derives the artifact basename that release tooling reconstructs from a packaged file', () => {
    const branded = resolveDesktopProductIdentity({ [DESKTOP_PRODUCT_NAME_ENV]: 'SuiXing',
      [DESKTOP_ICON_DIRECTORY_ENV]: RESOURCES })
    expect(desktopArtifactBasename(branded, '1.2.3', 'mac', 'arm64')).toBe('suixing-1.2.3-mac-arm64')
    expect(desktopArtifactBasename(branded, '1.2.3', 'win', 'x64')).toBe('suixing-1.2.3-win-x64')
    expect(desktopArtifactBasename(resolveDesktopProductIdentity({}), '1.2.3', 'win', 'x64'))
      .toBe('deepseek-harness-1.2.3-win-x64')
  })

  it('selects the SuiXing identity for the bundled profile and still demands its own artwork', () => {
    expect(() => resolveDesktopProductIdentity({ [CLIENT_BUILD_PROFILE_ENV]: 'suixing' }))
      .toThrow(/DSH_DESKTOP_ICON_DIRECTORY/u)
    const identity = resolveDesktopProductIdentity({ [CLIENT_BUILD_PROFILE_ENV]: 'suixing',
      [DESKTOP_ICON_DIRECTORY_ENV]: RESOURCES })
    expect(identity.productName).toBe(SUIXING_DESKTOP_PRODUCT_NAME)
    expect(identity.artifactSlug).toBe('suixing')
  })

  it('leaves every other profile on the upstream identity', () => {
    for (const profile of [undefined, '', 'official', 'local']) {
      const identity = resolveDesktopProductIdentity({ [CLIENT_BUILD_PROFILE_ENV]: profile })
      expect(identity.productName).toBe(DEFAULT_DESKTOP_PRODUCT_NAME)
      expect(identity.artifactSlug).toBe(DEFAULT_DESKTOP_ARTIFACT_SLUG)
    }
  })

  it('lets an explicit product name and slug override the selected profile', () => {
    const identity = resolveDesktopProductIdentity({ [CLIENT_BUILD_PROFILE_ENV]: 'suixing',
      [DESKTOP_PRODUCT_NAME_ENV]: ' Acme Desk ',
      [DESKTOP_ARTIFACT_SLUG_ENV]: 'acme-desktop',
      [DESKTOP_ICON_DIRECTORY_ENV]: RESOURCES })
    expect(identity.productName).toBe('Acme Desk')
    expect(identity.artifactSlug).toBe('acme-desktop')
    expect(resolveDesktopProductIdentity({ [DESKTOP_PRODUCT_NAME_ENV]: 'Acme Desk',
      [DESKTOP_ICON_DIRECTORY_ENV]: RESOURCES }).artifactSlug).toBe('acme-desk')
  })

  it.each(['Deep/Seek', 'Deep\\Seek', 'Deep:Seek', 'Deep*Seek', 'Deep?Seek', 'Deep"Seek', 'Deep<Seek',
    'Deep>Seek', 'Deep|Seek', 'Deep\u0007Seek', 'SuiXing.', '.', '..'])(
    'refuses the product name %j that cannot name an installed application', (productName) => {
      expect(() => resolveDesktopProductIdentity({ [DESKTOP_PRODUCT_NAME_ENV]: productName,
        [DESKTOP_ICON_DIRECTORY_ENV]: RESOURCES })).toThrow(/cannot name an installed application/u)
    })

  it.each(['Suixing', 'sui xing', 'sui--xing', '-sui', 'sui-', 'sui_xing', 'sui_xing!'])(
    'refuses the artifact slug %j that release tooling cannot reconstruct', (artifactSlug) => {
      expect(() => resolveDesktopProductIdentity({ [DESKTOP_ARTIFACT_SLUG_ENV]: artifactSlug }))
        .toThrow(/lowercase alphanumeric words/u)
    })

  it('requires a branded build to supply its own icon artwork', () => {
    expect(() => resolveDesktopProductIdentity({ [DESKTOP_PRODUCT_NAME_ENV]: 'SuiXing' }))
      .toThrow(/upstream artwork never ships under another name/u)
  })

  it('resolves a relative icon directory against the desktop application', async () => {
    expect(resolveDesktopProductIdentity({ [DESKTOP_ICON_DIRECTORY_ENV]: 'resources' }).iconDirectory)
      .toBe(RESOURCES)
    await withIcons(undefined, async (directory) => {
      const branded = resolveDesktopProductIdentity({ [DESKTOP_PRODUCT_NAME_ENV]: 'SuiXing',
        [DESKTOP_ICON_DIRECTORY_ENV]: directory })
      expect(branded.iconMacOS).toBe(join(directory, DESKTOP_ICON_FILES.macOS))
      expect(branded.iconWindows).toBe(join(directory, DESKTOP_ICON_FILES.windows))
      expect(branded.iconBundled).toBe(join(directory, DESKTOP_ICON_FILES.bundled))
    })
  })

  it.each(ICON_FILE_NAMES)('refuses an icon directory missing %s', async (missing) => {
    await withIcons(missing, async (directory) => {
      expect(() => resolveDesktopProductIdentity({ [DESKTOP_PRODUCT_NAME_ENV]: 'SuiXing',
        [DESKTOP_ICON_DIRECTORY_ENV]: directory }))
        .toThrow(new RegExp(`must contain a readable ${missing.replaceAll('.', '\\.')}`, 'u'))
    })
  })

  it('attributes nothing to itself for the upstream identity', () => {
    const identity = resolveDesktopProductIdentity({})
    expect(identity.attributionMetadata).toEqual({})
    expect(identity.attributionResources).toEqual([])
  })

  it('names its upstream lineage and ships the licenses a derived distribution owes', () => {
    const identity = resolveDesktopProductIdentity({ [DESKTOP_PRODUCT_NAME_ENV]: 'SuiXing',
      [DESKTOP_ICON_DIRECTORY_ENV]: RESOURCES })
    expect(identity.attributionMetadata.dshDesktopProductName).toBe('SuiXing')
    const attribution = identity.attributionMetadata.dshDesktopAttribution ?? ''
    expect(attribution).not.toBe('')
    for (const fact of ['DeepSeek Harness', 'DSH', 'MIT', 'Copyright (c) 2026 DeepSeek', NOTICES_FILE_NAME]) {
      expect(attribution).toContain(fact)
    }
    expect(identity.attributionResources.map(resource => resource.to)).toEqual([LICENSE_FILE_NAME, NOTICES_FILE_NAME])
    for (const resource of identity.attributionResources) {
      expect(resource.from.endsWith(resource.to)).toBe(true)
      expect(readFileSync(resource.from).length).toBeGreaterThan(0)
    }
  })
})

describe('desktop builder configuration identity', () => {
  it('keeps the default release bytes when no brand setting is present', async () => {
    const { createElectronBuilderConfig } = await import('../scripts/electron-builder-config.mjs')
    const config = createElectronBuilderConfig(RELEASE, 'win32', 'x64')
    expect(config.productName).toBe(DEFAULT_DESKTOP_PRODUCT_NAME)
    expect(config.artifactName).toBe('deepseek-harness-${version}-${os}-${arch}.${ext}')
    expect(config.mac.icon).toBe(DEFAULT_MACOS_ICON)
    expect(config.win.icon).toBe(DEFAULT_WINDOWS_ICON)
    expect(config.extraResources.find(resource => resource.to === 'icon.png'))
      .toEqual({ from: DEFAULT_BUNDLED_ICON, to: 'icon.png' })
    // The upstream product attributes nothing to itself: its About panel and
    // manifest carry exactly the fields it published before brand support.
    expect(Object.keys(config.extraMetadata).sort()).toEqual(['dshDesktopAppId', 'dshMandatoryUpdatePolicy'])
    expect(config.extraResources.map(resource => resource.to)).toEqual(['runtime', 'icon.png'])
  })

  it('packages the branded name, filenames, icons, and upstream attribution together', async () => {
    await withIcons(undefined, async (directory) => {
      const { createElectronBuilderConfig } = await import('../scripts/electron-builder-config.mjs')
      const config = createElectronBuilderConfig({ ...RELEASE, [DESKTOP_PRODUCT_NAME_ENV]: 'SuiXing',
        [DESKTOP_ICON_DIRECTORY_ENV]: directory }, 'win32', 'x64')
      expect(config.productName).toBe('SuiXing')
      expect(config.artifactName).toBe('suixing-${version}-${os}-${arch}.${ext}')
      expect(config.mac.icon).toBe(join(directory, DESKTOP_ICON_FILES.macOS))
      expect(config.win.icon).toBe(join(directory, DESKTOP_ICON_FILES.windows))
      expect(config.extraResources.find(resource => resource.to === 'icon.png'))
        .toEqual({ from: join(directory, DESKTOP_ICON_FILES.bundled), to: 'icon.png' })
      expect(config.extraMetadata).toMatchObject({
        dshDesktopProductName: 'SuiXing',
        dshDesktopAttribution: expect.stringContaining('DeepSeek Harness'),
      })
      expect(config.extraResources.map(resource => resource.to)).toEqual(
        ['runtime', 'icon.png', LICENSE_FILE_NAME, NOTICES_FILE_NAME])
      // Icons and attribution ship from the checkout, so each path must resolve;
      // only the runtime resource comes from the target's preparation state.
      for (const resource of config.extraResources.filter(entry => entry.to !== 'runtime')) {
        expect(readFileSync(resource.from).length).toBeGreaterThan(0)
      }
    })
  })

  it('refuses to build a branded release from the release environment alone', async () => {
    const { createElectronBuilderConfig } = await import('../scripts/electron-builder-config.mjs')
    expect(() => createElectronBuilderConfig({ ...RELEASE, [CLIENT_BUILD_PROFILE_ENV]: 'suixing' }, 'win32', 'x64'))
      .toThrow(/DSH_DESKTOP_ICON_DIRECTORY/u)
  })
})
