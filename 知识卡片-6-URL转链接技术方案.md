# 知识卡片-6：URL 转链接功能集成技术方案

> **实施状态：已完成 ✅**（2026-07-11）
>
> 本方案已按下列规格实施完毕，`npm run build`（`tsc -noEmit` + esbuild）通过。实施过程中相对原方案有以下适配（均不改变功能，详见文末 [§6 实施记录](#6-实施记录)）：
> - `fetchTitle` 采用源插件 `obsidian-hyperlink/main.ts` 的稳健版本（`clearTimeout` 清理、`Accept` 请求头、`Promise<string>` 返回、`title || url` 回退），而非方案 §3.1.3 中的简化示例。
> - `onunload()` 与 `saveSettings()` 中对 `hyperlinkHandler` 使用可选链 `?.`，与迁移代码 `replaceToken` 的防御性风格一致。
> - 未导出方案未要求的 `clampTimeout` / `DEFAULT_TIMEOUT_MS`（避免 dead code）；设置页超时输入框的 clamp 沿用方案中的内联 `Math.min/Math.max`。
> - `loadSettings()` 维持浅展开未改深合并，与方案 §4.1 结论一致。

## 1. 背景与目标

将 `obsidian-hyperlink` 插件的核心功能（粘贴 URL 自动转为 Markdown 链接）集成到 `text-brush` 插件中。

**功能描述：**  
用户在编辑器中粘贴纯 HTTP/HTTPS URL 时，自动转换为 Markdown 链接格式 `[title](url)`：
- 若有选中文本 → `[选中文本](url)`（立即完成，无网络请求）
- 若无选中文本 → 先插入占位符，异步抓取页面标题后替换为 `[title](url)`；抓取失败则回退为 `[url](url)`

## 2. 变更总览

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/hyperlinkPaste.ts` | **新建** | 所有 URL/网络工具函数 + 粘贴处理类 |
| `src/types.ts` | **修改** | 新增 `HyperlinkSettings` 接口；扩展 `TextColorSettings` 和 `SettingsTabId` |
| `src/i18n.ts` | **修改** | 新增 Hyperlink 相关翻译键 |

> ℹ️ **i18n 层后续已重构**（2026-07-11）：`src/i18n.ts` 已拆分为 `src/i18n/` 目录（10 语言 JSON + `t(key, locale)` 函数模式），Hyperlink 相关键现位于 `src/i18n/locales/*.json` 的 `hyperlink.*` 命名空间下。详见 [知识卡片-7-多语言架构.md](知识卡片-7-多语言架构.md)。本表中其余文件（`hyperlinkPaste.ts`/`types.ts`/`main.ts`/`settingTab.ts`）的变更不受影响。
| `src/main.ts` | **修改** | 注册粘贴事件处理器；接入 `onunload` |
| `src/settingTab.ts` | **修改** | 新增第四个 Tab：Hyperlink 设置 |

---

## 3. 文件详细规格

### 3.1 新建文件：`src/hyperlinkPaste.ts`

> 依赖：`obsidian`（`Editor`, `requestUrl`, `Notice`）；不引用其他 text-brush 模块。  
> 所有纯工具函数先定义，`HyperlinkPasteHandler` 类放在末尾。

#### 3.1.1 类型与常量

```typescript
import { Editor, Notice, requestUrl } from 'obsidian';
import type { HyperlinkSettings } from './types';

const DEFAULT_TIMEOUT_MS = 8000;
const NOTICE_THROTTLE_MS = 5000;
```

#### 3.1.2 纯工具函数（逐一照搬，无需修改逻辑）

从 `obsidian-hyperlink/main.ts` 直接迁移以下函数，保持函数签名和实现完全一致：

| 函数名 | 原文件位置（大致行号） | 说明 |
|--------|------------------------|------|
| `parseHttpUrl(input: string): URL \| null` | 约 265 行 | 解析并验证 URL |
| `isPrivateOrLocalHost(hostname: string): boolean` | 约 280 行 | 检测私有 IP/本地地址 |
| `parseExcludedDomains(raw: string): string[]` | 约 307 行 | 解析排除域名列表 |
| `isHostExcluded(hostname: string, rawList: string): boolean` | 约 325 行 | 判断是否排除 |
| `escapeLinkText(s: string): string` | 约 345 行 | 转义 Markdown 链接文本 |
| `decodeHtmlEntities(s: string): string` | 约 351 行 | 解码 HTML 实体 |
| `extractTitleByRegex(html: string): string \| null` | 约 373 行 | 正则提取页面标题（备用） |
| `extractTitle(html: string): string \| null` | 约 393 行 | DOMParser 提取标题 |
| `decodeHtmlBody(res: any): string` | 约 415 行 | 处理编码（含 GBK/GB2312）|

#### 3.1.3 `HyperlinkPasteHandler` 类

```typescript
export class HyperlinkPasteHandler {
    private unloaded = false;
    private lastNoticeAt = 0;
    private settings: HyperlinkSettings;

    constructor(settings: HyperlinkSettings) {
        this.settings = settings;
    }

    // 供 main.ts 在 onunload 中调用
    destroy() {
        this.unloaded = true;
    }

    // 供 main.ts 在设置变更时更新
    updateSettings(settings: HyperlinkSettings) {
        this.settings = settings;
    }

    // 注册到 editor-paste 事件的处理函数
    // 在 main.ts 中：this.registerEvent(this.app.workspace.on('editor-paste', this.hyperlinkHandler.handlePaste.bind(this.hyperlinkHandler)));
    handlePaste(evt: ClipboardEvent, editor: Editor): void {
        if (!this.settings.enabled) return;
        if (evt.defaultPrevented) return;

        const text = evt.clipboardData?.getData('text/plain')?.trim() ?? '';
        if (!text) return;

        const url = parseHttpUrl(text);
        if (!url) return;

        if (this.settings.skipPrivateHosts && isPrivateOrLocalHost(url.hostname)) return;
        if (isHostExcluded(url.hostname, this.settings.excludedDomains)) return;

        evt.preventDefault();

        const selection = editor.getSelection();
        if (selection) {
            editor.replaceSelection(`[${escapeLinkText(selection)}](${url.href})`);
            return;
        }

        const placeholder = `[__autohyperlink_${Date.now()}_${Math.random().toString(36).slice(2)}__](${url.href})`;
        editor.replaceSelection(placeholder);

        this.fetchAndReplace(editor, placeholder, url.href);
    }

    private async fetchAndReplace(editor: Editor, placeholder: string, urlHref: string): Promise<void> {
        try {
            const title = await this.fetchTitle(urlHref);
            if (this.unloaded) return;
            const display = title ? escapeLinkText(title) : urlHref;
            this.replaceToken(editor, placeholder, `[${display}](${urlHref})`);
        } catch {
            if (this.unloaded) return;
            this.replaceToken(editor, placeholder, `[${urlHref}](${urlHref})`);
            this.notifyThrottled(`Auto Hyperlink: failed to fetch title for ${urlHref}`);
        }
    }

    private async fetchTitle(url: string): Promise<string | null> {
        const timeoutMs = this.settings.timeoutMs;
        const headers: Record<string, string> = {};
        if (this.settings.userAgent) headers['User-Agent'] = this.settings.userAgent;

        const reqPromise = requestUrl({ url, headers, throw: false });
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeoutMs)
        );
        const res = await Promise.race([reqPromise, timeoutPromise]);
        if (res.status >= 400) throw new Error(`HTTP ${res.status}`);

        const html = decodeHtmlBody(res);
        return extractTitle(html);
    }

    private replaceToken(editor: Editor, placeholder: string, replacement: string): void {
        try {
            const content = editor.getValue();
            const idx = content.indexOf(placeholder);
            if (idx === -1) return;
            const from = editor.offsetToPos(idx);
            const to = editor.offsetToPos(idx + placeholder.length);
            editor.replaceRange(replacement, from, to);
        } catch {
            // editor may have been closed
        }
    }

    private notifyThrottled(message: string): void {
        const now = Date.now();
        if (now - this.lastNoticeAt < NOTICE_THROTTLE_MS) return;
        this.lastNoticeAt = now;
        new Notice(message);
    }
}
```

---

### 3.2 修改文件：`src/types.ts`

#### 3.2.1 新增 `HyperlinkSettings` 接口

在文件中现有接口之后（`FontSizeOption` 下方）新增：

```typescript
export interface HyperlinkSettings {
    enabled: boolean;
    timeoutMs: number;
    skipPrivateHosts: boolean;
    userAgent: string;
    excludedDomains: string;
}
```

#### 3.2.2 修改 `SettingsTabId`

将现有：
```typescript
export type SettingsTabId = 'general' | 'colors' | 'fonts';
```
改为：
```typescript
export type SettingsTabId = 'general' | 'colors' | 'fonts' | 'hyperlink';
```

#### 3.2.3 修改 `TextColorSettings`

在 `TextColorSettings` 接口末尾新增字段：
```typescript
hyperlink: HyperlinkSettings;
```

#### 3.2.4 修改 `DEFAULT_SETTINGS`

在 `DEFAULT_SETTINGS` 对象末尾新增：
```typescript
hyperlink: {
    enabled: true,
    timeoutMs: 8000,
    skipPrivateHosts: true,
    userAgent: 'Mozilla/5.0 (compatible; ObsidianAutoHyperlink/1.1; +https://obsidian.md)',
    excludedDomains: '',
},
```

---

### 3.3 修改文件：`src/i18n.ts`

> ⚠️ **已迁移**（2026-07-11）：i18n 层后已重构为 `src/i18n/` 目录 + `t(key, locale)` 函数模式（详见 [知识卡片-7-多语言架构.md](知识卡片-7-多语言架构.md)）。下方 `Translations` 接口、`t.hyperlinkEnabled` 对象访问、`this.plugin.t` getter 的写法均为**本方案实施时的原始设计**，保留作历史记录。重构后等价写法：JSON 中 `hyperlink.enabled` / `hyperlink.enabledDesc` 等键，调用处 `t('hyperlink.enabled', locale)`；`this.plugin.t` getter 已改为 `this.plugin.locale`。

#### 3.3.1 修改 `Translations` 接口

在 `Translations` 接口末尾新增以下字段（放在 `colorNames` 之前）：

```typescript
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
```

#### 3.3.2 修改英文翻译对象（`en`）

在 `en` 翻译对象末尾（`colorNames` 之前）新增：

```typescript
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
```

#### 3.3.3 修改中文翻译对象（`zh`）

在 `zh` 翻译对象末尾（`colorNames` 之前）新增：

```typescript
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
```

---

### 3.4 修改文件：`src/main.ts`

#### 3.4.1 新增 import

在文件顶部现有 import 之后新增：
```typescript
import { HyperlinkPasteHandler } from './hyperlinkPaste';
```

#### 3.4.2 在 `TextColorPlugin` 类中新增字段

在 `private submenuSupported: boolean;` 下方新增：
```typescript
private hyperlinkHandler: HyperlinkPasteHandler;
```

#### 3.4.3 修改 `onload()` 方法

在 `detectSubmenuSupport()` 调用之后，注册 `editor-menu` 事件之前，新增以下两行：

```typescript
this.hyperlinkHandler = new HyperlinkPasteHandler(this.settings.hyperlink);
this.registerEvent(this.app.workspace.on('editor-paste', (evt: ClipboardEvent, editor: Editor) => {
    this.hyperlinkHandler.handlePaste(evt, editor);
}));
```

#### 3.4.4 新增 `onunload()` 方法

在类中新增（Plugin 基类的 `onunload` 默认为空，直接 override）：

```typescript
onunload() {
    this.hyperlinkHandler.destroy();
}
```

#### 3.4.5 修改 `saveSettings()` 方法（如存在）或在设置保存后同步

在 `saveSettings()` 方法中（位于 `await this.saveData(this.settings)` 调用之后）新增：

```typescript
this.hyperlinkHandler.updateSettings(this.settings.hyperlink);
```

> **注意：** 若 `saveSettings` 不存在，需检索其实现位置。根据现有代码，该方法为：
> ```typescript
> async saveSettings() {
>     await this.saveData(this.settings);
> }
> ```
> 在 `await this.saveData(this.settings);` 后追加上述一行即可。

---

### 3.5 修改文件：`src/settingTab.ts`

#### 3.5.1 修改 `TAB_IDS` 数组

将现有：
```typescript
const TAB_IDS: TabId[] = ['general', 'colors', 'fonts'];
```
改为：
```typescript
const TAB_IDS: TabId[] = ['general', 'colors', 'fonts', 'hyperlink'];
```

#### 3.5.2 修改 `display()` 方法中的 Tab 渲染循环

`display()` 方法中有类似以下结构（创建 tab content div 并调用各自的 render 方法），需在 `renderFontsTab` 调用后新增对 `renderHyperlinkTab` 的调用。找到以下代码块末尾：

```typescript
// 伪代码，实际以文件为准
this.renderFontsTab(fontsContent);
```

之后追加：
```typescript
const hyperlinkContent = tabContents['hyperlink'];
this.renderHyperlinkTab(hyperlinkContent);
```

> 若 `display()` 对 TAB_IDS 做循环渲染，需检查循环是否覆盖了内容创建，以及 render 方法是否需要手动注册。以实际文件代码为准进行对应修改。

#### 3.5.3 新增 `renderHyperlinkTab()` 方法

在 `renderFontsTab()` 方法之后新增：

```typescript
private renderHyperlinkTab(containerEl: HTMLElement): void {
    const { t, settings } = this.plugin;
    const h = settings.hyperlink;

    new Setting(containerEl)
        .setName(t.hyperlinkEnabled)
        .setDesc(t.hyperlinkEnabledDesc)
        .addToggle(toggle => toggle
            .setValue(h.enabled)
            .onChange(async (value) => {
                h.enabled = value;
                await this.plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName(t.hyperlinkTimeout)
        .setDesc(t.hyperlinkTimeoutDesc)
        .addText(text => text
            .setValue(String(h.timeoutMs))
            .onChange(async (value) => {
                const n = parseInt(value, 10);
                if (!isNaN(n)) {
                    h.timeoutMs = Math.min(60000, Math.max(1000, n));
                    await this.plugin.saveSettings();
                }
            }));

    new Setting(containerEl)
        .setName(t.hyperlinkSkipPrivate)
        .setDesc(t.hyperlinkSkipPrivateDesc)
        .addToggle(toggle => toggle
            .setValue(h.skipPrivateHosts)
            .onChange(async (value) => {
                h.skipPrivateHosts = value;
                await this.plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName(t.hyperlinkUserAgent)
        .setDesc(t.hyperlinkUserAgentDesc)
        .addText(text => text
            .setValue(h.userAgent)
            .setPlaceholder('Mozilla/5.0 ...')
            .onChange(async (value) => {
                h.userAgent = value;
                await this.plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName(t.hyperlinkExcludedDomains)
        .setDesc(t.hyperlinkExcludedDomainsDesc)
        .addTextArea(area => area
            .setValue(h.excludedDomains)
            .setPlaceholder('example.com, *.ads.com')
            .onChange(async (value) => {
                h.excludedDomains = value;
                await this.plugin.saveSettings();
            }));
}
```

> **注意：** `this.plugin.t` 通过 `get t()` getter 获取当前语言翻译，与现有代码一致。  
> 若 `settingTab.ts` 中通过 `const t = this.plugin.t;` 模式使用翻译，请保持相同写法。

---

## 4. 需要注意的兼容性与边界情况

1. **`DEFAULT_SETTINGS` 迁移兼容**：`settings.hyperlink` 字段在老用户加载时不存在，Obsidian 的 `Object.assign` 加载模式（`loadData` 返回旧数据）会自动将 `DEFAULT_SETTINGS.hyperlink` 合并进去。需确认 `loadSettings()` 中确实使用了类似 `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` 的写法——根据现有代码，确实如此，无需额外处理。

2. **`unloaded` 标志保证异步安全**：`HyperlinkPasteHandler.destroy()` 在 `onunload()` 中调用，确保插件卸载后异步回调不再修改编辑器。

3. **`updateSettings` 调用时机**：`saveSettings()` 中追加的 `this.hyperlinkHandler.updateSettings(...)` 确保设置面板修改能实时生效，无需重启 Obsidian。

4. **事件监听自动清理**：通过 `this.registerEvent()` 注册的 `editor-paste` 监听器，在插件卸载时 Obsidian 自动清理，无需手动 `removeEventListener`。

5. **不影响现有功能**：新增的 `editor-paste` 事件与现有 `editor-menu` 事件互相独立；`hyperlinkPaste.ts` 不依赖任何现有模块（types/i18n），只向 types/i18n 中追加新内容，不修改任何现有字段。

---

## 5. 实施顺序建议

1. 修改 `src/types.ts` — 先定义数据结构
2. 修改 `src/i18n.ts` — 补充翻译
3. 新建 `src/hyperlinkPaste.ts` — 迁移并整合工具函数
4. 修改 `src/main.ts` — 注册处理器
5. 修改 `src/settingTab.ts` — 添加设置 UI
6. 构建验证：`npm run build`（先 `tsc -noEmit` 检查类型，再打包）

---

## 6. 实施记录

> 实际落地情况。按上述顺序全部完成，`npm run build` 通过，无类型错误。

### 6.1 与原方案的差异

| # | 位置 | 原方案 | 实际实施 | 原因 |
|---|------|--------|----------|------|
| 1 | `fetchTitle` | 简化版：`requestUrl` + 裸 `setTimeout`，返回 `Promise<string \| null>` | 源插件版：`window.setTimeout` + `finally clearTimeout`、带 `Accept` 请求头、`res.status` 范围校验、返回 `Promise<string>` | 方案 §3.1.2 要求工具函数"逐一照搬"源插件；源版本更稳健，`fetchAndReplace` 的 `title \|\| url` 已覆盖空标题回退 |
| 2 | `onunload` / `saveSettings` | 直接 `this.hyperlinkHandler.destroy()` / `updateSettings(...)` | 改为 `this.hyperlinkHandler?.destroy()` / `?.updateSettings(...)` | 与迁移代码 `replaceToken` 的防御性风格一致；字段用 `!` 断言但 `?.` 兜底未初始化边界 |
| 3 | `clampTimeout` / `DEFAULT_TIMEOUT_MS` | 未要求导出 | 删除（未使用） | 方案未要求导出；保留为 dead code 不符合仓库整洁度。设置页超时 clamp 沿用方案内联 `Math.min(60000, Math.max(1000, n))` |
| 4 | `loadSettings` 深合并 | 方案 §4.1 结论"无需额外处理" | 维持浅展开 `{...DEFAULT_SETTINGS, ...raw}` 不变 | 与方案结论一致；新安装用户 `raw.hyperlink` 不存在，默认值正常注入 |

### 6.2 工具函数迁移清单

从 `obsidian-hyperlink/main.ts` 原样迁移至 `src/hyperlinkPaste.ts`（逻辑零修改）：

- `parseHttpUrl`、`isPrivateOrLocalHost`、`parseExcludedDomains`、`isHostExcluded`、`escapeLinkText`
- `decodeHtmlEntities`（及其依赖 `safeFromCodePoint`、`ENTITIES`）
- `extractTitleByRegex`、`extractTitle`
- `decodeHtmlBody`（及其依赖 `normalizeCharset`、`readCharsetFromHeaders`、`readCharsetFromHtml`）

### 6.3 验证结果

- `tsc -noEmit -skipLibCheck`：通过，无错误
- esbuild production 构建：通过，`main.js` 23.7 KB
- bundle 关键符号校验：`editor-paste`、`ObsidianAutoHyperlink`、`excludedDomains`、`autohyperlink`、`hyperlink` 均已存在

### 6.4 相关文档同步

本次改动已同步更新：`README.md`、`README_zh.md`（新增「自动超链接」功能段、设置页 3→4 Tab、项目结构）、`知识卡片-0-整体设计和架构.md`（新增 `hyperlinkPaste.ts` 模块与依赖关系）。

