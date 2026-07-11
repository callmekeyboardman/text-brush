# 知识卡片：src/types.ts

> 数据模型层，定义所有共享的接口、常量、正则表达式和纯工具函数。

---

## 文件概览

| 属性 | 值 |
|------|-----|
| 路径 | `src/types.ts` |
| 依赖 | `obsidian`（仅 `EditorPosition` 类型）、`./i18n`（type: `LangSetting`, `Translations`；value: `SUPPORTED_LANGS`, `TRANSLATIONS`） |

---

## 文件结构索引

| 行号 | 内容 |
|------|------|
| 1 | import（`EditorPosition` 类型） |
| 3–4 | import from `./i18n`（type: `LangSetting`, `Translations`；value: `SUPPORTED_LANGS`, `TRANSLATIONS`） |
| 接口 | ColorOption / TextColorSettings（含 `language`）/ ResolvedTarget |
| 常量 | DEFAULT_FONT_SIZES、DEFAULT_COLOR_DEFS、DEFAULT_SETTINGS |
| 工厂函数 | getDefaultColors()、colorsAreBuiltinDefaults() |
| 正则常量 | WRAPPER_RE、OPEN_TAG_RE、CLOSE_TAG_RE、SPAN_IN_LINE_RE |
| 工具函数 | unwrap()、stripColorSpans()、escapeAttr()、wrap()、createColorTitle()、Bold/FontSize 相关 |

---

## 接口定义

### ColorOption

```typescript
interface ColorOption {
    id: string;      // 稳定标识符，作为 CSS class 名的一部分（如 "red"、"custom-abc123"）
    name: string;    // 菜单中展示的人类可读名称（随语言而定，如 "Red" / "红色"）
    value: string;   // 任意合法 CSS 颜色值（如 "var(--color-red)" 或 "#ff0000"）
}
```

**设计要点：** `id` 与 `value` 分离。用户修改颜色值后，已存在于文档中的 `tc-color--{id}` class 不受影响，CSS Snippet 也无需改动。

### FontSizeOption

```typescript
interface FontSizeOption {
    label: string;   // 菜单中展示的名称（如 "16px"）
    value: string;   // CSS 大小值（如 "16px"、"1.2em"）
}
```

### TextColorSettings

```typescript
interface TextColorSettings {
    language: LangSetting;   // 'auto' | 'en' | 'zh'——界面语言设置
    colors: ColorOption[];
    fontSizes: FontSizeOption[];
}
```

插件的持久化数据结构，存储在 vault 的 `.obsidian/plugins/text-brush/data.json` 中。

### ResolvedTarget

```typescript
interface ResolvedTarget {
    inner: string;        // 去掉 span 包裹后的纯文本内容
    from: EditorPosition; // 文档中要替换的起始坐标
    to: EditorPosition;   // 文档中要替换的结束坐标
    wrapped: boolean;     // 是否当前已被 tc-color span 包裹
}
```

`resolveTarget()` 的返回值，是后续所有操作（着色、清除、加粗）的统一输入。

---

## 常量与工厂函数

### DEFAULT_COLOR_DEFS

9 种预设颜色的**定义**——只含 `id` 和 `value`，**不含 name**（名称由翻译表提供，见 `getDefaultColors`），使默认调色板能跟随当前语言：

| id | value |
|----|-------|
| red | `var(--color-red)` |
| orange | `var(--color-orange)` |
| yellow | `var(--color-yellow)` |
| green | `var(--color-green)` |
| cyan | `var(--color-cyan)` |
| blue | `var(--color-blue)` |
| purple | `var(--color-purple)` |
| pink | `var(--color-pink)` |
| gray | `#95a5a6` |

> 类型为 `{ id: string; value: string }[]`。相比旧的 `DEFAULT_COLORS`，此处剥离了硬编码的双语 name，颜色名改由 i18n 翻译表按语言生成。

### getDefaultColors(t)

```typescript
function getDefaultColors(t: Translations): ColorOption[]
```

工厂函数：把 `DEFAULT_COLOR_DEFS` 与传入语言的翻译表合并，为每个颜色补上本地化 `name`（`t.colorNames[def.id]`，缺失时回退 `id`）。`main.ts` 的 `loadSettings()`/`resetColors()` 和设置页切换语言时都调用它。

### colorsAreBuiltinDefaults(colors)

```typescript
function colorsAreBuiltinDefaults(colors: ColorOption[]): boolean
```

判断给定调色板是否仍是**未被用户改动的内置默认值**——长度、每项的 `id`/`value` 按顺序一致，且每个 `name` 能匹配到**任一已支持语言**（`SUPPORTED_LANGS` × `TRANSLATIONS`）的对应颜色名。

**用途：** 设置页切换语言时，据此决定是否安全地重新翻译颜色名。只有仍为默认调色板时才重译；用户一旦改过名称/值/增删，即返回 `false`，从而**绝不覆盖用户自定义**。

> 匹配所有语言（而非仅当前语言）是关键：这样从 en 切到 zh 再切回来，中途生成的另一语言默认名仍被识别为"默认"，可持续跟随语言。

### DEFAULT_FONT_SIZES

6 种预设字号：

| label | value |
|-------|-------|
| 12px | `12px` |
| 14px | `14px` |
| 16px | `16px` |
| 18px | `18px` |
| 20px | `20px` |
| 24px | `24px` |

### DEFAULT_SETTINGS

```typescript
{ language: 'auto', colors: getDefaultColors(TRANSLATIONS.en), fontSizes: DEFAULT_FONT_SIZES }
```

`loadSettings()` 加载时与 data.json 合并的兜底值。默认 `language: 'auto'`（跟随 Obsidian）；`colors` 以英文名初始化占位，`loadSettings()` 随后会在无用户数据时按解析后的实际语言用 `getDefaultColors(this.t)` 覆盖。

---

## 正则常量

### WRAPPER_RE

```regex
/^<span class="tc-color tc-color--([\w-]+)"(?:\s+style="[^"]*")?>([\s\S]*)<\/span>$/
```

匹配一个**完整的** tc-color span（锚定 `^...$`）。捕获组：
- `[1]` — 颜色 ID（如 `red`、`custom-abc123`）
- `[2]` — 内部文本

### OPEN_TAG_RE

```regex
/<span class="tc-color tc-color--[\w-]+"(?:\s+style="[^"]*")?>$/
```

锚定在字符串**末尾**（`$`），用于检测选区左侧是否紧邻一个 tc-color 开标签。

### CLOSE_TAG_RE

```regex
/^<\/span>/
```

锚定在字符串**开头**（`^`），用于检测选区右侧是否紧邻一个 `</span>` 闭标签。

### SPAN_IN_LINE_RE

```regex
/<span class="tc-color tc-color--([\w-]+)"(?:\s+style="[^"]*")?>([\s\S]*?)<\/span>/g
```

**非锚定、非贪婪、带 `g` 标志**——用于扫描整行文本，遍历行内所有 tc-color span，判断光标/选区是否落在某个 span 内部。

与 `WRAPPER_RE` 的区别：
- 不锚定 `^...$`（可匹配行中任意位置）
- 内部文本用 `[\s\S]*?`（非贪婪，一行可能有多个 span）
- 带 `g` 标志（配合 `exec` 循环逐个遍历）

**配合使用场景：** 用户在已着色文本中双击选中部分文字时，OPEN_TAG_RE/CLOSE_TAG_RE 无法匹配（标签不紧邻选区），改用 SPAN_IN_LINE_RE 扫描整行找到包含选区的 span。

---

## 工具函数 — 颜色相关

### unwrap()

```typescript
function unwrap(text: string): { inner: string; wrapped: boolean; colorId?: string }
```

检测给定文本是否为完整的 tc-color span：
- 是 → 返回 `{ inner: "内部文字", wrapped: true, colorId: "red" }`
- 否 → 返回 `{ inner: 原文, wrapped: false }`

### stripColorSpans()

```typescript
function stripColorSpans(text: string): string
```

剥掉文本中所有 tc-color span 标签，只保留内部文字。用于 `applyColor()` 应用新颜色前清理已有着色，避免产生嵌套 span。

示例：
```
输入: "6月29日，去<span class="tc-color tc-color--blue" style="...">浙江省</span>"
输出: "6月29日，去浙江省"
```

### escapeAttr()

```typescript
function escapeAttr(value: string): string
```

对 `&`、`"`、`<`、`>` 进行 HTML 实体转义。用于将用户自定义的颜色值安全地放入 `style="..."` 属性中，防止 XSS 注入。

### wrap()

```typescript
function wrap(text: string, color: ColorOption): string
```

核心包裹逻辑，输出示例：

```html
<span class="tc-color tc-color--red" style="color: var(--color-red)">hello</span>
```

同时输出 class（供 CSS 覆盖）和 inline style（供导出场景），是插件"双保险"设计的实现点。

### createColorTitle()

```typescript
function createColorTitle(color: ColorOption): DocumentFragment
```

创建菜单项的标题 DOM：一个 12×12 的色块 `<span class="tc-menu-swatch">` + 颜色名称文本节点。返回 `DocumentFragment` 供 Obsidian Menu API 的 `setTitle()` 使用。

---

## 工具函数 — Bold 相关

### unwrapBold()

```typescript
function unwrapBold(text: string): { inner: string; bold: boolean }
```

检测文本是否为 bold-only span（`<span style="font-weight: bold">...</span>`）：
- 是 → 返回 `{ inner: "内部文字", bold: true }`
- 否 → 返回 `{ inner: 原文, bold: false }`

用于 `toggleBold()` 判断是否需要取消加粗。

### wrapBold()

```typescript
function wrapBold(text: string): string
```

用 `<span style="font-weight: bold">` 包裹文字。

### hasBoldInStyle()

```typescript
function hasBoldInStyle(spanHtml: string): boolean
```

检测一段 span HTML 的 style 中是否包含 `font-weight: bold`。

### addBoldToStyle()

```typescript
function addBoldToStyle(spanHtml: string): string
```

向已有 span 的 style 属性中追加 `; font-weight: bold`。用于给已着色文字追加加粗。

### removeBoldFromStyle()

```typescript
function removeBoldFromStyle(spanHtml: string): string
```

从 span 的 style 中移除 `font-weight: bold`。用于给已着色文字取消加粗。

---

## 工具函数 — Font Size 相关

### unwrapFontSize()

```typescript
function unwrapFontSize(text: string): { inner: string; hasFontSize: boolean }
```

检测文本是否为 font-size-only span（`<span style="font-size: ...">...</span>`）：
- 是 → 返回 `{ inner: "内部文字", hasFontSize: true }`
- 否 → 返回 `{ inner: 原文, hasFontSize: false }`

### wrapFontSize()

```typescript
function wrapFontSize(text: string, size: string): string
```

用 `<span style="font-size: Xpx">` 包裹文字。对 size 值使用 `escapeAttr()` 防 XSS。

### hasFontSizeInStyle()

```typescript
function hasFontSizeInStyle(spanHtml: string): boolean
```

检测一段 span HTML 的 style 中是否包含 `font-size` 属性。

### addFontSizeToStyle()

```typescript
function addFontSizeToStyle(spanHtml: string, size: string): string
```

向已有 span 的 style 中添加或替换 `font-size` 值。如果已有 font-size 则替换，没有则追加。

### removeFontSizeFromStyle()

```typescript
function removeFontSizeFromStyle(spanHtml: string): string
```

从 span 的 style 中移除 `font-size` 属性。
