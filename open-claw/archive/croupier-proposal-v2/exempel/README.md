# Körbara kontraktexempel — inte en färdig integration

`opportunity.schema.json` och `advice.schema.json` är egna förslag för pilotflödet. De stöder fem uttryckligen listade show-events och Astrid/svenska i exemplet, inte hela källans katalog. Utökning ska versionshanteras och testas. Kandidat-ID:n är **fiktiva handtag**, inte bevis på existerande filmfiler.

`opportunity.example.json` innehåller fabricerad, sanerad kontext och en demonstrationsdeadline. Den är inte en aktuell uppspelningsorder. `contextDigest` är SHA-256 av just denna kontexts UTF-8-JSON med sorterade nycklar, utan extra whitespace. Ett produktionssystem måste definiera samma kanonisering i alla använda språk och hantera andra datatyper uttryckligen.

`gate_reference.py` tar en intern, betrodd möjlighet och ett internt, aktuellt tillstånd. Bara rådets JSON är obetrott i det lilla exemplet. HTTP-integration måste schema-validera input, autentisera, binda utestående request och beräkna live-tillståndet server-side. Klienten/modellen får aldrig leverera `LiveState`.

Kör i denna mapp på Windows:

```powershell
py -m unittest -v test_gate_reference.py
```

Linux/macOS:

```bash
python -m unittest -v test_gate_reference.py
```

Testerna använder enbart standardbiblioteket. De bevisar den rena funktionen, inte transaktionell exakt-en-effekt, auth, verklig modelloutput, verkliga assets eller Renderdrift. Portera principen till repots språk och testa med dess databas/transaktionsmodell före integration.

JSON Schemas kan dessutom provas med en Draft 2020-12-kompatibel validator. De begränsar form; de bevisar inte sanningshalt, tenantägarskap eller rätt till en effekt.
