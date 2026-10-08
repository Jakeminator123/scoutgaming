# Till Kevin: fem beslut om operatörsrollerna (kopiera texten under strecket)

---

Hej Kevin,

skrivande partnerrutter är inne på main i dag (bolag, roller, medlemskap, team-API, din
team-vy kopplad). Jag körde på utan att vänta på #3 så att vi inte stod still; nedan är de
val agenten gjorde som **du** äger och får ändra. Svara med radnummer + ja/ändra.

**1. Rollnamn och behörigheter (standardroller som skapas per bolag)**

| Roll | Behörigheter | Delegerbar |
|---|---|---|
| `partner-admin` | overview.read, players.read, team.read, team.invite, team.roles.assign, team.suspend, tables.read, tables.configure, presentations.read, presentations.configure, reports.read, integrations.read | **nej** |
| `partner-editor` | overview.read, tables.read, presentations.read, presentations.configure | ja |
| `partner-viewer` | overview.read, players.read, team.read, tables.read, presentations.read, reports.read, integrations.read | ja |

Fråga: ska `partner-editor` se teamet (team.read) och spelare (players.read)? I dag ser
editorn teamet bara skrivskyddat via viewer-rätten. Vill du ha dina tekniker-/analytiker-
roller från backofficen som standardroller också, eller skapas de per bolag av admin?

**2. Vem utser administratörer?**
`partner-admin` är inte delegerbar: en operatörsadmin kan **inte** utse, degradera eller
stänga av andra admins – det gör intern personal via kortet Bolag på `/control/lanes`.
Sista aktiva admin kan aldrig suspenderas. Vill du att bolaget själv ska kunna utse admins?

**3. Inbjudan**
I dag: "Bjud in" kopplar ett *befintligt* partnerkonto via e-postadress, medlemskapet blir
aktivt direkt. E-postinbjudan med länk och lösenordssättning byggs just nu (N2.6): ny adress
→ inbjudet konto + mejl via Resend, max 5 inbjudningar per aktör och timme, samma svar
oavsett om adressen fanns. OK?

**4. Bolagets utseende**
Bordsfärg sparas som `branding.color` på operatörspaketet (inte din lokala `felt`-nyckel).
Skrivning kräver `presentations.configure`. Bakgrund och dealer visas i panelen men skrivs
inte än; chips saknas. Vill du att vi mappar `felt` → `color` eller byter namn?

**5. Journal**
Varje skrivning loggas i serverloggen som
`[operator-journal] {at, actor, action, operatorId, target}` (e-post maskad). Ingen tabell
än. Vill du ha en tabell i `croupier_studio` (då migration 006 på Studio-Neon) eller räcker
loggen tills vidare?

Allt ovan kan ändras utan migration utom journaltabellen. Tack!

/Jakob
