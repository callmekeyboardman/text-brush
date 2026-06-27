# 知识卡片：src/main.ts

> 插件主类，继承 `obsidian.Plugin`，负责右键菜单构建、选区解析和文档操作。

---

## 文件概览

| 属性 | 值 |
|------|-----|
| 路径 | `src/main.ts` |
| 导出 | `default class TextColorPlugin extends Plugin` |
| 依赖 | `obsidian`（type: EditorPosition；value: Editor, Menu, MenuItem, Plugin）、`./types`（type: ColorOption, TextColorSettings, ResolvedTarget；value: DEFAULT_COLORS, DEFAULT_SETTINGS, 正则, 工具函数）、`./settingTab` |

---

## 文件结构索引

| 行号 | 内容 |
|------|------|
| 1–2 | import type（仅类型：`EditorPosition`、`ColorOption`、`TextColorSettings`、`ResolvedTarget`） |
| 3 | import 运行时值（`Editor`, `Menu`, `MenuItem`, `Plugin`） |
| 5 | import `TextColorSettingTab` |
| 7–8 | import type（仅类型）+ import 运行时值 from `./types` |
| 16–20 | 模块增强：给 MenuItem 补充 `setSubmenu?()` 类型 |
| 22–193 | 类：TextColorPlugin |

---

## `import type` 与外部依赖 obsidian

`obsidian` 是**外部依赖**，在 esbuild 配置中声明了 `external: ['obsidian']`，构建时不会被打包进 `main.js`，运行时由 Obsidian App 自身提供。

因此对 `obsidian` 的 import，无论写 `import` 还是 `import type`，都不影响产物体积。加上 `import type` 的价值是**语义清晰**：让读代码的人一眼看出 `EditorPosition` 只用于类型标注，而 `Editor`、`Menu`、`MenuItem`、`Plugin` 在运行时被实际使用（如 `extends Plugin`、`new Menu()`）。

---

## 模块声明扩展（第 16–20 行）

```typescript
declare module 'obsidian' {
    interface MenuItem {
        setSubmenu?(): Menu;
    }
}
```

这是 TypeScript 的**模块增强（Module Augmentation）**语法。

**背景问题：** Obsidian 运行时实际存在 `MenuItem.setSubmenu()` 方法，但官方发布的类型定义文件 `obsidian.d.ts` 中没有声明它。直接调用会报类型错误。

**解决方式：** `declare module 'obsidian'` 的含义是"在已有的 `obsidian` 模块类型定义上，给 `MenuItem` 接口**追加**一个可选方法 `setSubmenu`"。

**类比理解：** 想象 `obsidian.d.ts` 是一份官方合同，里面写了 MenuItem 有哪些方法。但实际产品比合同多了个功能（setSubmenu）。`declare module` 就像在合同上加一页附录，声明"还有这个方法存在"，让 TypeScript 编译器认可它。

**为什么加 `?`（可选）：** 因为这个方法不是所有 Obsidian 版本都有，所以声明为可选，配合 `detectSubmenuSupport()` 在运行时探测是否真的可用。

**关键点：** `declare module` 只影响类型系统，不产生任何运行时代码。

---

## TextColorPlugin 类

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `settings` | `TextColorSettings` | 当前颜色配置 |
| `submenuSupported` | `boolean` | 运行时是否支持子菜单 |

### 方法总览

| 方法 | 功能 |
|------|------|
| `onload()` | 生命周期入口：加载设置、检测子菜单支持、注册事件、添加设置页 |
| `detectSubmenuSupport()` | 运行时探测 `MenuItem.setSubmenu` 是否可用 |
| `buildMenu()` | 收到右键事件后构建菜单结构（颜色 + 字号，子菜单或扁平菜单） |
| `resolveTarget()` | **核心逻辑** — 分析选区，确定实际要操作的文档范围 |
| `populateColorMenu()` | 向菜单填充颜色选项 + 加粗 + 清除颜色 |
| `populateFontSizeMenu()` | 向菜单填充字号选项 + 清除大小 |
| `applyColor()` | 用 `wrap()` 包裹文字并替换文档内容 |
| `clearColor()` | 移除 span，只保留纯文本 |
| `toggleBold()` | 为已着色 span 追加/移除 `font-weight: bold` |
| `applyFontSize()` | 为选中文字应用字号（追加/替换 font-size） |
| `clearFontSize()` | 从 span style 中移除 font-size |
| `reselect()` | 替换后重新选中文字，保持用户体验 |
| `loadSettings()` | 从 Obsidian data.json 读取设置，合并默认值 |
| `saveSettings()` | 持久化设置到 data.json |
| `resetColors()` | 重置调色板为默认 |
| `resetFontSizes()` | 重置字号列表为默认 |

---

### onload() — 生命周期入口

`onload()` 是 Obsidian Plugin 基类定义的**生命周期钩子**，由框架在插件启用时自动调用，不需要在自己的代码中手动调用。

**框架调用链：**

```
Obsidian App 启动
  → 扫描 .obsidian/plugins/ 目录，发现 manifest.json
  → 找到 mainfest.json 同目录下的 main.js 文件，执行 require('main.js') 加载模块
  → 取 module.exports.default（即 export default class）
  → new TextColorPlugin(app, manifest)   ← 框架实例化
  → await plugin.onload()                ← 框架调用
```

> 类似于 React 的 `componentDidMount()`、Vue 的 `mounted()`、Android 的 `onCreate()`。

对应的**生命周期钩子**还有 `onunload()`（插件被禁用时调用），本插件未使用，因为 `registerEvent()` 注册的事件会被框架自动清理。

**执行顺序：**

1. `loadSettings()` — 从 data.json 读取配置
2. `detectSubmenuSupport()` — 探测子菜单 API
3. `registerEvent()` — 注册 `editor-menu` 事件监听
4. 添加设置页 Tab

#### registerEvent()：

`registerEvent()` 是 Plugin 基类提供的方法，作用是注册事件监听并**自动管理生命周期**——插件被禁用时，框架自动移除该监听，无需手动 `off()`。

```typescript
this.registerEvent(
    this.app.workspace.on('editor-menu', (menu, editor) =>
        this.buildMenu(menu, editor),
    ),
);
```

- `this.app.workspace` — Obsidian 工作区对象，管理所有标签页和编辑器
- `'editor-menu'` — Obsidian 内置事件，用户在编辑器中右键时触发
- 回调参数：`menu`（即将显示的右键菜单，可往里添加选项）、`editor`（当前编辑器实例，可读取选区/替换文本）

事件流程：用户右键 → Obsidian 创建 Menu → 触发事件 → 插件往 menu 里加颜色选项 → Obsidian 显示菜单。


#### addSettingTab()

`addSettingTab()` 是 Plugin 基类提供的方法，作用是注册一个设置页面到 Obsidian 的全局设置中。

调用后，用户在 `设置 → 第三方插件 → Text Color` 就能看到插件的配置界面（调色板增删改）。

和 `registerEvent()` 一样，框架会自动管理生命周期——插件禁用时设置页自动移除。

### loadSettings()

1. 从 Obsidian 的 `loadData()` 读取 `data.json` 文件（文件位置默认是 `.obsidian/plugins/text-format/data.json`）
2. 用读取出来的结果，覆盖插件的默认设置的 DEFAULT_SETTINGS，作为 `settings` 的值
3. 若 `data.json` 内容为空，`settings` 使用默认设置的深拷贝

> 因为 `data.json` 是用户数据文件，内容不可控，所以用 `Partial<TextColorSettings>` 表示，任何属性都可能缺失，甚至整个对象都不存在。

`data.json` 内容示例：

```json
{
  "colors": [
    {
      "id": "red",
      "name": "红色 Red",
      "value": "var(--color-red)"
    }
  ]
}
```

### detectSubmenuSupport()

检查当前版本的 obsidian 是否支持子菜单功能。

创建一个临时 `Menu` 实例，调用它的 `addItem` 方法，检查它的入参 `item` 是否支持方法 `setSubmenu`，决定后续的右键菜单时的呈现方式：
- 如果支持，用子菜单的方式呈现
- 如果不支持，颜色列表平铺在主菜单里

优点：
- 不依赖版本号判断，直接探测能力
- 只在加载时执行一次，后续使用缓存的结果值

### buildMenu()

右键时构造菜单：

```
分析当前选中的区域，得到要操作的目标（选了什么文字、是否已经着色、实际替换范围），如果没有选中，则不添加任何菜单选项。

支持子菜单？
  ├─ 是 → 添加「文字颜色」菜单项，调用 setSubmenu() 创建子菜单
  └─ 否 → 在主菜单中添加分隔线 + 禁用的标题项 + 颜色列表 + 分隔线
```

关键在于 `resolveTarget` 方法。

### resolveTarget() — 核心算法

**插件最核心的方法。** 返回 null 表示无有效选区（空或纯空白）。

处理四种情况：

```
情况 1：选区本身就是完整的 tc-color span
  用户选中: <span class="tc-color tc-color--red" style="...">hello</span>
  → 直接使用，inner = "hello"，wrapped = true

情况 2：选区紧邻 span 标签（选中了 span 内全部文字）
  文档内容: ...<span class="tc-color tc-color--red" style="...">hello</span>...
  选区范围: hello
  → 用 OPEN_TAG_RE / CLOSE_TAG_RE 检测，向左右扩展将标签纳入替换范围

情况 2.5：选区在 span 内部但非紧邻标签（选中了部分文字）
  文档内容: ...<span class="tc-color tc-color--red" style="...">浙江省中医院体检</span>...
  选区范围: 中医
  → 用 SPAN_IN_LINE_RE 扫描整行，找到包含选区的 span，返回整个 span 范围

情况 3：选区是普通文本
  → 直接包裹，wrapped = false
```

算法流程：

```
1. 读取选区文本
   └─ 空/纯空白 → return null

2. unwrap(选区)
   └─ 是完整 span → return { inner, from, to, wrapped: true }

3. 取选区左侧文本（同行，from 之前）
   取选区右侧文本（同行，to 之后）
   └─ 左侧匹配 OPEN_TAG_RE 且右侧匹配 CLOSE_TAG_RE
      → 扩展 from/to 包含标签
      → return { inner: 选区原文, 扩展后的from/to, wrapped: true }

4. 选区在同一行？
   └─ 是 → 用 SPAN_IN_LINE_RE 遍历行内所有 span
      └─ 选区 [from.ch, to.ch] 落在某个 span 的内容区间内
         → return { inner: span内全部文字, from: span起点, to: span终点, wrapped: true }

5. 以上都不满足
   → return { inner: 选区原文, from, to, wrapped: false }
```

**情况 2.5 的关键计算：**
- `innerStart` = 开标签 `>` 之后的位置（span 内容起始）
- `innerEnd` = `</span>` 之前的位置（span 内容结束）
- 判断条件：`from.ch >= innerStart && to.ch <= innerEnd`
- 返回的 `inner` 是 span 内**全部**文字（不仅仅是用户选中的部分），后续操作（换色/清除）针对整个 span

### populateColorMenu()

向菜单（主菜单或子菜单）填充具体选项。接收 `menu`、`editor`、`target` 三个参数。

**菜单结构：**

```
┌──────────────────────────┐
│ [■] 红色 Red             │  ← 遍历 settings.colors，每个颜色一行
│ [■] 橙色 Orange          │     标题由 createColorTitle() 生成（色块 + 名称）
│ [■] 蓝色 Blue            │     点击 → applyColor()
│ ...                      │
├──────────────────────────┤  ← addSeparator()
│ 🔤 加粗                  │  ← 点击 → toggleBold()
├──────────────────────────┤  ← addSeparator()（仅 target.wrapped 时出现）
│ 🧹 清除颜色              │  ← 点击 → clearColor()（仅 target.wrapped 时出现）
└──────────────────────────┘
```

**逻辑要点：**
- 颜色列表来自 `this.settings.colors`，用户可在设置页自定义
- 「清除颜色」只在 `target.wrapped === true` 时显示（未着色的文字没有可清除的内容）
- 每个菜单项的 `onClick` 都闭包捕获了 `editor` 和 `target`，点击时才执行操作

### toggleBold()

根据当前状态切换加粗：

| 场景 | 行为 |
|------|------|
| `target.wrapped === true`（tc-color span） | 检查 style 中是否有 `font-weight: bold`；有则移除，无则追加 |
| `target.wrapped === false` 且已是 bold span | 去掉 `<span style="font-weight: bold">` 包裹，恢复纯文本（取消加粗） |
| `target.wrapped === false` 且是普通文本 | 用 `<span style="font-weight: bold">` 包裹（加粗） |

**检测 bold span 的正则：** `/^<span style="font-weight: bold">([\s\S]*)<\/span>$/`

这样实现了真正的 toggle：对已加粗文字再点「加粗」= 取消加粗，不会产生嵌套 span。

### applyColor()

为选中文字应用颜色。流程：

1. `stripColorSpans(target.inner)` — 先剥掉内部已有的 tc-color span 标签，避免嵌套
2. `wrap(cleaned, color)` — 用新颜色包裹纯文本
3. `editor.replaceRange()` — 替换文档内容
4. `reselect()` — 保持选中状态

**为什么需要 stripColorSpans：** 当用户选中的范围包含已着色的子串时（如"6月29日，去`<span blue>`浙江省`</span>`"），如果不先剥掉内部 span，wrap 会在外层再套一个 span，产生嵌套。剥掉后得到纯文本再包裹，确保结果始终是单层 span。

### clearColor()

将 `target.from` 到 `target.to` 替换为 `target.inner`（纯文本），移除 span 包裹。

### reselect()

替换文本后重新计算选区终点并调用 `editor.setSelection()`，让用户操作后文字保持选中状态，方便连续操作。

---

## 完整调用关系图

```
onload()
  ├── loadSettings()
  ├── detectSubmenuSupport()
  ├── workspace.on('editor-menu') ──▶ buildMenu()
  │                                      ├── resolveTarget()
  │                                      │     ├── unwrap()              [types.ts]
  │                                      │     ├── OPEN_TAG_RE / CLOSE_TAG_RE
  │                                      │     └── SPAN_IN_LINE_RE       [types.ts]
  │                                      ├── populateColorMenu()
  │                                      │     ├── createColorTitle()    [types.ts]
  │                                      │     ├── applyColor()
  │                                      │     │     ├── stripColorSpans() [types.ts]
  │                                      │     │     ├── wrap()            [types.ts]
  │                                      │     │     └── reselect()
  │                                      │     ├── toggleBold()
  │                                      │     │     ├── hasBoldInStyle()    [types.ts]
  │                                      │     │     ├── addBoldToStyle()    [types.ts]
  │                                      │     │     ├── removeBoldFromStyle() [types.ts]
  │                                      │     │     ├── unwrapBold()        [types.ts]
  │                                      │     │     ├── wrapBold()          [types.ts]
  │                                      │     │     └── reselect()
  │                                      │     └── clearColor()
  │                                      │           └── reselect()
  │                                      └── populateFontSizeMenu()
  │                                            ├── applyFontSize()
  │                                            │     ├── addFontSizeToStyle() [types.ts]
  │                                            │     ├── unwrapFontSize()     [types.ts]
  │                                            │     ├── wrapFontSize()       [types.ts]
  │                                            │     └── reselect()
  │                                            └── clearFontSize()
  │                                                  ├── removeFontSizeFromStyle() [types.ts]
  │                                                  └── reselect()
  └── addSettingTab(TextColorSettingTab)  [settingTab.ts]
         └── display()
```
