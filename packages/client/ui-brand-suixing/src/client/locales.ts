/** `suixing-brand` namespace: brand copy owned by the SuiXing distribution. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'suixing-brand'

/**
 * The product name is a proper noun, so both dictionaries carry it verbatim —
 * the same treatment `open-in-app` gives third-party application names. The
 * sidebar's brand-name seat deliberately supplies no translate seat of its own;
 * this namespace is what puts the name behind the typed `t` seat instead of a
 * literal in presentation code.
 */
const PRODUCT_NAME = {
  'brand.name': 'SuiXing',
} as const

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  ...PRODUCT_NAME,
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<SuiXingBrandKey, string> = {
  ...PRODUCT_NAME,
}

/** Key domain of the `suixing-brand` namespace (zh is the source of truth). */
export type SuiXingBrandKey = keyof typeof zh
