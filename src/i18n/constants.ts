/**
 * Locale metadata for Text Brush.
 *
 * `SUPPORTED_LOCALES` drives both the language dropdown and the built-in-default
 * detection (`colorsAreBuiltinDefaults` checks names against every shipped locale).
 */

import type { Locale, LangSetting } from './types';

export interface LocaleInfo {
    code: Locale;
    /** Endonym — shown in the dropdown so it stays recognizable in any UI language. */
    name: string;
    englishName: string;
    flag: string;
}

/** Every concrete locale we ship, in dropdown order. */
export const SUPPORTED_LOCALES: LocaleInfo[] = [
    { code: 'en', name: 'English', englishName: 'English', flag: '🇺🇸' },
    { code: 'zh-CN', name: '简体中文', englishName: 'Simplified Chinese', flag: '🇨🇳' },
    { code: 'zh-TW', name: '繁體中文', englishName: 'Traditional Chinese', flag: '🇹🇼' },
    { code: 'ja', name: '日本語', englishName: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', englishName: 'Korean', flag: '🇰🇷' },
    { code: 'de', name: 'Deutsch', englishName: 'German', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', englishName: 'French', flag: '🇫🇷' },
    { code: 'es', name: 'Español', englishName: 'Spanish', flag: '🇪🇸' },
    { code: 'ru', name: 'Русский', englishName: 'Russian', flag: '🇷🇺' },
    { code: 'pt', name: 'Português', englishName: 'Portuguese', flag: '🇵🇹' },
];

/** All concrete locale codes (no `auto`). */
export const SUPPORTED_LOCALE_CODES: Locale[] = SUPPORTED_LOCALES.map((l) => l.code);

/** Find metadata for a locale code. */
export function getLocaleInfo(locale: Locale): LocaleInfo {
    return SUPPORTED_LOCALES.find((l) => l.code === locale) ?? SUPPORTED_LOCALES[0];
}

/** Native display name, e.g. `日本語` for `ja`. */
export function getLocaleDisplayName(locale: Locale): string {
    return getLocaleInfo(locale).name;
}

/**
 * Options for the language dropdown. `auto` follows Obsidian's UI language;
 * the rest are concrete locales shown as endonyms.
 */
export const LANGUAGE_OPTIONS: { value: LangSetting; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    ...SUPPORTED_LOCALES.map((l) => ({ value: l.code as LangSetting, label: l.name })),
];
