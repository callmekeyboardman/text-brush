# Obsidian text-brush

一个 Obsidian 插件，通过右键菜单为选中文字快速添加、切换或清除颜色和字体大小。

## 功能特性

### 文字颜色

- **右键着色** — 选中文字后右键，在「文字颜色」子菜单中选择颜色即可应用
- **智能替换** — 对已着色文字重新选色时，直接替换颜色而不会产生嵌套 `<span>`
- **清除颜色** — 选中已着色文字时，菜单中出现「清除颜色」选项，一键还原为纯文本
- **加粗支持** — 菜单内置「加粗」选项，可为着色文字追加 `font-weight: bold`
- **跟随主题** — 默认调色板使用 Obsidian 内置 CSS 变量（`--color-red`、`--color-blue` 等），自动适配当前主题
- **自定义调色板** — 在设置页中自由增删改颜色，支持任意 CSS 颜色值或 `var(--…)` 引用
- **导出兼容** — 同时输出 CSS class 和 inline style，确保导出 HTML / PDF 时颜色不丢失

### 文字大小

- **右键调整** — 选中文字后右键，在「文字大小」子菜单中选择字号即可应用
- **智能替换** — 对已设字号的文字重新选择时，直接替换为新字号
- **叠加使用** — 可与颜色功能叠加，同时设置颜色和字号
- **清除大小** — 选中已设字号的文字时，菜单中出现「清除大小」选项
- **自定义字号** — 在设置页中自由增删改字号，支持任意 CSS 大小值（px、em 等）

### 通用特性

- **版本兼容** — 自动检测 Obsidian 是否支持子菜单，不支持时退化为扁平菜单
- **多语言界面** — 右键菜单与设置页支持中文和英文。设置页提供**语言**选择器（Auto / English / 中文）可手动切换；**Auto** 跟随 Obsidian 的界面语言，无法识别时回退英文。内置颜色名称也会随语言翻译；切换语言时，仅当调色板仍为未修改的默认值才会重新翻译，用户的自定义内容不会被覆盖。

## 默认调色板

> 颜色名称随当前语言自动生成（下表为中文），英文界面下显示为 Red、Orange 等。

| 颜色 | CSS 值 |
|------|--------|
| 红色 | `var(--color-red)` |
| 橙色 | `var(--color-orange)` |
| 黄色 | `var(--color-yellow)` |
| 绿色 | `var(--color-green)` |
| 青色 | `var(--color-cyan)` |
| 蓝色 | `var(--color-blue)` |
| 紫色 | `var(--color-purple)` |
| 粉色 | `var(--color-pink)` |
| 灰色 | `#95a5a6` |

## 默认字号

| 字号 |
|------|
| 12px |
| 14px |
| 16px |
| 18px |
| 20px |
| 24px |

## 输出格式

选中文字 `hello` 并应用红色后，生成：

```html
<span class="tc-color tc-color--red" style="color: var(--color-red)">hello</span>
```

对已着色文字应用 16px 字号后：

```html
<span class="tc-color tc-color--red" style="color: var(--color-red); font-size: 16px">hello</span>
```

对普通文字仅应用 16px 字号：

```html
<span style="font-size: 16px">hello</span>
```

- `class` — 供主题或 CSS Snippet 覆盖样式（使用 `!important` 即可覆盖 inline style）
- `style` — 保证在不加载 `styles.css` 的场景（导出 HTML/PDF）下样式依然可见

## 安装

### 手动安装

1. 下载或构建 `main.js`、`manifest.json`、`styles.css` 三个文件
2. 将它们复制到 `<你的仓库>/.obsidian/plugins/text-brush/` 目录下
3. 重启 Obsidian，进入 **设置 → 第三方插件**，启用 **text-brush**

## 设置

进入 **设置 → text-brush**，可以：

### 语言
- 选择右键菜单和设置页的显示语言：**Auto**（跟随 Obsidian，无法识别时回退英文）、**English** 或 **中文**

### 颜色设置
- 修改每个颜色的显示名称和 CSS 值
- 删除不需要的颜色
- 点击「新增颜色」添加自定义颜色
- 点击「恢复默认」重置为默认调色板

### 字号设置
- 修改每个字号的显示名称和 CSS 值
- 删除不需要的字号
- 点击「新增字号」添加自定义字号
- 点击「恢复默认」重置为默认字号列表

CSS 值支持：
- 颜色：十六进制 `#ff0000`、RGB `rgb(255, 0, 0)`、HSL、CSS 变量 `var(--color-red)`
- 字号：`12px`、`1.2em`、`1rem`、`larger` 等任意 CSS 大小值

## 自定义样式

在 Obsidian CSS Snippet 中，可以覆盖任意颜色的显示效果：

```css
.tc-color--red {
    color: #e74c3c !important;
}
```

## 开发

```bash
npm install
npm run dev      # esbuild 监听模式
npm run build    # 类型检查 + 生产构建
```

### 项目结构

```
src/
├── main.ts             # 插件主类（菜单构建、选区解析、文档操作）
├── types.ts            # 接口、常量、正则、工具函数
├── i18n.ts             # 自包含的 i18n 层（翻译表、语言检测）
└── settingTab.ts       # 设置页 UI
styles.css              # 颜色 class 定义 + 菜单色块样式
esbuild.config.mjs      # 构建配置
manifest.json           # Obsidian 插件清单
package.json            # 项目依赖与脚本
```

## 许可证

[MIT](LICENSE)
