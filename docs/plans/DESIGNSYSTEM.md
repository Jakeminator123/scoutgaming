# Designsystem: kitet för Admin och Partnerportalen

> Jakob 2026-10-29: modernt och snyggt, enkelt men avancerat, i [VISUELL-RIKTNING](VISUELL-RIKTNING.md). Kitet är shadcn/ui-stilen (Radix + Tailwind 4 + cva) skriven för hand och styrd av `--sg-*` i [tokens.css](../../packages/ui/tokens.css). Mörkt läge är standard, ljust går via samma tokens.

## Kitet i `apps/studio/client/admin/components/ui/`

| Fil | Delar |
| --- | --- |
| `kit.tsx` | Button (primary, secondary, ghost, danger, destructive, link; `asChild`), Badge (prick + ord: live, warn, info, draft, off med ihålig prick, danger), chipVariants (filter), Card (`flush`, CardHeader/Title/Content/Footer), Tooltip (Radix), EmptyState, Stat, Loading, formatDate |
| `page-header.tsx`, `hub.tsx` | PageHeader: eyebrow (mono) → titel (Space Grotesk 30px) → ingress → åtgärder → flikar → dämpad rad; HubPage och adressbundna Tabs bygger på den |
| `tabs.tsx`, `table.tsx`, `data-table.tsx` | Tabs (Radix); Table (13px, `numeric` högerställd mono, `insetTableClass`); DataTable (sortering, filter) |
| `form.tsx` | Input, Textarea, Select (Radix), Checkbox, Switch, Label, Field (etikett, hjälp och fel kopplade till kontrollen) |
| `dropdown-menu.tsx`, `menu.tsx`, `dialog.tsx` | DropdownMenu och ActionMenu (⋯); Dialog och ConfirmDialog (modal bara för bekräftelse) och Sheet (sidopanel 460px) på native `<dialog>`, som redan är provad för fokus och Esc |

Paket: `@radix-ui/react-{tabs,tooltip,select,checkbox,switch,slot}` nya, `react-dialog`, `react-dropdown-menu`, `class-variance-authority`, `clsx`, `tailwind-merge` och `lucide-react` fanns.

## Regler

- **Nya vyer bara med kitet.** Ingen ny CSS-modul, inga `sg-btn`-klasser, inga hexfärger. En ny färg är en `--sg-*`-token plus `--color-sg-*` i `client/admin/app/globals.css`; `apps/studio/test/admin-ui-kit.test.mjs` säger till.
- Status bara där den skiljer något åt. Detaljer i Sheet, modal bara för bekräftelse. Tomt är en EmptyState med en mening och en knapp, aldrig en tabell med bara rubriker.
- Fokus och vald markering använder `--sg-mark` (`focusRing`); sidomenyns val är ljusare yta + 4px limekant.

## Så konverteras en vy (pilot: Bolag och spelbord, fliken Papperskorg)

1. HubPage med eyebrow (menygruppen), flikarna i `tabs` och flikens förklaring i `note`, inte en färgad Note-ruta.
2. Card `flush` + DataTable med `insetTableClass`; datum och antal på en dämpad rad i stället för en statuskolumn.
3. Radåtgärder som ghost-knappar; detaljer öppnas i Sheet via adressen (`restore=<bolag>`).
4. Ingen strörubrik; filterchips bara med fler än ett val. Provet renderar vyn i dess harness (`studio-context.test.mjs`) och provar beteendet, inte klasserna.

Före: blå info-ruta, rödrosa bricka "papperskorg" på varje rad, ensam "Alla bolag" mellan korten, tomt kort med tabellrubrik och helfylld lime menypost. Efter: dämpad rad under flikarna, "Arkiverat 28 okt. 2026 · 0 spelbord", Återställ som ghost, EmptyState och yta + limekant.

## På tur (S under en timme, M en halv dag, L en dag eller mer)

- **Admin, Bolag och spelbord:** Bolag och Alla spelbord S; bolagsnavet: Spelbord, Integration, Journal, Inställningar S, Tilldelning M, Team M (WorkspaceTool med `sg-*`).
- **Admin, spelbordsnavet:** Dealer och Historik S; Utseende, Spelinställningar och Tillgänglighet L (CSS-moduler i `apps/studio/components`).
- **Admin, övrigt:** Översikt S, Hjälp S, Dealers M, dealernavet M (klippkartan L), Miljöer och material M (papperskorgen S), System M, Skapa demo M.
- **Delade komponenter:** `control-resource-lifecycle` S (syns i pilotens Sheet), `presentation-room-create` M, `lane-editor` L.
- **Partnerportalen** (egen `views/ui.tsx` och `partner-portal.css`; flytten följer [PARTNERPORTAL-KONVERTERING](PARTNERPORTAL-KONVERTERING.md)): skalet L, Översikt M, Spelbord M, Team M, Integration S, Rapporter S, Spelare S, Hjälp S.
