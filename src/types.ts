import { EditorPosition } from 'obsidian';

export interface ColorOption {
    /** Stable identifier, used as part of the CSS class name */
    id: string;
    /** Human-readable label shown in the menu */
    name: string;
    /** Any valid CSS color, including `var(--…)` */
    value: string;
}

export interface TextColorSettings {
    colors: ColorOption[];
    fontSizes: FontSizeOption[];
}

export interface FontSizeOption {
    label: string;
    value: string;
}

export const DEFAULT_FONT_SIZES: FontSizeOption[] = [
    { label: '12px', value: '12px' },
    { label: '14px', value: '14px' },
    { label: '16px', value: '16px' },
    { label: '18px', value: '18px' },
    { label: '20px', value: '20px' },
    { label: '24px', value: '24px' },
];

export interface ResolvedTarget {
    /** Text to (re)wrap, with any tc-color span markup stripped */
    inner: string;
    /** Range in the document to replace — may be wider than the user's selection */
    from: EditorPosition;
    to: EditorPosition;
    /** True if the resolved range is currently a tc-color span */
    wrapped: boolean;
}

export const DEFAULT_COLORS: ColorOption[] = [
    { id: 'red',    name: '红色 Red',    value: 'var(--color-red)' },
    { id: 'orange', name: '橙色 Orange', value: 'var(--color-orange)' },
    { id: 'yellow', name: '黄色 Yellow', value: 'var(--color-yellow)' },
    { id: 'green',  name: '绿色 Green',  value: 'var(--color-green)' },
    { id: 'cyan',   name: '青色 Cyan',   value: 'var(--color-cyan)' },
    { id: 'blue',   name: '蓝色 Blue',   value: 'var(--color-blue)' },
    { id: 'purple', name: '紫色 Purple', value: 'var(--color-purple)' },
    { id: 'pink',   name: '粉色 Pink',   value: 'var(--color-pink)' },
    { id: 'gray',   name: '灰色 Gray',   value: '#95a5a6' },
];

export const DEFAULT_SETTINGS: TextColorSettings = {
    colors: DEFAULT_COLORS,
    fontSizes: DEFAULT_FONT_SIZES,
};

// Match a single span produced by this plugin. Captures the color id and
// the inner text so we can swap colors / strip wrapping cleanly.
export const WRAPPER_RE =
    /^<span class="tc-color tc-color--([\w-]+)"(?:\s+style="[^"]*")?>([\s\S]*)<\/span>$/;

// Same shape as WRAPPER_RE but anchored to the END of a string — used to
// detect an opening tag immediately to the LEFT of the selection.
export const OPEN_TAG_RE =
    /<span class="tc-color tc-color--[\w-]+"(?:\s+style="[^"]*")?>$/;

// Anchored to the START of a string — detects a closing tag immediately
// to the RIGHT of the selection.
export const CLOSE_TAG_RE = /^<\/span>/;

// Non-anchored, non-greedy variant for scanning a full line to find which
// span (if any) the cursor/selection falls inside.
export const SPAN_IN_LINE_RE =
    /<span class="tc-color tc-color--([\w-]+)"(?:\s+style="[^"]*")?>([\s\S]*?)<\/span>/g;

export function unwrap(text: string): { inner: string; wrapped: boolean; colorId?: string } {
    const m = text.match(WRAPPER_RE);
    if (!m) return { inner: text, wrapped: false };
    return { inner: m[2], wrapped: true, colorId: m[1] };
}

export function stripColorSpans(text: string): string {
    return text.replace(
        /<span class="tc-color tc-color--[\w-]+"(?:\s+style="[^"]*")?>([\s\S]*?)<\/span>/g,
        '$1',
    );
}

export function escapeAttr(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function wrap(text: string, color: ColorOption): string {
    const cls = `tc-color tc-color--${color.id}`;
    const style = `color: ${escapeAttr(color.value)}`;
    return `<span class="${cls}" style="${style}">${text}</span>`;
}

const BOLD_WRAPPER_RE = /^<span style="font-weight: bold">([\s\S]*)<\/span>$/;

export function unwrapBold(text: string): { inner: string; bold: boolean } {
    const m = text.match(BOLD_WRAPPER_RE);
    if (!m) return { inner: text, bold: false };
    return { inner: m[1], bold: true };
}

export function wrapBold(text: string): string {
    return `<span style="font-weight: bold">${text}</span>`;
}

export function addBoldToStyle(spanHtml: string): string {
    return spanHtml.replace(/(style="[^"]*)/, '$1; font-weight: bold');
}

export function removeBoldFromStyle(spanHtml: string): string {
    return spanHtml.replace(/\s*font-weight:\s*bold;?/, '');
}

export function hasBoldInStyle(spanHtml: string): boolean {
    return /font-weight:\s*bold/.test(spanHtml);
}

const FONT_SIZE_WRAPPER_RE = /^<span style="font-size: [^"]+">([\s\S]*)<\/span>$/;

export function unwrapFontSize(text: string): { inner: string; hasFontSize: boolean } {
    const m = text.match(FONT_SIZE_WRAPPER_RE);
    if (!m) return { inner: text, hasFontSize: false };
    return { inner: m[1], hasFontSize: true };
}

export function wrapFontSize(text: string, size: string): string {
    return `<span style="font-size: ${escapeAttr(size)}">${text}</span>`;
}

export function hasFontSizeInStyle(spanHtml: string): boolean {
    return /font-size:\s*[^;}"]+/.test(spanHtml);
}

export function addFontSizeToStyle(spanHtml: string, size: string): string {
    if (hasFontSizeInStyle(spanHtml)) {
        return spanHtml.replace(/font-size:\s*[^;}"]+/, `font-size: ${escapeAttr(size)}`);
    }
    return spanHtml.replace(/(style="[^"]*)/, `$1; font-size: ${escapeAttr(size)}`);
}

export function removeFontSizeFromStyle(spanHtml: string): string {
    return spanHtml.replace(/;?\s*font-size:\s*[^;}"]+/, '');
}

export function createColorTitle(color: ColorOption): DocumentFragment {
    const frag = document.createDocumentFragment();
    const swatch = document.createElement('span');
    swatch.className = 'tc-menu-swatch';
    swatch.style.backgroundColor = color.value;
    frag.appendChild(swatch);
    frag.appendChild(document.createTextNode(color.name));
    return frag;
}
