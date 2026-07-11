/**
 * i18n service for Text Brush.
 *
 * Supports 10 locales with English as the universal fallback. Unlike a
 * module-level singleton, the active locale is resolved per-call from the user
 * setting (which may be `auto` → follow Obsidian), so `t()` takes the resolved
 * locale explicitly. This keeps translation lookups in sync with the live
 * `settings.language` value without a separate `setLocale()` step.
 */

import * as de from './locales/de.json';
import * as en from './locales/en.json';
import * as es from './locales/es.json';
import * as fr from './locales/fr.json';
import * as ja from './locales/ja.json';
import * as ko from './locales/ko.json';
import * as pt from './locales/pt.json';
import * as ru from './locales/ru.json';
import * as zhCN from './locales/zh-CN.json';
import * as zhTW from './locales/zh-TW.json';

import type { LangSetting, Locale, TranslationKey, TranslationDict } from './types';

const translations: Record<Locale, TranslationDict> = {
    en,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    ja,
    ko,
    de,
    fr,
    es,
    ru,
    pt,
};

const DEFAULT_LOCALE: Locale = 'en';

/** Best-effort read of Obsidian's own UI language. Falls back to English. */
function detectObsidianLocale(): Locale {
    // Obsidian always updates moment's locale to match the user's language setting.
    let raw = '';
    try {
        raw = (activeWindow as unknown as { moment?: { locale?: () => string } }).moment?.locale?.() ?? '';
    } catch {
        // moment may be unavailable; try localStorage next.
    }
    if (!raw) {
        try {
            raw = activeWindow.localStorage.getItem('language') ?? '';
        } catch {
            // localStorage may be unavailable; fall through to the default.
        }
    }
    return matchLocale(raw);
}

/**
 * Map an arbitrary locale string (e.g. from `moment.locale()` or a stored
 * setting) to one of our supported locales. Falls back to English.
 */
export function matchLocale(raw: string): Locale {
    const lower = raw.toLowerCase();
    if (!lower) return DEFAULT_LOCALE;
    // Chinese variants: zh-TW / zh-HK → Traditional, zh-CN / zh → Simplified.
    if (lower.startsWith('zh')) {
        return lower.includes('tw') || lower.includes('hk') || lower.includes('hant') ? 'zh-TW' : 'zh-CN';
    }
    if (lower.startsWith('ja')) return 'ja';
    if (lower.startsWith('ko')) return 'ko';
    if (lower.startsWith('de')) return 'de';
    if (lower.startsWith('fr')) return 'fr';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('ru')) return 'ru';
    if (lower.startsWith('pt')) return 'pt';
    return DEFAULT_LOCALE;
}

/** Resolve a user setting (including `auto`) to a concrete locale. */
export function resolveLang(setting: LangSetting): Locale {
    // `setting` may be a legacy value read from disk (e.g. pre-1.0.5 `'zh'`),
    // so compare as a plain string before the typed lookup below.
    const raw = setting as string;
    if (raw === 'auto') return detectObsidianLocale();
    if (raw === 'zh') return 'zh-CN'; // backward compat: legacy simplified-Chinese code
    return raw in translations ? (raw as Locale) : DEFAULT_LOCALE;
}

/** Resolve a dot-path key against a locale dict, returning the raw value found. */
function lookup(dict: TranslationDict, key: string): unknown {
    const keys = key.split('.');
    let value: unknown = dict;
    for (const k of keys) {
        if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
            value = (value as Record<string, unknown>)[k];
        } else {
            return undefined;
        }
    }
    return value;
}

function interpolate(value: string, params?: Record<string, string | number>): string {
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (match, param: string) => {
        const replacement = params[param];
        return replacement !== undefined ? `${replacement}` : match;
    });
}

/**
 * Translate a dot-path key in the given locale, falling back to English when the
 * key is missing, and finally to the raw key string. `{param}` placeholders are
 * interpolated from `params`.
 */
export function t(key: TranslationKey, locale: Locale, params?: Record<string, string | number>): string {
    const value = lookup(translations[locale], key);
    if (typeof value === 'string') return interpolate(value, params);

    if (locale !== DEFAULT_LOCALE) {
        const fallback = lookup(translations[DEFAULT_LOCALE], key);
        if (typeof fallback === 'string') return interpolate(fallback, params);
    }
    return key;
}

/**
 * The full translation dict for a user setting. Used by consumers that need the
 * whole object (e.g. `getDefaultColors` reads `colors.names`).
 */
export function getTranslations(setting: LangSetting): TranslationDict {
    return translations[resolveLang(setting)];
}

/**
 * Look up a built-in color name by id in the given locale, falling back to
 * English then to the id itself.
 */
export function getColorName(id: string, setting: LangSetting): string {
    const locale = resolveLang(setting);
    const key = `colors.names.${id}` as TranslationKey;
    return t(key, locale);
}
