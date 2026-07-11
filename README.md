# Obsidian text-brush

[中文文档|Chinese](README_zh.md)

An Obsidian plugin that lets you quickly apply, switch, or clear text color and font size via the right-click context menu, and automatically converts pasted URLs into Markdown links.

## Features

### Text Color

- **Right-click to color** — Select text, right-click, and pick a color from the "Text color" submenu
- **Smart replace** — Re-coloring already-colored text replaces the color in place without nesting `<span>` tags
- **Clear color** — A "Clear color" option appears when colored text is selected
- **Bold support** — A built-in "Bold" option appends `font-weight: bold` to colored text
- **Theme-aware** — The default palette uses Obsidian's built-in CSS variables (`--color-red`, `--color-blue`, etc.), adapting to the current theme
- **Custom palette** — Add, remove, or edit colors in Settings; supports any CSS color value or `var(--…)` reference
- **Export-friendly** — Outputs both CSS class and inline style so colors survive HTML/PDF export

### Font Size

- **Right-click to resize** — Select text, right-click, and pick a size from the "Text size" submenu
- **Smart replace** — Re-sizing already-sized text replaces the size in place
- **Stackable** — Can be combined with color on the same selection
- **Clear size** — A "Clear size" option appears when sized text is selected
- **Custom sizes** — Add, remove, or edit sizes in Settings; supports any CSS size value (px, em, etc.)

### Auto Hyperlink

- **Paste to link** — Pasting a bare HTTP/HTTPS URL converts it into a Markdown link `[title](url)`
- **Selection-aware** — If text is selected when you paste, it becomes the link text immediately (`[selection](url)`) with no network request
- **Async title fetch** — With no selection, a placeholder is inserted first, then the page title is fetched in the background and swapped in once available
- **Graceful fallback** — If the title can't be fetched (timeout, HTTP error, private host), the URL itself is used as the link text (`[url](url)`)
- **Privacy-aware** — Optionally skip title fetching for localhost and private IP ranges (10.x, 172.16–31.x, 192.168.x, `.local`, etc.)
- **Excluded domains** — A comma-separated domain list lets specific sites keep Obsidian's native paste behavior; supports subdomain and wildcard matching (`example.com`, `.example.com`, `*.example.com`)
- **Encoding-aware** — Correctly decodes page titles for non-UTF-8 pages (including GBK/GB2312)

### General

- **Version compatible** — Automatically detects whether Obsidian supports submenus; falls back to a flat menu if not
- **Smart selection handling** — When a selection partially overlaps an existing colored span (starts outside, ends inside, or vice versa — including across lines), the replace range auto-expands to cover the whole span, so no broken `<span>` fragments are ever left behind
- **Multilingual UI** — The right-click menu and settings tab ship in 10 languages: English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português. A **Language** selector in Settings lets you override the language; **Auto** follows Obsidian's own UI language and falls back to English. Built-in color names are translated to match, and switching language re-translates the default palette only while it is still untouched — your customizations are never overwritten.

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

The settings page is organized into four tabs, and the last-opened tab is remembered across sessions:

### General
- **Language** — Choose the display language for the right-click menu and settings tab: **Auto** (follow Obsidian, fall back to English) or one of 10 supported languages (English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Русский, Português)

### Text Color
- Edit the display name and CSS value for each color
- Remove colors you don't need
- Click "Add color" to add a custom color
- Click "Restore defaults" to reset to the default palette

### Font
- Edit the display name and CSS value for each size
- Remove sizes you don't need
- Click "Add size" to add a custom size
- Click "Restore defaults" to reset to the default size list

### Hyperlink
- **Enable auto hyperlink** — Toggle the paste-to-link behavior on or off
- **Fetch timeout (ms)** — Maximum time to wait for a page title fetch (range 1000–60000)
- **Skip private hosts** — Don't fetch titles for localhost or private IP addresses
- **User agent** — The `User-Agent` header sent when fetching page titles
- **Excluded domains** — Comma-separated domains to skip; supports subdomains and wildcards (`example.com`, `*.example.com`)

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
├── main.ts             # Plugin main class (menu building, selection parsing, document operations, paste handler registration)
├── types.ts            # Interfaces, constants, regex, utility functions
├── i18n/               # i18n layer (t() function, locale resolution, translation JSON files)
│   ├── i18n.ts         #   t(key, locale) function, resolveLang, English fallback
│   ├── types.ts        #   Locale / TranslationKey types (key derived from en.json)
│   ├── constants.ts    #   SUPPORTED_LOCALES metadata, LANGUAGE_OPTIONS
│   └── locales/        #   One JSON per locale (en, zh-CN, zh-TW, ja, ko, de, fr, es, ru, pt)
├── hyperlinkPaste.ts   # Auto-hyperlink-on-paste (URL→Markdown link, title fetching)
└── settingTab.ts       # Settings tab UI
styles.css              # Color class definitions + menu swatch styles
esbuild.config.mjs      # Build configuration
manifest.json           # Obsidian plugin manifest
package.json            # Dependencies and scripts
```

## License

[MIT](LICENSE)
