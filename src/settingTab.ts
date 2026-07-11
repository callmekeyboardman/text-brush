import { App, Setting, PluginSettingTab } from 'obsidian';
import type TextColorPlugin from './main';
import type { LangSetting, Translations } from './i18n';
import { getTranslations, LANGUAGE_OPTIONS } from './i18n';
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

        const t = this.plugin.t;

        const tabBar = containerEl.createDiv({ cls: 'tb-settings-tabs' });
        const tabButtons = new Map<TabId, HTMLButtonElement>();
        const tabContents = new Map<TabId, HTMLDivElement>();

        for (const id of TAB_IDS) {
            const btn = tabBar.createEl('button', {
                cls: `tb-settings-tab${id === this.activeTab ? ' tb-settings-tab--active' : ''}`,
                text: this.getTabLabel(id, t),
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

        this.renderGeneralTab(tabContents.get('general')!, t);
        this.renderColorsTab(tabContents.get('colors')!, t);
        this.renderFontsTab(tabContents.get('fonts')!, t);
        this.renderHyperlinkTab(tabContents.get('hyperlink')!, t);
    }

    private getTabLabel(id: TabId, t: Translations): string {
        const map: Record<TabId, string> = {
            general: t.settingTabGeneral,
            colors: t.settingTabColors,
            fonts: t.settingTabFonts,
            hyperlink: t.settingTabHyperlink,
        };
        return map[id];
    }

    private renderGeneralTab(container: HTMLElement, t: Translations): void {
        new Setting(container)
            .setName(t.settingLanguageName)
            .setDesc(t.settingLanguageDesc)
            .addDropdown((dd) => {
                for (const opt of LANGUAGE_OPTIONS) dd.addOption(opt.value, opt.label);
                dd.setValue(this.plugin.settings.language);
                dd.onChange(async (value) => {
                    this.plugin.settings.language = value as LangSetting;
                    // If the palette is still the untouched built-in set, follow
                    // the new language; otherwise leave the user's names alone.
                    if (colorsAreBuiltinDefaults(this.plugin.settings.colors)) {
                        this.plugin.settings.colors = getDefaultColors(
                            getTranslations(this.plugin.settings.language),
                        );
                    }
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
    }

    private renderColorsTab(container: HTMLElement, t: Translations): void {
        new Setting(container).setName(t.settingColorsHeading).setHeading();
        new Setting(container).setDesc(t.settingColorsDesc);

        this.plugin.settings.colors.forEach((color, idx) => {
            const setting = new Setting(container);

            const swatch = setting.nameEl.createSpan({ cls: 'tc-menu-swatch' });
            swatch.style.backgroundColor = color.value;

            setting
                .addText((text) =>
                    text
                        .setPlaceholder(t.settingDisplayNamePlaceholder)
                        .setValue(color.name)
                        .onChange(async (v) => {
                            this.plugin.settings.colors[idx].name = v;
                            await this.plugin.saveSettings();
                        }),
                )
                .addText((text) =>
                    text
                        .setPlaceholder(t.settingColorValuePlaceholder)
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
                        .setTooltip(t.settingDeleteTooltip)
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
                    .setButtonText(t.settingAddColor)
                    .setCta()
                    .onClick(async () => {
                        const id = `custom-${Date.now().toString(36)}`;
                        this.plugin.settings.colors.push({
                            id,
                            name: t.newColorName,
                            value: '#888888',
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            )
            .addButton((btn) =>
                btn
                    .setButtonText(t.settingRestoreDefaults)
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.resetColors();
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            );
    }

    private renderFontsTab(container: HTMLElement, t: Translations): void {
        new Setting(container).setName(t.settingSizesHeading).setHeading();
        new Setting(container).setDesc(t.settingSizesDesc);

        this.plugin.settings.fontSizes.forEach((size, idx) => {
            const setting = new Setting(container);

            setting
                .addText((text) =>
                    text
                        .setPlaceholder(t.settingDisplayNamePlaceholder)
                        .setValue(size.label)
                        .onChange(async (v) => {
                            this.plugin.settings.fontSizes[idx].label = v;
                            await this.plugin.saveSettings();
                        }),
                )
                .addText((text) =>
                    text
                        .setPlaceholder(t.settingSizeValuePlaceholder)
                        .setValue(size.value)
                        .onChange(async (v) => {
                            this.plugin.settings.fontSizes[idx].value = v;
                            await this.plugin.saveSettings();
                        }),
                )
                .addExtraButton((btn) =>
                    btn
                        .setIcon('trash')
                        .setTooltip(t.settingDeleteTooltip)
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
                    .setButtonText(t.settingAddSize)
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
                    .setButtonText(t.settingRestoreDefaults)
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.resetFontSizes();
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            );
    }

    private renderHyperlinkTab(container: HTMLElement, t: Translations): void {
        const h = this.plugin.settings.hyperlink;

        new Setting(container)
            .setName(t.hyperlinkEnabled)
            .setDesc(t.hyperlinkEnabledDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(h.enabled)
                    .onChange(async (value) => {
                        h.enabled = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(container)
            .setName(t.hyperlinkTimeout)
            .setDesc(t.hyperlinkTimeoutDesc)
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
            .setName(t.hyperlinkSkipPrivate)
            .setDesc(t.hyperlinkSkipPrivateDesc)
            .addToggle((toggle) =>
                toggle
                    .setValue(h.skipPrivateHosts)
                    .onChange(async (value) => {
                        h.skipPrivateHosts = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(container)
            .setName(t.hyperlinkUserAgent)
            .setDesc(t.hyperlinkUserAgentDesc)
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
            .setName(t.hyperlinkExcludedDomains)
            .setDesc(t.hyperlinkExcludedDomainsDesc)
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
