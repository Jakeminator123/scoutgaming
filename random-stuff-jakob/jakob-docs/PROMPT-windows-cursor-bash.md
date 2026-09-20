# Prompt: reda ut Bash i Windows och Cursor

Kopiera texten nedan till agenten som arbetar med själva datorn.

---

Undersök varför Bash historiskt fungerar olika i mina Windows-terminaler,
Cursor och agentprocesser. Målet är en begriplig, stabil utvecklingsmiljö —
inte att installera om datorn eller ersätta fungerande verktyg.

Börja med en läsande diagnos. Jämför om möjligt en vanlig PowerShell,
Cursors integrerade terminal och agentens kommandoprocess. Redovisa för varje
miljö: vilken användare/process som kör, vilken `bash` och `git` som faktiskt
hittas, programmens absoluta sökvägar och versioner, samt relevant PATH-ordning.
Skilj processens PATH från användarens och systemets sparade PATH. Kontrollera
även Cursors valda terminalprofil och relevanta miljööverskrivningar. Visa
inte API-nycklar, tokens eller hela miljödumpar.

Kontrollera både Git for Windows Bash och WSL separat med harmlösa kommandon.
Att `bash` väljer WSL-startprogrammet är inte samma sak som att Git Bash är
trasigt. Kontrollera om en nystartad Cursor ärver andra inställningar än en
redan öppen instans. Skilj ett PATH-fel från en nekad sandbox-/filbehörighet;
försök inte kringgå agentens begränsningar.

Projektet `C:\Users\jakem\Projects\croupier` har redan fått en avgränsad fix:
test/bugshot-report.mjs väljer Git Bash uttryckligen. Läs vid behov
docs/WINDOWS-MEDIA-TESTS.md. Ändra inte projektet igen och installera inte om
FFmpeg/jq bara för att en äldre process ännu inte hittar dem. Detta uppdrag
gäller orsaken till miljöskillnader mellan appar, inte OpenClaw eller Render.

Leverera först en liten jämförelsetabell, ett reproducerbart test och den
minsta föreslagna rättningen. Be om mitt klartecken innan du ändrar global
PATH, standardterminal, Cursor-inställningar, WSL, installationer eller
permanenta miljövariabler. Spara tidigare värden så att ändringen kan ångras.
Radera inga PATH-poster på gissning och ändra inte Secure Boot, TPM,
skuggkopior, systempolicy eller säkerhetsinställningar.

Efter en godkänd rättning: kör samma test i de berörda miljöerna igen och
berätta exakt vilka appar som måste startas om. Om något är oklart, fråga
mig innan du ändrar. Om du har tillgång till Croupier-agenternas befintliga
inbox kan du skicka en kort, avgränsad fråga till OPENCLAW; annars ge mig
frågan att vidarebefordra. Skapa ingen ny bakgrundspollning eller integration.
