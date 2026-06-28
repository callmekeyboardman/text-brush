import { App, Setting, PluginSettingTab } from 'obsidian';
import type TextColorPlugin from './main';

export class TextColorSettingTab extends PluginSettingTab {
    plugin: TextColorPlugin;

    constructor(app: App, plugin: TextColorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setName('文字颜色').setHeading();
        new Setting(containerEl).setDesc(
            '配置右键菜单中可选的颜色。值可以是 CSS 颜色(如 #ff0000)或 var(--…) 引用主题变量。',
        );

        this.plugin.settings.colors.forEach((color, idx) => {
            const setting = new Setting(containerEl);

            const swatch = setting.nameEl.createSpan({ cls: 'tc-menu-swatch' });
            swatch.style.backgroundColor = color.value;

            setting
                .addText((text) =>
                    text
                        .setPlaceholder('显示名称')
                        .setValue(color.name)
                        .onChange(async (v) => {
                            this.plugin.settings.colors[idx].name = v;
                            await this.plugin.saveSettings();
                        }),
                )
                .addText((text) =>
                    text
                        .setPlaceholder('CSS 颜色或 var(--…)')
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
                        .setTooltip('删除')
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
                    .setButtonText('新增颜色')
                    .setCta()
                    .onClick(async () => {
                        const id = `custom-${Date.now().toString(36)}`;
                        this.plugin.settings.colors.push({
                            id,
                            name: '新颜色',
                            value: '#888888',
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            )
            .addButton((btn) =>
                btn
                    .setButtonText('恢复默认')
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.resetColors();
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            );

        new Setting(containerEl).setName('文字大小').setHeading();
        new Setting(containerEl).setDesc(
            '配置右键菜单中可选的字号。值可以是任意 CSS 大小（如 14px、1.2em）。',
        );

        this.plugin.settings.fontSizes.forEach((size, idx) => {
            const setting = new Setting(containerEl);

            setting
                .addText((text) =>
                    text
                        .setPlaceholder('显示名称')
                        .setValue(size.label)
                        .onChange(async (v) => {
                            this.plugin.settings.fontSizes[idx].label = v;
                            await this.plugin.saveSettings();
                        }),
                )
                .addText((text) =>
                    text
                        .setPlaceholder('CSS 大小（如 16px）')
                        .setValue(size.value)
                        .onChange(async (v) => {
                            this.plugin.settings.fontSizes[idx].value = v;
                            await this.plugin.saveSettings();
                        }),
                )
                .addExtraButton((btn) =>
                    btn
                        .setIcon('trash')
                        .setTooltip('删除')
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
                    .setButtonText('新增字号')
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
                    .setButtonText('恢复默认')
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.resetFontSizes();
                        await this.plugin.saveSettings();
                        this.display();
                    }),
            );
    }
}
