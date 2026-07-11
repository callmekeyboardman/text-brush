/**
 * Auto-hyperlink-on-paste.
 *
 * When the user pastes a bare HTTP(S) URL, convert it to a Markdown link:
 *  - If text is selected → `[selection](url)` (immediate, no network).
 *  - Otherwise → insert a valid `[url](url)` link immediately plus a hidden
 *    sentinel, fetch the page title async, then swap the link text for the
 *    title. On failure the link is left as `[url](url)`.
 *
 * Inserting a valid link up front (instead of an ugly placeholder token) means
 * an interrupted fetch — note closed, plugin unloaded, network error — never
 * leaves junk in the note: at worst the link keeps the URL as its text and a
 * hidden HTML comment lingers, which `destroy()` sweeps from reachable editors.
 *
 * The utility functions below were migrated verbatim from the standalone
 * `obsidian-hyperlink` plugin; only the surrounding handler class is new.
 */

import { Editor, Notice, requestUrl } from 'obsidian';
import type { HyperlinkSettings } from './types';

const NOTICE_THROTTLE_MS = 5000;

interface PendingFetch {
    editor: Editor;
    /** The exact string inserted into the editor: `[url](url)` + sentinel. */
    needle: string;
    urlHref: string;
}

export class HyperlinkPasteHandler {
    private unloaded = false;
    private lastNoticeAt = 0;
    private settings!: HyperlinkSettings;
    /** Parsed cache of `excludedDomains`, rebuilt when settings change. */
    private excludedHosts: string[] = [];
    /** In-flight fetches, keyed by their sentinel — so `destroy()` can clean up. */
    private pending = new Map<string, PendingFetch>();

    constructor(settings: HyperlinkSettings) {
        this.applySettings(settings);
    }

    /** Called from main.ts onunload so async callbacks stop touching the editor. */
    destroy() {
        this.unloaded = true;
        // Any fetch still in flight: strip its sentinel and leave a valid link.
        for (const { editor, needle, urlHref } of this.pending.values()) {
            this.replaceToken(editor, needle, `[${escapeLinkText(urlHref)}](${urlHref})`);
        }
        this.pending.clear();
    }

    /** Called from main.ts after settings are saved so changes apply live. */
    updateSettings(settings: HyperlinkSettings) {
        this.applySettings(settings);
    }

    private applySettings(settings: HyperlinkSettings) {
        this.settings = settings;
        this.excludedHosts = parseExcludedDomains(settings.excludedDomains);
    }

    handlePaste(evt: ClipboardEvent, editor: Editor): void {
        if (!this.settings.enabled) return;
        if (evt.defaultPrevented) return;

        const text = evt.clipboardData?.getData('text/plain')?.trim() ?? '';
        if (!text) return;

        const url = parseHttpUrl(text);
        if (!url) return;

        if (this.settings.skipPrivateHosts && isPrivateOrLocalHost(url.hostname)) return;
        if (isHostExcluded(url.hostname, this.excludedHosts)) return;

        evt.preventDefault();

        const selection = editor.getSelection();
        if (selection) {
            editor.replaceSelection(`[${escapeLinkText(selection)}](${url.href})`);
            return;
        }

        const sentinel = `<!--__ah_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}__-->`;
        const link = `[${escapeLinkText(url.href)}](${url.href})`;
        const needle = link + sentinel;
        editor.replaceSelection(needle);
        this.pending.set(sentinel, { editor, needle, urlHref: url.href });

        this.fetchAndReplace(editor, needle, sentinel, url.href);
    }

    private async fetchAndReplace(
        editor: Editor,
        needle: string,
        sentinel: string,
        urlHref: string,
    ): Promise<void> {
        try {
            const title = await this.fetchTitle(urlHref);
            if (this.unloaded) return; // destroy() already cleaned up
            const display = escapeLinkText(title || urlHref);
            this.replaceToken(editor, needle, `[${display}](${urlHref})`);
        } catch (err: unknown) {
            if (this.unloaded) return;
            // Keep the valid link, just drop the sentinel.
            this.replaceToken(editor, needle, `[${escapeLinkText(urlHref)}](${urlHref})`);
            const msg = err instanceof Error ? err.message : String(err);
            this.notifyThrottled(`Auto Hyperlink: failed to fetch title (${msg})`);
            console.warn('[AutoHyperlink]', urlHref, err);
        } finally {
            this.pending.delete(sentinel);
        }
    }

    private async fetchTitle(url: string): Promise<string> {
        const timeoutMs = this.settings.timeoutMs;
        const headers: Record<string, string> = {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };
        if (this.settings.userAgent) headers['User-Agent'] = this.settings.userAgent;

        // SSRF note: `requestUrl` follows redirects automatically and exposes no
        // way to disable them or read the final URL. On mobile (this plugin ships
        // mobile-compatible) there is no Node HTTP fallback, so a public URL that
        // 302s to a private host cannot be blocked here. The impact is limited
        // because we only surface `<title>`/og/twitter meta of a URL the user
        // themselves pasted, and the result lands only in the user's own note —
        // there is no exfiltration channel to a third party. The private-host
        // guard above still blocks direct metadata/local targets.
        const reqPromise = requestUrl({ url, method: 'GET', headers, throw: false });

        let timer: number | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timer = activeWindow.setTimeout(
                () => reject(new Error(`timeout ${timeoutMs}ms`)),
                timeoutMs,
            );
        });

        try {
            const res = await Promise.race([reqPromise, timeoutPromise]);
            if (res.status < 200 || res.status >= 400) throw new Error(`HTTP ${res.status}`);
            const html = decodeHtmlBody(res);
            return extractTitle(html);
        } finally {
            if (timer !== undefined) activeWindow.clearTimeout(timer);
        }
    }

    private replaceToken(editor: Editor, needle: string, replacement: string): void {
        try {
            const content = editor.getValue();
            const idx = content.indexOf(needle);
            if (idx === -1) return;
            const from = editor.offsetToPos(idx);
            const to = editor.offsetToPos(idx + needle.length);
            editor.replaceRange(replacement, from, to);
        } catch (e) {
            console.warn('[AutoHyperlink] replaceToken failed', e);
        }
    }

    private notifyThrottled(message: string): void {
        const now = Date.now();
        if (now - this.lastNoticeAt < NOTICE_THROTTLE_MS) return;
        this.lastNoticeAt = now;
        new Notice(message);
    }
}

function parseHttpUrl(input: string): URL | null {
    if (!input) return null;
    // 不允许内嵌空白：纯 URL 才接管
    if (/\s/.test(input)) return null;
    try {
        const u = new URL(input);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        if (!u.hostname) return null;
        return u;
    } catch {
        return null;
    }
}

function isPrivateOrLocalHost(hostname: string): boolean {
    if (!hostname) return false;
    const h = hostname.toLowerCase();

    if (h === 'localhost') return true;
    if (h.endsWith('.localhost')) return true;
    if (h.endsWith('.local')) return true;
    if (h.endsWith('.internal')) return true;

    // IPv6 loopback / link-local
    if (h === '::1' || h === '[::1]') return true;
    if (h.startsWith('fe80:') || h.startsWith('[fe80:')) return true;
    if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('[fc') || h.startsWith('[fd')) {
        // fc00::/7 unique local
        return true;
    }

    // IPv4
    const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
        const a = +m[1], b = +m[2];
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 0) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        return false;
    }

    return false;
}

/**
 * 把用户输入的逗号/分号/换行/空白分隔的域名清单解析成数组。
 * 同时容忍用户粘了完整 URL（如 "https://example.com/path"），自动取 hostname。
 */
function parseExcludedDomains(raw: string): string[] {
    if (!raw) return [];
    return raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .map((s) => {
            // 用户可能粘了完整 URL：取 hostname
            if (s.includes('://')) {
                try {
                    return new URL(s).hostname.toLowerCase();
                } catch {
                    return s;
                }
            }
            // 去掉端口、路径
            return s.replace(/[:/].*$/, '');
        })
        .filter(Boolean);
}

/**
 * 判断 hostname 是否命中排除清单。
 * 规则：
 *  - "example.com" 命中 "example.com" 及其任意子域 "a.example.com"
 *  - ".example.com" 仅命中子域，不命中 "example.com" 本体
 *  - "*.example.com" 等价于 ".example.com"
 */
function isHostExcluded(hostname: string, hosts: string[]): boolean {
    if (!hostname || !hosts.length) return false;
    const host = hostname.toLowerCase().replace(/\.$/, '');
    for (const item of hosts) {
        let pattern = item;
        let subOnly = false;
        if (pattern.startsWith('*.')) {
            pattern = pattern.slice(2);
            subOnly = true;
        } else if (pattern.startsWith('.')) {
            pattern = pattern.slice(1);
            subOnly = true;
        }
        if (!pattern) continue;
        if (!subOnly && host === pattern) return true;
        if (host.endsWith('.' + pattern)) return true;
    }
    return false;
}

/**
 * Escape a string so it can sit between `[ … ]` in a Markdown link.
 * Also collapses all whitespace (including newlines) to single spaces, since
 * a link label containing a newline is not valid Markdown — this matters for
 * multi-line selections and for titles whose og:title spans several lines.
 */
function escapeLinkText(s: string): string {
    return s
        .replace(/\s+/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');
}

const ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
            safeFromCodePoint(parseInt(hex, 16)),
        )
        .replace(/&#(\d+);/g, (_, dec) =>
            safeFromCodePoint(parseInt(dec, 10)),
        )
        .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m);
}

function safeFromCodePoint(n: number): string {
    if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return '';
    try {
        return String.fromCodePoint(n);
    } catch {
        return '';
    }
}

function extractTitleByRegex(html: string): string {
    const metaPatterns: RegExp[] = [
        /<meta[^>]+property\s*=\s*["']og:title["'][^>]*>/i,
        /<meta[^>]+name\s*=\s*["']og:title["'][^>]*>/i,
        /<meta[^>]+name\s*=\s*["']twitter:title["'][^>]*>/i,
        /<meta[^>]+property\s*=\s*["']twitter:title["'][^>]*>/i,
    ];
    for (const re of metaPatterns) {
        const m = html.match(re);
        if (!m) continue;
        const c = m[0].match(/content\s*=\s*["']([\s\S]*?)["']/i);
        if (c && c[1].trim()) return decodeHtmlEntities(c[1].trim());
    }
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1].trim()) {
        return decodeHtmlEntities(titleMatch[1].trim()).replace(/\s+/g, ' ');
    }
    return '';
}

function extractTitle(html: string): string {
    // 优先 DOMParser，更稳健；不可用时回退正则
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const og = doc
            .querySelector('meta[property="og:title" i]')
            ?.getAttribute('content');
        if (og && og.trim()) return decodeHtmlEntities(og.trim());

        const tw = doc
            .querySelector('meta[name="twitter:title" i]')
            ?.getAttribute('content');
        if (tw && tw.trim()) return decodeHtmlEntities(tw.trim());

        const title = doc.title?.trim();
        if (title) return decodeHtmlEntities(title).replace(/\s+/g, ' ');
    } catch {
        // fallthrough to regex
    }
    return extractTitleByRegex(html);
}

function decodeHtmlBody(res: {
    text: string;
    arrayBuffer: ArrayBuffer;
    headers: Record<string, string>;
}): string {
    const headerCharset = readCharsetFromHeaders(res.headers);
    let html = res.text;

    const metaCharset = readCharsetFromHtml(html);
    const charsetRaw = (headerCharset || metaCharset || 'utf-8').toLowerCase();
    const charset = normalizeCharset(charsetRaw);

    if (charset === 'utf-8') return html;

    try {
        const decoder = new TextDecoder(charset);
        return decoder.decode(res.arrayBuffer);
    } catch {
        return html;
    }
}

function normalizeCharset(c: string): string {
    const x = c.replace(/["']/g, '').trim().toLowerCase();
    if (x === 'utf8') return 'utf-8';
    if (x === 'gb2312') return 'gbk'; // gb2312 是 gbk 子集，浏览器一般用 gbk 解
    return x;
}

function readCharsetFromHeaders(headers: Record<string, string>): string | null {
    if (!headers) return null;
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'content-type') {
            const m = headers[key].match(/charset\s*=\s*([^;\s]+)/i);
            if (m) return m[1].replace(/["']/g, '');
        }
    }
    return null;
}

function readCharsetFromHtml(html: string): string | null {
    const head = html.slice(0, 4096);
    const m1 = head.match(/<meta[^>]+charset\s*=\s*["']?([^"'>\s]+)/i);
    if (m1) return m1[1];
    const m2 = head.match(
        /<meta[^>]+http-equiv\s*=\s*["']content-type["'][^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^"'>\s;]+)/i,
    );
    if (m2) return m2[1];
    return null;
}
