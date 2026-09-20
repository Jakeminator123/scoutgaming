# Komplettering från det generiska OpenClaw-underlaget

Detta är en kort Croupier-anpassad sammanfattning av användbara delar i `openclaw_generisk.zip`. Det generiska paketets filer kopieras inte in här. Croupier-paketets ursprungliga filer är lämnade oförändrade och kan fortsatt verifieras med `MANIFEST.sha256`.

## Viktig versionsskillnad

Croupier-paketets exempel använder `presentation-opportunity.v1`, `director-advice.v1`, `allowedCandidates` och `candidateId`. Den nuvarande gemensamma animation-events-dokumentationen på GitHub/webben beskriver i stället v2 med bland annat `open[]`, `baseChoice`, dealerspann och råd som kan ange `variant`, `take`, `arm` och `reason`.

Använd därför inte v1-schemana eller Python-grinden direkt som runtime-kontrakt. Innan implementation ska Kevin och Jakob välja kontraktsversion och därefter uppdatera schema, exempel, grind, tester och dokumentation tillsammans. V1-filerna är fortfarande värdefulla som referens för deny-by-default, aktualitetskontroll och testfall.

## Det som bör tas med från den generiska modellen

### 1. En egen förtroendegräns för croupiern

- Kör croupiern som en separat profil eller instans med `croupier-only` som förtroendezon.
- Inga native OpenClaw-verktyg i baslinjen. Använd både minimal profil och uttrycklig deny-spärr; instruktionstext är inte en säkerhetsgräns.
- Tillåt endast appägda förslag, exempelvis `presentation.advice.propose` och `chat.reply.propose`. Vanlig kod och Croupiers grind avgör om något får effekt.
- Blanda inte croupierns sessioner, secrets eller skrivbara workspace med CRM-, backoffice- eller andra kundagenters miljöer.

### 2. Privat gateway och serverägd väg

Rekommenderad väg:

`Croupier/backend → autentiserat Agent API → privat OpenClaw-gateway → modell`

- Browsern får aldrig gatewaytoken eller fri tillgång till gatewayns paths, agent-id, headers eller systemprompt.
- Agent API:t äger autentisering, publicerad kontext, policy, deadline och audit.
- Gatewayn ska inte ha spelserverns, databasens eller administrativa huvudnycklar.
- Croupiers deterministiska presentation fortsätter om gatewayn är nere, långsam, har kvotfel eller returnerar ogiltigt svar.

### 3. Versionslås och konfigurationsägande

Lås och dokumentera minst:

- exakt OpenClaw-version och upstream-commit,
- image digest och Node-version,
- verifierad config-schema-revision,
- revision för den adapter som översätter produktprofilen till runtimekonfiguration.

Välj en configägare. Antingen seedas native-konfigurationen bara vid första boot och därefter äger Control UI filerna, eller så är en publicerad produktprofil sanningen och kompileras till runtimekonfiguration. Två samtidiga skrivarvägar är inte tillåtna.

### 4. Secrets och beständig data

- Provider-nyckel finns endast hos gatewayn.
- Gatewaytoken delas endast mellan gateway och Agent API, aldrig med browser eller prompt.
- Profiler, mandat, audit, jobb och aktiva revisioner hör hemma i produktens datalager; gatewaydisken är inte system of record.
- Konversationshistorik bör vara appägd och storleksbegränsad. En användarvald sessionnyckel får inte kunna blanda bord eller spelare.
- Spara korrelations-id, revisioner, beslut och avslag, men inte råa tokens eller onödig persondata.

### 5. Drift, hälsa och återställning

- Skilj liveness från readiness. Readiness ska kontrollera autentiserad gatewaykontakt, förväntad agentidentitet och aktiv profilrevision.
- Kör ett separat, billigt syntetiskt modelltest; en vanlig health-endpoint bevisar inte att provider-kvot fungerar.
- Följ P50/P95-latens, timeouts, sena råd, avslag, anropsvolym, kostnad, disk och RAM.
- Ha en omedelbar väg till **AI av**. Pågående korrekt spelhandling ska kunna slutföras utan modellen.
- Rollback av image och konfiguration är två olika operationer. Testa backup/restore i isolerad miljö innan skarp drift.

## Det som inte kopierades

Det generiska arkivets Render-blueprint, `.env.example`, profiler och generella dashboard-/CRM-plan är medvetet inte kopierade. De är implementationsmallar, inte en färdig Croupier-installation, och innehåller paths och tjänster som först måste byggas och verifieras i rätt repo och miljö.

## Praktisk nästa kontroll innan någon kod skrivs

1. Verifiera den verkliga integrationspunkten i Croupier och Partner API:s publiceringsgräns.
2. Välj v2-kontraktet eller dokumentera ett uttryckligt annat beslut.
3. Börja med AI av och en helt fungerande deterministisk baseline.
4. Kör OpenClaw i skuggläge och mät avvikelse, latens, sena råd och kvalitet.
5. Aktivera inget uttrycksval eller chattsvar förrän grind, revisioner, fallback och audit är testade tillsammans.
