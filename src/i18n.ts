/**
 * Lightweight i18n for Text Brush.
 *
 * This module is self-contained (no imports from the rest of the plugin) so it
 * can be depended on freely without creating import cycles. All user-facing
 * strings — context menu items, tooltips, settings labels and the built-in
 * color names — live here.
 */

/** A concrete, translatable language. */
export type Lang = 'en' | 'zh';

/** What the user can pick in settings — a language, or "follow Obsidian". */
export type LangSetting = 'auto' | Lang;

/** Every concrete language we ship translations for. */
export const SUPPORTED_LANGS: Lang[] = ['en', 'zh'];

export interface Translations {
    // Editor context menu
    menuTextColor: string;
    menuTextSize: string;
    menuBold: string;
    menuClearColor: string;
    menuClearSize: string;

    // Settings — tab labels
    settingTabGeneral: string;
    settingTabColors: string;
    settingTabFonts: string;

    // Settings — language selector
    settingLanguageName: string;
    settingLanguageDesc: string;

    // Settings — colors section
    settingColorsHeading: string;
    settingColorsDesc: string;
    settingColorValuePlaceholder: string;
    settingAddColor: string;

    // Settings — font sizes section
    settingSizesHeading: string;
    settingSizesDesc: string;
    settingSizeValuePlaceholder: string;
    settingAddSize: string;

    // Settings — shared controls
    settingDisplayNamePlaceholder: string;
    settingDeleteTooltip: string;
    settingRestoreDefaults: string;

    // Defaults
    newColorName: string;
    /** Built-in color names keyed by color id. */
    colorNames: Record<string, string>;

    // Settings — hyperlink tab
    settingTabHyperlink: string;
    hyperlinkEnabled: string;
    hyperlinkEnabledDesc: string;
    hyperlinkTimeout: string;
    hyperlinkTimeoutDesc: string;
    hyperlinkSkipPrivate: string;
    hyperlinkSkipPrivateDesc: string;
    hyperlinkUserAgent: string;
    hyperlinkUserAgentDesc: string;
    hyperlinkExcludedDomains: string;
    hyperlinkExcludedDomainsDesc: string;
}

export const TRANSLATIONS: Record<Lang, Translations> = {
    en: {
        menuTextColor: 'Text color',
        menuTextSize: 'Text size',
        menuBold: 'Bold',
        menuClearColor: 'Clear color',
        menuClearSize: 'Clear size',

        settingTabGeneral: 'General',
        settingTabColors: 'Text Color',
        settingTabFonts: 'Font',

        settingLanguageName: 'Language',
        settingLanguageDesc: 'Display language for the right-click menu and this settings tab.',

        settingColorsHeading: 'Text color',
        settingColorsDesc:
            'Configure the colors available in the right-click menu. A value can be a CSS color (e.g. #ff0000) or var(--…) to reference a theme variable.',
        settingColorValuePlaceholder: 'CSS color or var(--…)',
        settingAddColor: 'Add color',

        settingSizesHeading: 'Text size',
        settingSizesDesc:
            'Configure the font sizes available in the right-click menu. A value can be any CSS size (e.g. 14px or 1.2em).',
        settingSizeValuePlaceholder: 'CSS size (e.g. 16px)',
        settingAddSize: 'Add font size',

        settingDisplayNamePlaceholder: 'Display name',
        settingDeleteTooltip: 'Delete',
        settingRestoreDefaults: 'Restore defaults',

        newColorName: 'New color',
        settingTabHyperlink: 'Hyperlink',
        hyperlinkEnabled: 'Enable auto hyperlink',
        hyperlinkEnabledDesc: 'When pasting a URL, automatically convert it to a Markdown link.',
        hyperlinkTimeout: 'Fetch timeout (ms)',
        hyperlinkTimeoutDesc: 'Maximum time to wait for page title fetch. Range: 1000–60000.',
        hyperlinkSkipPrivate: 'Skip private hosts',
        hyperlinkSkipPrivateDesc: 'Do not fetch titles for localhost or private IP addresses.',
        hyperlinkUserAgent: 'User agent',
        hyperlinkUserAgentDesc: 'User-Agent header sent when fetching page titles.',
        hyperlinkExcludedDomains: 'Excluded domains',
        hyperlinkExcludedDomainsDesc: 'Domains to skip (comma-separated). Supports wildcards: *.example.com',
        colorNames: {
            red: 'Red',
            orange: 'Orange',
            yellow: 'Yellow',
            green: 'Green',
            cyan: 'Cyan',
            blue: 'Blue',
            purple: 'Purple',
            pink: 'Pink',
            gray: 'Gray',
        },
    },
    zh: {
        menuTextColor: '文字颜色',
        menuTextSize: '文字大小',
        menuBold: '加粗',
        menuClearColor: '清除颜色',
        menuClearSize: '清除大小',

        settingTabGeneral: '通用',
        settingTabColors: '文字颜色',
        settingTabFonts: '字体',

        settingLanguageName: '语言',
        settingLanguageDesc: '右键菜单和本设置页面的显示语言。',

        settingColorsHeading: '文字颜色',
        settingColorsDesc:
            '配置右键菜单中可选的颜色。值可以是 CSS 颜色(如 #ff0000)或 var(--…) 引用主题变量。',
        settingColorValuePlaceholder: 'CSS 颜色或 var(--…)',
        settingAddColor: '新增颜色',

        settingSizesHeading: '文字大小',
        settingSizesDesc: '配置右键菜单中可选的字号。值可以是任意 CSS 大小（如 14px、1.2em）。',
        settingSizeValuePlaceholder: 'CSS 大小（如 16px）',
        settingAddSize: '新增字号',

        settingDisplayNamePlaceholder: '显示名称',
        settingDeleteTooltip: '删除',
        settingRestoreDefaults: '恢复默认',

        newColorName: '新颜色',
        settingTabHyperlink: '超链接',
        hyperlinkEnabled: '启用自动超链接',
        hyperlinkEnabledDesc: '粘贴 URL 时，自动转换为 Markdown 链接格式。',
        hyperlinkTimeout: '抓取超时（毫秒）',
        hyperlinkTimeoutDesc: '等待页面标题抓取的最长时间，范围 1000–60000。',
        hyperlinkSkipPrivate: '跳过私有地址',
        hyperlinkSkipPrivateDesc: '不对 localhost 或私有 IP 地址发起标题抓取请求。',
        hyperlinkUserAgent: 'User-Agent',
        hyperlinkUserAgentDesc: '抓取页面标题时使用的 User-Agent 请求头。',
        hyperlinkExcludedDomains: '排除域名',
        hyperlinkExcludedDomainsDesc: '不进行标题抓取的域名（逗号分隔），支持通配符：*.example.com',
        colorNames: {
            red: '红色',
            orange: '橙色',
            yellow: '黄色',
            green: '绿色',
            cyan: '青色',
            blue: '蓝色',
            purple: '紫色',
            pink: '粉色',
            gray: '灰色',
        },
    },
};

/**
 * Options for the language dropdown. Language names are shown as endonyms so
 * they stay recognizable no matter which UI language is currently active.
 */
export const LANGUAGE_OPTIONS: { value: LangSetting; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
];

/** Best-effort read of Obsidian's own UI language. Falls back to English. */
function detectObsidianLang(): Lang {
    // Obsidian always updates moment's locale to match the user's language setting.
    try {
        const locale = (activeWindow as unknown as { moment?: { locale?: () => string } }).moment?.locale?.();
        if (typeof locale === 'string' && locale.toLowerCase().startsWith('zh')) return 'zh';
        if (typeof locale === 'string' && locale !== '') return 'en';
    } catch {
        // moment may be unavailable; try localStorage next.
    }
    try {
        const stored = activeWindow.localStorage.getItem('language');
        if (stored && stored.toLowerCase().startsWith('zh')) return 'zh';
    } catch {
        // localStorage may be unavailable; fall through to the default.
    }
    return 'en';
}

/** Resolve a user setting (including `auto`) to a concrete language. */
export function resolveLang(setting: LangSetting): Lang {
    if (setting === 'auto') return detectObsidianLang();
    return setting === 'zh' ? 'zh' : 'en';
}

/** Get the active translation table for a user setting. */
export function getTranslations(setting: LangSetting): Translations {
    return TRANSLATIONS[resolveLang(setting)];
}
