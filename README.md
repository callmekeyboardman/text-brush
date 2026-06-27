# Obsidian text-brush

[中文文档|Chinese](README_zh.md)

An Obsidian plugin that lets you quickly apply, switch, or clear text color and font size via the right-click context menu.

## Features

### Text Color

- **Right-click to color** — Select text, right-click, and pick a color from the "Text Color" submenu
- **Smart replace** — Re-coloring already-colored text replaces the color in place without nesting `<span>` tags
- **Clear color** — A "Clear color" option appears when colored text is selected
- **Bold support** — A built-in "Bold" option appends `font-weight: bold` to colored text
- **Theme-aware** — The default palette uses Obsidian's built-in CSS variables (`--color-red`, `--color-blue`, etc.), adapting to the current theme
- **Custom palette** — Add, remove, or edit colors in Settings; supports any CSS color value or `var(--…)` reference
- **Export-friendly** — Outputs both CSS class and inline style so colors survive HTML/PDF export

### Font Size

- **Right-click to resize** — Select text, right-click, and pick a size from the "Font Size" submenu
- **Smart replace** — Re-sizing already-sized text replaces the size in place
- **Stackable** — Can be combined with color on the same selection
- **Clear size** — A "Clear size" option appears when sized text is selected
- **Custom sizes** — Add, remove, or edit sizes in Settings; supports any CSS size value (px, em, etc.)

### General

- **Version compatible** — Automatically detects whether Obsidian supports submenus; falls back to a flat menu if not

## Default Palette

| Color | CSS Value |
|-------|-----------|
| Red | `var(--color-red)` |
| Orange | `var(--color-orange)` |
| Yellow | `var(--color-yellow)` |
| Green | `var(--color-green)` |
| Cyan | `var(--color-cyan)` |
| Blue | `var(--color-blue)` |
| Purple | `var(--color-purple)` |
| Pink | `var(--color-pink)` |
| Gray | `#95a5a6` |

## Default Font Sizes

| Size |
|------|
| 12px |
| 14px |
| 16px |
| 18px |
| 20px |
| 24px |

## Output Format

Selecting `hello` and applying red produces:

```html
<span class="tc-color tc-color--red" style="color: var(--color-red)">hello</span>
```

Applying 16px font size to already-colored text:

```html
<span class="tc-color tc-color--red" style="color: var(--color-red); font-size: 16px">hello</span>
```

Applying only 16px font size to plain text:

```html
<span style="font-size: 16px">hello</span>
```

- `class` — Allows themes or CSS Snippets to override styles (use `!important` to override inline style)
- `style` — Ensures styles remain visible when `styles.css` is not loaded (e.g., HTML/PDF export)

## Installation

### From Community Plugins

1. Open **Settings → Community plugins → Browse**
2. Search for **text-brush**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download or build `main.js`, `manifest.json`, and `styles.css`
2. Copy them to `<your-vault>/.obsidian/plugins/text-brush/`
3. Restart Obsidian, go to **Settings → Community plugins**, and enable **text-brush**

## Settings

Go to **Settings → text-brush** to:

### Color Settings
- Edit the display name and CSS value for each color
- Remove colors you don't need
- Click "Add color" to add a custom color
- Click "Restore defaults" to reset to the default palette

### Font Size Settings
- Edit the display name and CSS value for each size
- Remove sizes you don't need
- Click "Add size" to add a custom size
- Click "Restore defaults" to reset to the default size list

Supported CSS values:
- Colors: hex `#ff0000`, RGB `rgb(255, 0, 0)`, HSL, CSS variables `var(--color-red)`
- Sizes: `12px`, `1.2em`, `1rem`, `larger`, or any valid CSS size value

## Custom Styling

You can override any color's appearance using an Obsidian CSS Snippet:

```css
.tc-color--red {
    color: #e74c3c !important;
}
```

## Development

```bash
npm install
npm run dev      # esbuild watch mode
npm run build    # type check + production build
```

### Project Structure

```
src/
├── main.ts             # Plugin main class (menu building, selection parsing, document operations)
├── types.ts            # Interfaces, constants, regex, utility functions
└── settingTab.ts       # Settings tab UI
styles.css              # Color class definitions + menu swatch styles
esbuild.config.mjs      # Build configuration
manifest.json           # Obsidian plugin manifest
package.json            # Dependencies and scripts
```

## License

[MIT](LICENSE)
