# Studio-prov efter funktion

Proven ligger vid sin funktion. Ett prov som går genom flera lager hör till
flödet det verifierar; namnet på den tekniska adaptern styr inte mappen.

| Mapp | Beteenden |
| --- | --- |
| `access/` | Inloggning, sessioner, behörighet och HTTP-skydd |
| `admin/` | Admins arbetsyta, UI, historik, aktivitetslogg och administration |
| `ai/` | Assistent, bildförslag, materialadoption och OpenClaw-adaptrar |
| `composition/layers/` | Lagerredigering, uppladdning och borttagning |
| `composition/preview/` | Förhandsvisning, katalog och demobygge |
| `composition/scenes/` | Scenmodell, bindningar, export och publicering |
| `dealers/` | Dealerimport, filmprofil, röst, mediebibliotek och livscykel |
| `delivery/` | Byggspår, versionssynk, start och levererade previewfiler |
| `media/lifecycle/` | Materialets papperskorg och permanent borttagning |
| `media/registry/` | Videoregister, manifest, Blob och mediekällor |
| `media/upload/` | Videointag, uppladdning och medie-API |
| `navigation/` | Routing, adresser, sidval och navigeringsskydd |
| `operators/` | Bolag, partnerportal, tilldelning, paket, utseende och team |
| `presentation/` | Runtimeval, idle, klipp, talbindningar och readiness |
| `rooms/` | Rumsval, regler, publicering, livscykel och delad runtime |
| `storage/` | Projekt, dokument, persistens och databasadapter |
| `fixtures/` | Delade testhjälpare; inga självständiga prov |

Studio-paketets `npm test` och sviten `studio` i
[fullregistret](../../../.githooks/pre-commit-full) hittar proven rekursivt
med den citerade Node-globben `test/**/*.test.mjs`. Komponenternas egna prov
ligger fortsatt under `components/` och ingår i samma kommando.

Kör en avgränsad grupp från reporoten med högst fyra arbetare, exempelvis:

```powershell
node --test --test-concurrency=4 "apps/studio/test/access/*.test.mjs"
node --test --test-concurrency=4 "apps/studio/test/media/**/*.test.mjs"
```

Importer och filvägar utgår från provfilens nya katalog. En virtuell
modul i ett browserbygge har däremot sin egen `resolveDir`; dess importnycklar
och negativa sökvägsdata ska inte följa en fysisk testflytt.
