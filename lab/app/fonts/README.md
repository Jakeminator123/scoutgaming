# Typsnitt

Variabla woff2-filer, latin-delmängd, laddade med `next/font/local` i `app/layout.tsx`.
Lokala filer så att bygget inte beror på fonts.googleapis.com (gav flakiga CI-fel 7 okt 2026).

| Fil | Familj | Vikter | Källa | Licens |
|---|---|---|---|---|
| `space-grotesk-latin-wght-normal.woff2` | Space Grotesk | 300–700 | `@fontsource-variable/space-grotesk` 5.3.0 | OFL-1.1 |
| `inter-latin-wght-normal.woff2` | Inter | 100–900 | `@fontsource-variable/inter` 5.3.0 | OFL-1.1 |
| `jetbrains-mono-latin-wght-normal.woff2` | JetBrains Mono | 100–800 | `@fontsource-variable/jetbrains-mono` 5.3.0 | OFL-1.1 |

Latin-delmängden täcker svenska tecken (å ä ö é). Pilen → faller tillbaka på systemtypsnitt,
som förut. Uppdatera genom att hämta samma filnamn från jsDelivr (`cdn.jsdelivr.net/npm/<paket>@5/files/`).
