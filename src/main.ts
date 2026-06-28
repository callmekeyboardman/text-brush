import type { EditorPosition } from 'obsidian';
import { Editor, Menu, MenuItem, Plugin } from 'obsidian';

import { TextColorSettingTab } from './settingTab';

import type { ColorOption, TextColorSettings, ResolvedTarget, FontSizeOption } from './types';
import {
    DEFAULT_COLORS,
    DEFAULT_FONT_SIZES,
    DEFAULT_SETTINGS,
    OPEN_TAG_RE,
    CLOSE_TAG_RE,
    SPAN_IN_LINE_RE,
    unwrap,
    unwrapBold,
    wrapBold,
    hasBoldInStyle,
    addBoldToStyle,
    removeBoldFromStyle,
    stripColorSpans,
    wrap,
    createColorTitle,
    unwrapFontSize,
    wrapFontSize,
    hasFontSizeInStyle,
    addFontSizeToStyle,
    removeFontSizeFromStyle,
} from './types';

declare module 'obsidian' {
    interface MenuItem {
        setSubmenu?(): Menu;
    }
}

export default class TextColorPlugin extends Plugin {
    settings!: TextColorSettings;
    private submenuSupported = false;

    async onload() {
        await this.loadSettings();
        this.submenuSupported = this.detectSubmenuSupport();

        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor) =>
                this.buildMenu(menu, editor),
            ),
        );

        this.addSettingTab(new TextColorSettingTab(this.app, this));
    }

    async loadSettings() {
        const raw = (await this.loadData()) as Partial<TextColorSettings> | null;
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...(raw ?? {}),
        };
        if (!Array.isArray(this.settings.colors) || this.settings.colors.length === 0) {
            this.settings.colors = DEFAULT_COLORS.map((c) => ({ ...c }));
        }
        if (!Array.isArray(this.settings.fontSizes) || this.settings.fontSizes.length === 0) {
            this.settings.fontSizes = DEFAULT_FONT_SIZES.map((s) => ({ ...s }));
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    resetColors() {
        this.settings.colors = DEFAULT_COLORS.map((c) => ({ ...c }));
    }

    resetFontSizes() {
        this.settings.fontSizes = DEFAULT_FONT_SIZES.map((s) => ({ ...s }));
    }

    private detectSubmenuSupport(): boolean {
        try {
            const probe = new Menu();
            let supported = false;
            probe.addItem((item) => {
                supported = typeof item.setSubmenu === 'function';
            });
            return supported;
        } catch {
            return false;
        }
    }

    private buildMenu(menu: Menu, editor: Editor) {
        const target = this.resolveTarget(editor);
        if (!target) return;

        if (this.submenuSupported) {
            menu.addItem((item) => {
                item.setTitle('文字颜色');
                item.setIcon('palette');
                const submenu = item.setSubmenu!();
                this.populateColorMenu(submenu, editor, target);
            });
            menu.addItem((item) => {
                item.setTitle('文字大小');
                item.setIcon('type');
                const submenu = item.setSubmenu!();
                this.populateFontSizeMenu(submenu, editor, target);
            });
        } else {
            menu.addSeparator();
            menu.addItem((item) => {
                item.setTitle('— 文字颜色 —');
                item.setIcon('palette');
                item.setDisabled(true);
            });
            this.populateColorMenu(menu, editor, target);
            menu.addSeparator();
            menu.addItem((item) => {
                item.setTitle('— 文字大小 —');
                item.setIcon('type');
                item.setDisabled(true);
            });
            this.populateFontSizeMenu(menu, editor, target);
            menu.addSeparator();
        }
    }

    private resolveTarget(editor: Editor): ResolvedTarget | null {
        const selection = editor.getSelection();
        if (!selection || !selection.trim()) return null;

        const from = editor.getCursor('from');
        const to = editor.getCursor('to');

        const direct = unwrap(selection);
        if (direct.wrapped) {
            return { inner: direct.inner, from, to, wrapped: true };
        }

        const beforeText = editor.getLine(from.line).slice(0, from.ch);
        const afterText = editor.getLine(to.line).slice(to.ch);

        const openMatch = beforeText.match(OPEN_TAG_RE);
        const closeMatch = afterText.match(CLOSE_TAG_RE);

        if (openMatch && closeMatch) {
            return {
                inner: selection,
                from: { line: from.line, ch: from.ch - openMatch[0].length },
                to: { line: to.line, ch: to.ch + closeMatch[0].length },
                wrapped: true,
            };
        }

        if (from.line === to.line) {
            const line = editor.getLine(from.line);
            SPAN_IN_LINE_RE.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = SPAN_IN_LINE_RE.exec(line)) !== null) {
                const spanStart = m.index;
                const spanEnd = m.index + m[0].length;
                const innerStart = spanStart + m[0].indexOf('>') + 1;
                const innerEnd = spanEnd - '</span>'.length;
                if (from.ch >= innerStart && to.ch <= innerEnd) {
                    return {
                        inner: m[2],
                        from: { line: from.line, ch: spanStart },
                        to: { line: from.line, ch: spanEnd },
                        wrapped: true,
                    };
                }
            }
        }

        return { inner: selection, from, to, wrapped: false };
    }

    private populateColorMenu(menu: Menu, editor: Editor, target: ResolvedTarget) {
        for (const color of this.settings.colors) {
            menu.addItem((sub) => {
                sub.setTitle(createColorTitle(color));
                sub.onClick(() => this.applyColor(editor, target, color));
            });
        }
        menu.addSeparator();
        menu.addItem((sub) => {
            sub.setTitle('加粗');
            sub.setIcon('bold');
            sub.onClick(() => this.toggleBold(editor, target));
        });

        if (target.wrapped) {
            menu.addSeparator();
            menu.addItem((sub) => {
                sub.setTitle('清除颜色');
                sub.setIcon('eraser');
                sub.onClick(() => this.clearColor(editor, target));
            });
        }
    }

    private toggleBold(editor: Editor, target: ResolvedTarget) {
        if (target.wrapped) {
            const current = editor.getRange(target.from, target.to);
            let updated: string;
            if (hasBoldInStyle(current)) {
                updated = removeBoldFromStyle(current);
            } else {
                updated = addBoldToStyle(current);
            }
            editor.replaceRange(updated, target.from, target.to);
            this.reselect(editor, target.from, updated);
        } else {
            const result = unwrapBold(target.inner);
            if (result.bold) {
                editor.replaceRange(result.inner, target.from, target.to);
                this.reselect(editor, target.from, result.inner);
            } else {
                const boldSpan = wrapBold(target.inner);
                editor.replaceRange(boldSpan, target.from, target.to);
                this.reselect(editor, target.from, boldSpan);
            }
        }
    }

    private applyColor(editor: Editor, target: ResolvedTarget, color: ColorOption) {
        const cleaned = stripColorSpans(target.inner);
        const replacement = wrap(cleaned, color);
        editor.replaceRange(replacement, target.from, target.to);
        this.reselect(editor, target.from, replacement);
    }

    private clearColor(editor: Editor, target: ResolvedTarget) {
        editor.replaceRange(target.inner, target.from, target.to);
        this.reselect(editor, target.from, target.inner);
    }

    private populateFontSizeMenu(menu: Menu, editor: Editor, target: ResolvedTarget) {
        for (const size of this.settings.fontSizes) {
            menu.addItem((sub) => {
                sub.setTitle(size.label);
                sub.onClick(() => this.applyFontSize(editor, target, size));
            });
        }

        if (target.wrapped) {
            const current = editor.getRange(target.from, target.to);
            if (hasFontSizeInStyle(current)) {
                menu.addSeparator();
                menu.addItem((sub) => {
                    sub.setTitle('清除大小');
                    sub.setIcon('eraser');
                    sub.onClick(() => this.clearFontSize(editor, target));
                });
            }
        }
    }

    private applyFontSize(editor: Editor, target: ResolvedTarget, size: FontSizeOption) {
        if (target.wrapped) {
            const current = editor.getRange(target.from, target.to);
            const updated = addFontSizeToStyle(current, size.value);
            editor.replaceRange(updated, target.from, target.to);
            this.reselect(editor, target.from, updated);
        } else {
            const result = unwrapFontSize(target.inner);
            if (result.hasFontSize) {
                const replacement = wrapFontSize(result.inner, size.value);
                editor.replaceRange(replacement, target.from, target.to);
                this.reselect(editor, target.from, replacement);
            } else {
                const replacement = wrapFontSize(target.inner, size.value);
                editor.replaceRange(replacement, target.from, target.to);
                this.reselect(editor, target.from, replacement);
            }
        }
    }

    private clearFontSize(editor: Editor, target: ResolvedTarget) {
        const current = editor.getRange(target.from, target.to);
        const updated = removeFontSizeFromStyle(current);
        editor.replaceRange(updated, target.from, target.to);
        this.reselect(editor, target.from, updated);
    }

    private reselect(editor: Editor, from: EditorPosition, inserted: string) {
        const lines = inserted.split('\n');
        const endLine = from.line + lines.length - 1;
        const endCh =
            lines.length === 1
                ? from.ch + inserted.length
                : lines[lines.length - 1].length;
        editor.setSelection(from, { line: endLine, ch: endCh });
    }
    
}
