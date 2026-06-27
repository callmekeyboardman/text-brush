# 知识卡片：src/settingTab.ts

> 插件设置页面，继承 `PluginSettingTab`，提供颜色调色板和字号列表的增删改 UI。

---

## 文件概览

| 属性 | 值 |
|------|-----|
| 路径 | `src/settingTab.ts` |
| 导出 | `class TextColorSettingTab extends PluginSettingTab` |
| 依赖 | `obsidian`（App, Setting, PluginSettingTab）、`./main`（type-only）、`./types`（DEFAULT_COLORS, DEFAULT_FONT_SIZES） |

---

## 文件结构索引

| 行号 | 内容 |
|------|------|
| 1 | import { App, Setting, PluginSettingTab } from 'obsidian' |
| 2 | `import type TextColorPlugin from './main'` — 仅类型引用，避免循环依赖 |
| 3 | import { DEFAULT_COLORS } from './types' |
| 5–88 | 类：TextColorSettingTab |

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

`containerEl` 是 Obsidian 设置面板右侧内容区中分配给本插件的容器。所有设置页 UI 元素都渲染在这个容器内。每次用户切换到其他设置页再切回来时，Obsidian 会重新调用 `display()`，所以开头先 `containerEl.empty()` 清空旧内容再重新渲染。

### constructor()

```typescript
constructor(app: App, plugin: TextColorPlugin)
```

调用 `super(app, plugin)` 注册设置页，保存 plugin 引用。

### display()

渲染设置页面的唯一方法。每次调用先 `containerEl.empty()` 清空再重建。每次用户从其他设置页切回来时，Obsidian 会重新调用此方法。

**页面结构：**

```
┌──────────────────────────────────────────┐
│ h2: 文字颜色                              │
│ p:  配置右键菜单中可选的颜色...             │
│                                           │
│ ┌── 颜色列表（forEach 循环）─────────────┐ │
│ │ [色块] [名称输入框] [CSS值输入框] [🗑️]  │ │
│ │ [色块] [名称输入框] [CSS值输入框] [🗑️]  │ │
│ │ ...                                    │ │
│ └────────────────────────────────────────┘ │
│                                           │
│ [+ 新增颜色]  [⚠️ 恢复默认]               │
│                                           │
│ h2: 文字大小                              │
│ p:  配置右键菜单中可选的字号...             │
│                                           │
│ ┌── 字号列表（forEach 循环）─────────────┐ │
│ │ [名称输入框] [CSS值输入框] [🗑️]         │ │
│ │ [名称输入框] [CSS值输入框] [🗑️]         │ │
│ │ ...                                    │ │
│ └────────────────────────────────────────┘ │
│                                           │
│ [+ 新增字号]  [⚠️ 恢复默认]               │
└──────────────────────────────────────────┘
```

**页面构造过程（按代码执行顺序，从上到下渲染）：**

```typescript
const { containerEl } = this;
containerEl.empty();    // 1. 清空旧内容

containerEl.createEl('h2', { text: '文字颜色' });         // 2. 创建标题
containerEl.createEl('p', { text: '配置说明...', cls: '...' }); // 3. 创建说明文字

this.plugin.settings.colors.forEach((color, idx) => {     // 4. 遍历颜色列表
    const setting = new Setting(containerEl);             //    创建空的设置行并追加到容器
    // → 往 setting 里填充色块、输入框、删除按钮
});

new Setting(containerEl)                                   // 5. 按钮行（最后创建，所以在最下面）
    .addButton(btn => /* 新增颜色 */)
    .addButton(btn => /* 恢复默认 */);
```

**关键 API：**

| API | 作用 |
|-----|------|
| `containerEl.empty()` | Obsidian 扩展方法，清除容器内所有子元素 |
| `containerEl.createEl(tag, opts)` | 创建子元素并自动 append 到容器末尾，一行完成 createElement + 设属性 + appendChild |
| `el.createSpan(opts)` | `createEl('span', opts)` 的简写，常用于创建内联小元素（如色块预览） |
| `new Setting(containerEl)` | 创建一个标准设置行（带 nameEl 左侧区 + controlEl 右侧控件区的 div），自动 append 到容器 |
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

---

## 交互逻辑详解

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
plugin.settings.colors.push({ id, name: '新颜色', value: '#888888' });
```

- ID 格式：`custom-` + 时间戳 base36 编码（如 `custom-lx5f3k2`），确保唯一且稳定
- 保存后调用 `display()` 重绘以显示新行

### 恢复默认

```typescript
plugin.resetColors();   // colors = DEFAULT_COLORS 的深拷贝
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

1. **无确认按钮** — 每次字段变更立即 `saveSettings()`，减少用户操作步骤
2. **完全重绘** — 增删操作后调用 `display()` 重建 DOM，实现简单可靠（颜色数量少，无性能问题）
3. **色块实时预览** — CSS 值输入框 onChange 同步更新色块 `backgroundColor`，即时反馈

### 为什么选择全量重绘而非局部更新？

这是经典的 **简单全量重绘 vs 复杂增量更新** 取舍。

**全量重绘（当前方案）：**
- 每次增删颜色后调用 `display()` 清空重建整个页面
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
