import { App, Setting, PluginSettingTab } from 'obsidian';
import type TextColorPlugin from './main';
import type { LangSetting } from './i18n';
import { getTranslations, LANGUAGE_OPTIONS } from './i18n';
import { colorsAreBuiltinDefaults, getDefaultColors } from './types';

export class TextColorSettingTab extends PluginSettingTab {
    plugin: TextColorPlugin;

    constructor(app: App, plugin: TextColorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        const t = this.plugin.t;

        new Setting(containerEl)
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

        new Setting(containerEl).setName(t.settingColorsHeading).setHeading();
        new Setting(containerEl).setDesc(t.settingColorsDesc);

        this.plugin.settings.colors.forEach((color, idx) => {
            const setting = new Setting(containerEl);

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

        new Setting(containerEl)
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

        new Setting(containerEl).setName(t.settingSizesHeading).setHeading();
        new Setting(containerEl).setDesc(t.settingSizesDesc);

        this.plugin.settings.fontSizes.forEach((size, idx) => {
            const setting = new Setting(containerEl);

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

        new Setting(containerEl)
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
}
