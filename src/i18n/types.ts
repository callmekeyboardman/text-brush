/**
 * i18n types for Text Brush.
 *
 * `TranslationKey` is derived from the English locale JSON, so any `t()` call
 * with an unknown dot-path key is a compile error.
 */

import type * as en from './locales/en.json';

/** Every concrete locale we ship translations for. */
export type Locale = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'ru' | 'pt';

/** What the user can pick in settings — a locale, or "follow Obsidian". */
export type LangSetting = 'auto' | Locale;

type DotJoin<Head extends string, Tail extends string> = `${Head}.${Tail}`;

type LeafKeys<T> = {
    [K in keyof T & string]: T[K] extends string
        ? K
        : T[K] extends Record<string, unknown>
            ? DotJoin<K, LeafKeys<T[K]>>
            : never;
}[keyof T & string];

/** Dot-path union of every translatable string leaf, e.g. `'menu.textColor'`. */
export type TranslationKey = LeafKeys<typeof en>;

/** The shape of a locale JSON file (inferred from the English source of truth). */
export type TranslationDict = typeof en;
