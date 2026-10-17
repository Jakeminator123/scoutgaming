export const modeLabels = Object.freeze({ off: 'Standard', rules: 'Regler', random: 'Slumpvariation', active: 'OpenClaw', shadow: 'Skuggläge' });
export const modeExplanations = Object.freeze({
  off: 'Spela standardfilen i rätt mapp. Varken regler eller OpenClaw väljer en annan variant.',
  rules: 'Spela den tillåtna variant vars villkor matchar och har högst prioritet. Inget AI-anrop.',
  random: 'Slumpa bland standard och slumpaktiverade varianter vars villkor matchar. Påverkar aldrig kort eller resultat.',
  active: 'Låt OpenClaw välja bland tillåtna, matchande varianter. Ogiltigt svar eller anslutningsfel ger standard.',
  shadow: 'Prova vad OpenClaw skulle välja, men spela standard. AI-förslaget syns bara i beslutsloggen.',
});
