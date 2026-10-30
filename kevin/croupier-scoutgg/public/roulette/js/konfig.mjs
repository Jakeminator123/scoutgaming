// Spelets egna inställningar. Dealer, hjul, rum och gränser kommer från katalog.json och bordet (js/bord.mjs).

// Hjulfilens spelprofil (pr 1, skuggkarta 1024, låg geometri, halva trätexturer, ingen efterbehandling); stilen kommer från hjulet
export const HJULPARAM = { spel: "1", kam: "S1", pr: "1", pdb: "0", skugga: "1024", geo: "lag", tex: "0.5", env: "0.5" };

// Förra rundornas nummer vid start (första = numret som ligger i fickan)
export const START_HISTORIK = [32, 4, 19, 0, 26, 11, 7, 30, 15, 8, 23, 5];
// Markernas färger per valör (vilka valörer som visas bestäms av bordets gränser)
export const FARGER = { 1: '#e9e2d0', 5: '#b3202a', 25: '#1d7a46', 100: '#1b1b1d', 500: '#6a3fa0', 1000: '#c9a24a', 5000: '#2f6496' };

// Kamerans rytm: "landa_forst" (Emil 10-30: S3 hålls tills kulan ligger i fickan, sedan åker kameran in) eller
// "zooma_tidigt" (runda 2–4: åkningen till närbilden börjar 5,4 s före kontakten och följer kulan). ?rytm= i adressen provar.
export const KAMERA_RYTM = "landa_forst";
