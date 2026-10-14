# Astrid i Slack — inkopplingsguide

> Guide flyttad 2026-10-13. Relativa kodsökvägar som `src/`, `deploy/` och
> `config/` i exemplen utgår från `open-claw/lab/`. Daterade prov nedan
> är historiska; [aktuell dokumentingång](../README.md) skiljer drift från förslag.

Status 2026-09-29: möjligt, men ännu inte installerat eller aktiverat här.
Spelets stabilisering går först. OpenClaw-image är låst till 2026.9.5;
guiden jämfördes med den versionens officiella dokumentation.

## Det Jakob kan förbereda

1. Öppna [Slack Apps](https://api.slack.com/apps/new), välj **Create New App →
   From a manifest** och rätt workspace.
2. Utgå från **Minimal**, Socket Mode, i
   [den officiella versionsguiden](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/channels/slack/setup.md).
   Ändra appens namn och botens visningsnamn till **Astrid**.
3. Under **Basic Information → App-Level Tokens**, skapa en token med
   `connections:write`.
4. Välj **Install App → Install to Workspace** och hämta Bot User OAuth Token.
5. Spara dem i tjänstens hemlighetshantering som `SLACK_APP_TOKEN` och
   `SLACK_BOT_TOKEN`. Skicka inte tokenvärden i chatten eller Git.
6. Skapa exempelvis `#astrid-lounge`, bjud in appen och anteckna workspace-ID
   och kanal-ID för den kommande tillåtelselistan.

OpenClaw-sidan behöver Slack-plugin, Socket Mode-konfiguration, separat
agentbindning och omstart. Socket Mode kräver ingen publik Slack-webhook.
En app skapad i Slack är alltså inte ensam en färdig anslutning.
[Officiell Slack-översikt](https://docs.openclaw.ai/channels/slack).

## Föreslagen Astrid-policy

- Egen Slack-roll och separat samtalsminne; återanvänd Astrids personlighet,
  inte spelares privata samtal. Terra (`gpt-5.6-terra`) som modell.
- Text först. Slack får inte beställa GPU-läppsynk eller använda spelkön.
- Svara när hon nämns och i tillåtna DM. Börja med en tillåten kanal.
- Humor: kort, varm, torr och lite självironisk. Exempel: ”Jag blandar korten.
  Ni verkar redan ha blandat ihop mötestiderna.” Låt skämt följa samtalet.
- Ett försiktigt startförslag för spontana inlägg är högst två per dag,
  minst tre timmar emellan, enbart dagtid och när kanalen nyligen varit aktiv.
  Detta är ett förslag, inte en aktiverad inställning eller gräns för vanliga svar.

## Vad som krävs för att spelet verkligen ska gå först

En separat agentroll ger inte i sig resursprioritet. Innan spontan aktivitet
aktiveras måste kod kontrollera spelets belastning och hälsa före modellanrop
och före sändning. Vid upptagen eller okänd status hoppas inlägget över;
ingen kö av gamla skämt skickas senare. Slack behöver egen liten budget,
en samtidig uppgift och möjlighet att pausas oberoende av spelet. Strikt
resursisolering kan kräva separat Gateway/process och providerkvot.

Godkänn först ett verkligt omnämnande, DM och pausprov. Därefter kan lågmälda
spontana inlägg provas i den valda kanalen. Ingen bot har publicerat något
och inga nya tokens eller tjänster har skapats av denna guide.
