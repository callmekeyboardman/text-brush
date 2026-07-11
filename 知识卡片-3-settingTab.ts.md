# 知识卡片：src/settingTab.ts

> 插件设置页面，继承 `PluginSettingTab`，提供颜色调色板和字号列表的增删改 UI。

---

## 文件概览

| 属性 | 值 |
|------|-----|
| 路径 | `src/settingTab.ts` |
| 导出 | `class TextColorSettingTab extends PluginSettingTab` |
| 依赖 | `obsidian`（App, Setting, PluginSettingTab）、`./main`（type-only）、`./types`（`getDefaultColors`, `colorsAreBuiltinDefaults`；type: `SettingsTabId`）、`./i18n`（type: `LangSetting`, `Translations`；value: `getTranslations`, `LANGUAGE_OPTIONS`） |

---

## 文件结构索引

| 行号 | 内容 |
|------|------|
| 1 | import { App, Setting, PluginSettingTab } from 'obsidian' |
| 2 | `import type TextColorPlugin from './main'` — 仅类型引用，避免循环依赖 |
| 3 | `import type { LangSetting, Translations } from './i18n'` |
| 4 | import { getTranslations, LANGUAGE_OPTIONS } from './i18n' |
| 5 | import { colorsAreBuiltinDefaults, getDefaultColors } from './types' |
| 6 | `import type { SettingsTabId } from './types'` — Tab 标识符类型 |
| 8 | `type TabId = SettingsTabId` — 本文件内的 TabId 别名 |
| 10 | `const TAB_IDS: TabId[]` — Tab 顺序（追加新 ID 即可加 Tab） |
| 类 | TextColorSettingTab |

---

## 循环依赖处理

```typescript
import type TextColorPlugin from './main';
```

`settingTab.ts` 需要引用 `TextColorPlugin` 来声明 `plugin` 属性的类型。使用 `import type` 使该引用仅存在于编译期，构建产物中不产生运行时 `require('./main')`，从而打破 main ↔ settingTab 的循环依赖。

---

## TextColorSettingTab 类

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `plugin` | `TextColorPlugin` | 插件实例引用，用于读写设置 |
| `containerEl` | `HTMLElement` | 继承自基类，设置页面的根 DOM 容器元素 |
| `activeTab`（getter/setter） | `TabId` | 当前激活的 Tab。getter 从 `plugin.settings.activeSettingsTab` 读取（带 `TAB_IDS` 校验，非法值回退 `'general'`）；setter 写回设置，切换时由调用方持久化 |

`containerEl` 是 Obsidian 设置面板右侧内容区中分配给本插件的容器。所有设置页 UI 元素都渲染在这个容器内。每次用户切换到其他设置页再切回来时，Obsidian 会重新调用 `display()`，所以开头先 `containerEl.empty()` 清空旧内容再重新渲染。

### constructor()

```typescript
constructor(app: App, plugin: TextColorPlugin)
```

调用 `super(app, plugin)` 注册设置页，保存 plugin 引用。

### display()

渲染设置页面的唯一方法。每次调用先 `containerEl.empty()` 清空再重建。每次用户从其他设置页切回来时，Obsidian 会重新调用此方法。

**页面结构（Tab 导航）：**

```
┌──────────────────────────────────────────┐
│ [ 通用 ][ 文字颜色 ][ 字体 ]              │  ← Tab 栏（tb-settings-tabs）
│──────────────────────────────────────────│
│  （当前 Tab 的内容渲染在此处）            │
│                                          │
│  例如选中"文字颜色" Tab 时：              │
│  Heading: 文字颜色                       │
│  Setting(desc): 配置右键菜单中可选的颜色  │
│  ┌── 颜色列表（forEach）──────────────┐  │
│  │ [色块] [名称] [CSS值] [🗑️]          │  │
│  └────────────────────────────────────┘  │
│  [+ 新增颜色]  [⚠️ 恢复默认]             │
└──────────────────────────────────────────┘
```

三个 Tab 内容容器始终都被创建并渲染，只是用 CSS `display: none/block`（`tb-settings-tab-content--active` 类）控制显隐——切换 Tab 不触发重绘，仅切换 class，响应即时。

> 所有 Tab 标签、标题、占位符、按钮文字都来自 `const t = this.plugin.t;`，随语言实时切换。标题用 `new Setting(container).setName(...).setHeading()`（Obsidian 标准 Setting API），而非直接 `createEl('h2')`。

**构造过程（按代码执行顺序）：**

```typescript
const { containerEl } = this;
containerEl.empty();               // 1. 清空旧内容
containerEl.addClass('tb-settings'); // 2. 加根类（供 CSS 控制设置项分隔线等）
const t = this.plugin.t;            // 3. 取当前语言翻译表

// 4. 渲染 Tab 栏：为每个 TAB_IDS 创建按钮，点击切换 activeTab 并持久化
const tabBar = containerEl.createDiv({ cls: 'tb-settings-tabs' });
for (const id of TAB_IDS) {
    const btn = tabBar.createEl('button', { cls: `tb-settings-tab${id===this.activeTab?' --active':''}`, text: this.getTabLabel(id, t) });
    btn.addEventListener('click', () => {
        this.activeTab = id;                          // 写回 settings
        void this.plugin.saveSettings();              // 持久化
        // 仅切换 class，不重绘
        for (const tabId of TAB_IDS) { tabButtons.get(tabId)?.toggleClass(...); tabContents.get(tabId)?.toggleClass(...); }
    });
}

// 5. 为每个 Tab 创建内容容器（全部创建，CSS 控制显隐）
for (const id of TAB_IDS) {
    tabContents.set(id, containerEl.createDiv({ cls: `tb-settings-tab-content${id===this.activeTab?' --active':''}` }));
}

// 6. 把各功能域渲染到对应容器
this.renderGeneralTab(tabContents.get('general')!, t); // 语言选择
this.renderColorsTab(tabContents.get('colors')!, t);   // 颜色列表
this.renderFontsTab(tabContents.get('fonts')!, t);     // 字号列表
```

**`getTabLabel(id, t)`** — 把 TabId 映射到翻译表中的标签（`t.settingTabGeneral`/`settingTabColors`/`settingTabFonts`）。

**关键 API：**

| API | 作用 |
|-----|------|
| `containerEl.empty()` | Obsidian 扩展方法，清除容器内所有子元素 |
| `containerEl.createDiv({ cls })` | 创建 div 并自动 append 到容器 |
| `el.createEl(tag, opts)` | 创建子元素并自动 append 到容器末尾，一行完成 createElement + 设属性 + appendChild |
| `el.toggleClass(cls, on)` | Obsidian 扩展方法，按布尔值增删 class——切换 Tab 显隐的核心 |
| `el.createSpan(opts)` | `createEl('span', opts)` 的简写，常用于创建内联小元素（如色块预览） |
| `new Setting(container)` | 创建一个标准设置行（带 nameEl 左侧区 + controlEl 右侧控件区的 div），自动 append 到容器 |
| `setting.addText(cb)` | 往设置行的 controlEl 里添加文本输入框 |
| `setting.addExtraButton(cb)` | 往设置行里添加图标按钮 |
| `setting.addButton(cb)` | 往设置行里添加文字按钮 |

**每个 Setting 行的内部结构：**

```
┌─────────────────────────────────────────────────┐
│  nameEl（左侧）  │  controlEl（右侧控件区）      │
│  [色块预览]       │  [输入框] [输入框] [按钮]     │
└─────────────────────────────────────────────────┘
```

页面元素的位置完全由代码执行顺序决定——先创建的在上面，后创建的在下面（DOM appendChild 的自然顺序）。

### activeTab 持久化

`activeTab` 不是实例字段，而是 getter/setter 对，背后读写 `plugin.settings.activeSettingsTab`：

- **getter**：`const stored = plugin.settings.activeSettingsTab; return TAB_IDS.includes(stored) ? stored : 'general';` —— `TAB_IDS.includes` 校验防止 data.json 里存了已废弃的 Tab id（未来移除某 Tab 时兜底）。
- **setter**：直接写 `plugin.settings.activeSettingsTab = id`。
- **持久化时机**：Tab 按钮 click 回调里 setter 之后立即 `void this.plugin.saveSettings()`，把选择写入 data.json。

> Obsidian 每次打开设置页会重建 `TextColorSettingTab` 实例，若用实例字段记忆 activeTab 会丢失。持久化到 settings 后，重新打开设置页时 `display()` 读取 getter 即恢复到上次查看的 Tab。

### renderGeneralTab() / renderColorsTab() / renderFontsTab()

三个私有方法各自渲染一个 Tab 的内容，接收 `container` 和 `t` 两个参数。逻辑与重构前完全一致，只是从原 `display()` 平铺结构拆分而来：

- **`renderGeneralTab()`** — 语言选择下拉（Auto / English / 中文）
- **`renderColorsTab()`** — 颜色标题 + 说明 + 颜色列表（forEach）+ 新增/恢复默认按钮
- **`renderFontsTab()`** — 字号标题 + 说明 + 字号列表（forEach）+ 新增/恢复默认按钮

> 拆分后新增功能只需：在 `types.ts` 的 `SettingsTabId` 追加新 id → 在 `TAB_IDS` 追加 → 在 `getTabLabel` 补映射 → 在 `display()` 末尾补一行 `this.renderXxxTab(...)`。无需改动已有 Tab 逻辑。

---

## 交互逻辑详解

### 语言切换（下拉）

页面顶部的语言下拉由 `LANGUAGE_OPTIONS`（Auto / English / 中文）填充，`onChange` 逻辑：

```typescript
this.plugin.settings.language = value as LangSetting;
// 仅当调色板仍是未改动的内置默认时，才跟随新语言重译颜色名
if (colorsAreBuiltinDefaults(this.plugin.settings.colors)) {
    this.plugin.settings.colors = getDefaultColors(
        getTranslations(this.plugin.settings.language),
    );
}
await this.plugin.saveSettings();
this.display();   // 重绘，使菜单/标签立即变为新语言
```

**关键点：**
- `colorsAreBuiltinDefaults()` 守卫确保**用户自定义过的调色板不会被覆盖**——改过名称/值/增删后切换语言，颜色保持原样
- `this.display()` 重绘整页，语言变化立即反映到所有标签、标题、占位符、按钮文字
- 由于 `plugin.t` 是 getter，重绘时读取的就是新语言的翻译表

### 颜色列表渲染

对 `plugin.settings.colors` 数组进行 `forEach` 遍历，每个颜色生成一行 `Setting`：

| UI 元素 | 实现 | 行为 |
|---------|------|------|
| 色块预览 | `nameEl.createSpan({ cls: 'tc-menu-swatch' })` | 背景色实时跟随 CSS 值变化 |
| 名称输入框 | `addText()` | `onChange` → 更新 `colors[idx].name` → `saveSettings()` |
| CSS 值输入框 | `addText()` | `onChange` → 更新 `colors[idx].value` → `saveSettings()` → 更新色块 |
| 删除按钮 | `addExtraButton('trash')` | `onClick` → `splice(idx, 1)` → `saveSettings()` → `display()` 重绘 |

### 新增颜色

```typescript
const id = `custom-${Date.now().toString(36)}`;
plugin.settings.colors.push({ id, name: t.newColorName, value: '#888888' });
```

- ID 格式：`custom-` + 时间戳 base36 编码（如 `custom-lx5f3k2`），确保唯一且稳定
- 新颜色名称 `t.newColorName` 取自当前语言（英文 "New color" / 中文 "新颜色"）
- 保存后调用 `display()` 重绘以显示新行

### 恢复默认

```typescript
plugin.resetColors();   // colors = getDefaultColors(this.t)，按当前语言生成
await plugin.saveSettings();
this.display();         // 重绘
```

按钮带 `setWarning()` 红色样式，提示用户这是破坏性操作（会丢失所有自定义颜色）。

### 字号列表渲染

对 `plugin.settings.fontSizes` 数组进行 `forEach` 遍历，每个字号生成一行 `Setting`：

| UI 元素 | 实现 | 行为 |
|---------|------|------|
| 名称输入框 | `addText()` | `onChange` → 更新 `fontSizes[idx].label` → `saveSettings()` |
| CSS 值输入框 | `addText()` | `onChange` → 更新 `fontSizes[idx].value` → `saveSettings()` |
| 删除按钮 | `addExtraButton('trash')` | `onClick` → `splice(idx, 1)` → `saveSettings()` → `display()` 重绘 |

### 新增字号

```typescript
plugin.settings.fontSizes.push({ label: '16px', value: '16px' });
```

保存后调用 `display()` 重绘以显示新行。

### 恢复默认字号

```typescript
plugin.resetFontSizes();   // fontSizes = DEFAULT_FONT_SIZES 的深拷贝
await plugin.saveSettings();
this.display();
```

---

## 设计要点

1. **Tab 化结构** — 设置页按功能域拆为通用/文字颜色/字体三个 Tab，新功能只需追加 `TAB_IDS` + 类型 + `getTabLabel` 映射 + 一个 `renderXxxTab` 方法，不碰已有逻辑
2. **Tab 状态持久化** — `activeTab` 通过 getter/setter 读写 `settings.activeSettingsTab`，切换即 `saveSettings()`；重新打开设置页自动恢复上次查看的 Tab
3. **无确认按钮** — 每次字段变更立即 `saveSettings()`，减少用户操作步骤
4. **Tab 切换不重绘** — 三个 Tab 内容始终渲染，切换仅 `toggleClass` 切换显隐，响应即时；只有增删项、切换语言、切换 Tab（需持久化）时才 `display()` 重建
5. **色块实时预览** — CSS 值输入框 onChange 同步更新色块 `backgroundColor`，即时反馈
6. **语言即时生效** — 切换语言后重绘整页；所有文案经 `plugin.t` 读取，无需逐个 setText，且用 `colorsAreBuiltinDefaults()` 守卫保护用户自定义颜色

### 为什么选择全量重绘而非局部更新？

这是经典的 **简单全量重绘 vs 复杂增量更新** 取舍。

**全量重绘（当前方案）：**
- 增删颜色、切换语言后调用 `display()` 清空重建整个页面
- 优点：代码简单、无状态不一致风险、不需要追踪 DOM 引用和索引偏移
- 缺点：理论上"浪费"——重建了没变化的部分

**局部更新（未采用）：**
- 只修改变化的那一行 DOM
- 优点：性能更优
- 缺点：需要维护每行的 DOM 引用、处理删除后的索引偏移、增删排序各自单独实现，容易出 bug

**不采用局部更新的原因：**
- 颜色数量少（通常 9~20 个），重建十几个 DOM 元素耗时 <1ms
- 操作频率低（用户不会每秒修改设置），全量重绘完全可以承受
- Obsidian 官方插件的设置页也普遍用全量重绘
- 只有列表达到数百项且交互频繁时（如实时搜索过滤），才值得上增量更新或虚拟滚动

> **Tab 切换例外**：切换 Tab 不走 `display()` 全量重绘，而是 `toggleClass` 切换内容容器的显隐 class——因为 Tab 切换频繁且无需重建 DOM，纯 CSS 切换最轻量。
