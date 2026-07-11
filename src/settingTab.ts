import { App, Setting, PluginSettingTab } from 'obsidian';
import type TextColorPlugin from './main';
import type { LangSetting, Locale } from './i18n/types';
import { t } from './i18n/i18n';
import { LANGUAGE_OPTIONS } from './i18n/constants';
import { colorsAreBuiltinDefaults, getDefaultColors } from './types';
import type { SettingsTabId } from './types';

type TabId = SettingsTabId;

/** Tab order on the settings page. Append a new id here to add a tab. */
const TAB_IDS: TabId[] = ['general', 'colors', 'fonts', 'hyperlink'];

export class TextColorSettingTab extends PluginSettingTab {
    plugin: TextColorPlugin;

    constructor(app: App, plugin: TextColorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /** Active tab, persisted in settings so it survives reopening the page. */
    private get activeTab(): TabId {
        const stored = this.plugin.settings.activeSettingsTab;
        return TAB_IDS.includes(stored) ? stored : 'general';
    }

    private set activeTab(id: TabId) {
        this.plugin.settings.activeSettingsTab = id;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('tb-settings');

        const locale = this.plugin.locale;

        const tabBar = containerEl.createDiv({ cls: 'tb-settings-tabs' });
        const tabButtons = new Map<TabId, HTMLButtonElement>();
        const tabContents = new Map<TabId, HTMLDivElement>();

        for (const id of TAB_IDS) {
            const btn = tabBar.createEl('button', {
                cls: `tb-settings-tab${id === this.activeTab ? ' tb-settings-tab--active' : ''}`,
                text: this.getTabLabel(id, locale),
            });
            btn.addEventListener('click', () => {
                this.activeTab = id;
                void this.plugin.saveSettings();
                for (const tabId of TAB_IDS) {
                    tabButtons.get(tabId)?.toggleClass('tb-settings-tab--active', tabId === id);
                    tabContents.get(tabId)?.toggleClass('tb-settings-tab-content--active', tabId === id);
                }
            });
            tabButtons.set(id, btn);
        }

        for (const id of TAB_IDS) {
            const content = containerEl.createDiv({
                cls: `tb-settings-tab-content${id === this.activeTab ? ' tb-settings-tab-content--active' : ''}`,
            });
            tabContents.set(id, content);
        }

        this.renderGeneralTab(tabContents.get('general')!, locale);
        this.renderColorsTab(tabContents.get('colors')!, locale);
        this.renderFontsTab(tabContents.get('fonts')!, locale);
        this.renderHyperlinkTab(tabContents.get('hyperlink')!, locale);
    }

    private getTabLabel(id: TabId, locale: Locale): string {
        const map: Record<TabId, string> = {
            general: t('settingTab.general', locale),
            colors: t('settingTab.colors', locale),
            fonts: t('settingTab.fonts', locale),
            hyperlink: t('settingTab.hyperlink', locale),
        };
        return map[id];
    }

    private renderGeneralTab(container: HTMLElement, locale: Locale): void {
        new Setting(container)
            .setName(t('language.name', locale))
            .setDesc(t('language.desc', locale))
            .addDropdown((dd) => {
                for (const opt of LANGUAGE_OPTIONS) dd.addOption(opt.value, opt.label);
                dd.setValue(this.plugin.settings.language);
                dd.onChange(async (value) => {
                    this.plugin.settings.language = value as LangSetting;
                    // If the palette is still the untouched built-in set, follow
                    // the new language; otherwise leave the user's names alone.
                    if (colorsAreBuiltinDefaults(this.plugin.settings.colors)) {
                        this.plugin.settings.colors = getDefaultColors(this.plugin.settings.language);
                    }
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
    }

    private renderColorsTab(container: HTMLElement, locale: Locale): void {
        new Setting(container).setName(t('colors.heading', locale)).setHeading();
        new Setting(container).setDesc(t('colors.desc', locale));

        this.plugin.settings.colors.forEach((color, idx) => {
            const setting = new Setting(container);

            const swatch = setting.nameEl.createSpan({ cls: 'tc-menu-swatch' });
            swatch.style.backgroundColor = color.value;

            setting
                .addText((text) =>
                    text
                        .setPlaceholder(t('shared.displayNamePlaceholder', locale))
                        .setValue(color.name)
                        .onChange(async (v) => {
                            this.plugin.settings.colors[idx].name = v;
                            await this.plugin.saveSettings();
                        }),
                )
                .addText((text) =>
                    text
                        .setPlaceholder(t('colors.valuePlaceholder', locale))
                        .setValue(color.value)
                        .onChange(async (v) => {
                            this.plugin.settings.colors[idx].value = v;
                            await this.plugin.saveSettings();
                            swatch.style.backgroundColor = v;
                        }),
                )
                .addExtraButton((btn) =>
                    btn
                        .setIcon('trash')
                        .setTooltip(t('shared.deleteTooltip', locale))
                        .onClick(async () => {
                            this.plugin.settings.colors.splice(idx, 1);
                            await this.plugin.saveSettings();
                            this.display();
                        }),
                );
        });

        new Setting(container)
            .addButton((btn) =>
                btn
                    .setButtonText(t('colors.add', locale))
                    .setCta()
                    .onClick(async () => {
                        const id = `custom-${Date.now().toString(36)}`;
                        this.plugin.settings.colors.push({
                            id,
                            name: t('colors.newName', locale),
                            value: '#888888',
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            )
            .addButton((btn) =>
                btn
                    .setButtonText(t('shared.restoreDefaults', locale))
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.resetColors();
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            );
    }

    private renderFontsTab(container: HTMLElement, locale: Locale): void {
        new Setting(container).setName(t('sizes.heading', locale)).setHeading();
        new Setting(container).setDesc(t('sizes.desc', locale));

        this.plugin.settings.fontSizes.forEach((size, idx) => {
            const setting = new Setting(container);

            setting
                .addText((text) =>
                    text
                        .setPlaceholder(t('shared.displayNamePlaceholder', locale))
                        .setValue(size.label)
                        .onChange(async (v) => {
                            this.plugin.settings.fontSizes[idx].label = v;
                            await this.plugin.saveSettings();
                        }),
                )
                .addText((text) =>
                    text
                        .setPlaceholder(t('sizes.valuePlaceholder', locale))
                        .setValue(size.value)
                        .onChange(async (v) => {
                            this.plugin.settings.fontSizes[idx].value = v;
                            await this.plugin.saveSettings();
                        }),
                )
                .addExtraButton((btn) =>
                    btn
                        .setIcon('trash')
                        .setTooltip(t('shared.deleteTooltip', locale))
                        .onClick(async () => {
                            this.plugin.settings.fontSizes.splice(idx, 1);
                            await this.plugin.saveSettings();
                            this.display();
                        }),
                );
        });

        new Setting(container)
            .addButton((btn) =>
                btn
                    .setButtonText(t('sizes.add', locale))
                    .setCta()
                    .onClick(async () => {
                        this.plugin.settings.fontSizes.push({
                            label: '16px',
                            value: '16px',
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            )
            .addButton((btn) =>
                btn
                    .setButtonText(t('shared.restoreDefaults', locale))
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.resetFontSizes();
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            );
    }

    private renderHyperlinkTab(container: HTMLElement, locale: Locale): void {
        const h = this.plugin.settings.hyperlink;

        new Setting(container)
            .setName(t('hyperlink.enabled', locale))
            .setDesc(t('hyperlink.enabledDesc', locale))
            .addToggle((toggle) =>
                toggle
                    .setValue(h.enabled)
                    .onChange(async (value) => {
                        h.enabled = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(container)
            .setName(t('hyperlink.timeout', locale))
            .setDesc(t('hyperlink.timeoutDesc', locale))
            .addText((text) =>
                text
                    .setValue(String(h.timeoutMs))
                    .onChange(async (value) => {
                        const n = parseInt(value, 10);
                        if (Number.isNaN(n)) return;
                        h.timeoutMs = Math.min(60000, Math.max(1000, n));
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(container)
            .setName(t('hyperlink.skipPrivate', locale))
            .setDesc(t('hyperlink.skipPrivateDesc', locale))
            .addToggle((toggle) =>
                toggle
                    .setValue(h.skipPrivateHosts)
                    .onChange(async (value) => {
                        h.skipPrivateHosts = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(container)
            .setName(t('hyperlink.userAgent', locale))
            .setDesc(t('hyperlink.userAgentDesc', locale))
            .addText((text) =>
                text
                    .setPlaceholder('Mozilla/5.0 ...')
                    .setValue(h.userAgent)
                    .onChange(async (value) => {
                        h.userAgent = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(container)
            .setName(t('hyperlink.excludedDomains', locale))
            .setDesc(t('hyperlink.excludedDomainsDesc', locale))
            .addTextArea((area) =>
                area
                    .setPlaceholder('example.com, *.ads.com')
                    .setValue(h.excludedDomains)
                    .onChange(async (value) => {
                        h.excludedDomains = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}
