# Local frontend fonts

The frontend uses these bundled fonts through `next/font/local`. Production
builds do not fetch CSS or font files from Google Fonts. The existing CSS
variables, normal styles, weight ranges and `display: swap` are retained.
The complete fonts include Swedish characters and their other source glyphs.

Source: [Google Fonts](https://github.com/google/fonts/tree/66928797f271fed5ee428544e7229685e2d90127/ofl),
frozen at commit `66928797f271fed5ee428544e7229685e2d90127`.
Each family's SIL Open Font License is included alongside its font.
The upstream variable TTF files were converted to WOFF2 with FontTools,
without subsetting, instancing or editing glyphs.

| Bundled file | Upstream file | SHA-256 of bundled WOFF2 |
| --- | --- | --- |
| `Inter-Variable.woff2` | `ofl/inter/Inter[opsz,wght].ttf` | `89968bdca822aedbd4f81d7b9264225e023b4ef7cd1ea59d0ce827a4be77dfb3` |
| `GeistMono-Variable.woff2` | `ofl/geistmono/GeistMono[wght].ttf` | `7af33a423ae3f15c02698334af1e1de36868afcf7735dcbc35d7032f6584e4c3` |
