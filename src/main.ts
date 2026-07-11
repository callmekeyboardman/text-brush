import type { EditorPosition } from 'obsidian';
import { Editor, Menu, MenuItem, Plugin } from 'obsidian';

import { TextColorSettingTab } from './settingTab';
import { HyperlinkPasteHandler } from './hyperlinkPaste';

import type { ColorOption, TextColorSettings, ResolvedTarget, FontSizeOption } from './types';
import { t, resolveLang } from './i18n/i18n';
import type { Locale } from './i18n/types';
import {
    getDefaultColors,
    DEFAULT_FONT_SIZES,
    DEFAULT_SETTINGS,
    OPEN_TAG_RE,
    CLOSE_TAG_RE,
    SPAN_IN_LINE_RE,
    SPAN_IN_BLOCK_RE,
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
    private hyperlinkHandler!: HyperlinkPasteHandler;

    /** Resolved locale for the current language setting. */
    get locale(): Locale {
        return resolveLang(this.settings.language);
    }

    async onload() {
        await this.loadSettings();
        this.submenuSupported = this.detectSubmenuSupport();

        this.hyperlinkHandler = new HyperlinkPasteHandler(this.settings.hyperlink);
        this.registerEvent(
            this.app.workspace.on('editor-paste', (evt: ClipboardEvent, editor: Editor) => {
                this.hyperlinkHandler.handlePaste(evt, editor);
            }),
        );

        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor) =>
                this.buildMenu(menu, editor),
            ),
        );

        this.addSettingTab(new TextColorSettingTab(this.app, this));
    }

    onunload() {
        this.hyperlinkHandler?.destroy();
    }

    async loadSettings() {
        const raw = (await this.loadData()) as Partial<TextColorSettings> | null;
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...(raw ?? {}),
        };
        // When the user hasn't saved their own palette, build the defaults in the
        // active language so a fresh install matches the resolved (e.g. auto) locale.
        const savedColors = raw?.colors;
        const savedFontSizes = raw?.fontSizes;
        if (!Array.isArray(savedColors) || savedColors.length === 0) {
            this.settings.colors = getDefaultColors(this.settings.language);
        }
        if (!Array.isArray(savedFontSizes) || savedFontSizes.length === 0) {
            this.settings.fontSizes = DEFAULT_FONT_SIZES.map((s) => ({ ...s }));
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.hyperlinkHandler?.updateSettings(this.settings.hyperlink);
    }

    resetColors() {
        this.settings.colors = getDefaultColors(this.settings.language);
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

        const locale = this.locale;

        if (this.submenuSupported) {
            menu.addItem((item) => {
                item.setTitle(t('menu.textColor', locale));
                item.setIcon('palette');
                const submenu = item.setSubmenu!();
                this.populateColorMenu(submenu, editor, target);
            });
            menu.addItem((item) => {
                item.setTitle(t('menu.textSize', locale));
                item.setIcon('type');
                const submenu = item.setSubmenu!();
                this.populateFontSizeMenu(submenu, editor, target);
            });
        } else {
            menu.addSeparator();
            menu.addItem((item) => {
                item.setTitle(`— ${t('menu.textColor', locale)} —`);
                item.setIcon('palette');
                item.setDisabled(true);
            });
            this.populateColorMenu(menu, editor, target);
            menu.addSeparator();
            menu.addItem((item) => {
                item.setTitle(`— ${t('menu.textSize', locale)} —`);
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

        // Selection partially overlaps a span (starts outside, ends inside, or
        // vice versa; possibly across lines). Expand the replace range to cover
        // the whole span so no tag fragments are left behind when re-wrapping.
        const expanded = this.expandToOverlappingSpan(editor, from, to);
        if (expanded) {
            return { inner: expanded.inner, from: expanded.from, to: expanded.to, wrapped: true };
        }

        return { inner: selection, from, to, wrapped: false };
    }

    /**
     * If the selection partially overlaps a tc-color span, return that span's
     * full range (and its inner text) so the caller can replace the whole span
     * instead of leaving tag fragments behind. Returns null when there is no
     * overlap. `block` starts at `from.line`, so selection offsets are taken
     * relative to that line.
     */
    private expandToOverlappingSpan(
        editor: Editor,
        from: EditorPosition,
        to: EditorPosition,
    ): { inner: string; from: EditorPosition; to: EditorPosition } | null {
        const lines: string[] = [];
        for (let l = from.line; l <= to.line; l++) lines.push(editor.getLine(l));
        const block = lines.join('\n');

        // Selection char offsets relative to `block` (which starts at from.line).
        const selStart = from.ch;
        let selEnd = 0;
        for (let l = from.line; l < to.line; l++) {
            selEnd += editor.getLine(l).length + 1; // +1 for '\n'
        }
        selEnd += to.ch;

        SPAN_IN_BLOCK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = SPAN_IN_BLOCK_RE.exec(block)) !== null) {
            const spanStart = m.index;
            const spanEnd = m.index + m[0].length;
            if (selStart < spanEnd && selEnd > spanStart) {
                return {
                    inner: m[2],
                    from: this.offsetToPos(editor, from.line, spanStart),
                    to: this.offsetToPos(editor, from.line, spanEnd),
                };
            }
        }
        return null;
    }

    /** Convert a char offset (relative to `startLine`) back into an editor position. */
    private offsetToPos(editor: Editor, startLine: number, offset: number): EditorPosition {
        let line = startLine;
        let remaining = offset;
        while (true) {
            const lineLen = editor.getLine(line).length;
            if (remaining <= lineLen) return { line, ch: remaining };
            remaining -= lineLen + 1; // +1 for '\n'
            line++;
        }
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
            sub.setTitle(t('menu.bold', this.locale));
            sub.setIcon('bold');
            sub.onClick(() => this.toggleBold(editor, target));
        });

        if (target.wrapped) {
            menu.addSeparator();
            menu.addItem((sub) => {
                sub.setTitle(t('menu.clearColor', this.locale));
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
                    sub.setTitle(t('menu.clearSize', this.locale));
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
                : from.ch + lines[lines.length - 1].length;
        editor.setSelection(from, { line: endLine, ch: endCh });
    }
    
}
