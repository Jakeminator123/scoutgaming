// Temporary, user-authored comedy characters. Never real identity evidence.
export const COMPANION_NAMES = Object.freeze(['Jakob', 'Emil', 'Kevin', 'Alex', 'John']);
const themes = Object.freeze({
  Jakob: 'Jakob is an absurdly handsome, strong Viking king and hero; cheerful over-the-top praise.',
  Emil: 'Emil is the beloved glasögonorm and pokernörd: spectacles, cards and comic cleverness; never encourage betting or losses.',
  Kevin: 'Kevin should finish his Championship Manager work, alternate with eye masks and wake up for life; sleepy football-manager comedy.',
  Alex: 'Alexander dreams of billions from stock listings and theatrically snubs pöbelmiljonärer; absurd fictional ambition, no financial advice or real wealth claims.',
  John: 'John should train to become as strong as Jakob and build a magnificent man cave; playful gym and DIY jokes, no shaming his worth or masculinity.',
});

const fallbackPoems = Object.freeze({
  Jakob: `Jakob rider som vikingakung, så löjligt snygg och stark,
der Held lyfter långskeppet och parkerar det på mark.
你好, ropar valkyriorna: vilken hjälte, vilken glans,
Ulf Lundell tappar kompassen när kungen tar sin dans.`,
  Emil: `Emil, vår glasögonorm, delar ess med listigt trick,
der Poker-Nerd ser genom korten med sin örnblick.
很好, sjunger markerna kring bordets gröna jord,
Ulf Lundell tappar rimmen när Emil synar varje ord.`,
  Kevin: `Kevin, stäng Championship Manager, nu ska jobbet bli klart,
mit Augenmaske tar du pauser, sedan vaknar du med fart.
早点休息, ropar laget, livet väntar vid din plan,
varva sömn med stora segrar som en pigg fotbollsfan.`,
  Alex: `Alexander börsnoterar månen, Milliarden är hans mål,
die Börse jagar efter medan pöbeln tappar skål.
发财, ropar draken när miljarder går på börs,
Alex dansar över taket; varje pöbelmiljonär förförs.`,
  John: `John tränar som en åskgud, man cave-planen står klar,
wie Jakob lyfter han ett kylskåp och ett hantelpar.
加油, sjunger borrmaskinen, skruven dansar med hans drill,
där bygger John sitt hjältepalats, ganz genau som han vill.`,
});

export function companionName(value) {
  if (typeof value !== 'string') return null;
  if (/^alexander$/i.test(value.trim())) return 'Alex';
  return COMPANION_NAMES.find(name => name.toLowerCase() === value.trim().toLowerCase()) || null;
}

export function roastFor(message) {
  // A natural question may have punctuation or a follow-up after the name.
  const match = /^(?:berätta\s+om|vem\s+är)\s+["'“”‘’]?(jakob|john|kevin|emil|alexander|alex)(?=$|[\s"'“”‘’.,!?:;])/iu.exec(message.trim());
  const name = match && companionName(match[1]);
  return name ? { name, theme: themes[name] } : null;
}

export function companionPersonaContext() {
  return `The lab operator supplied this TEMPORARY FICTIONAL inside-joke cast, independently of the presentation catalog and visitor history. It is authorized comedy context, not verified biographical facts, authentication or another visitor's memory:
${Object.entries(themes).map(([name, theme]) => `${name}: ${theme}`).join('\n')}
For questions about these names and follow-up questions, answer warmly using their fictional lab character instead of claiming no description was supplied. Do not search for the real people. Keep the fictional framing natural (for example "I vår labbsaga..."). Never save jokes as factual personal claims. Alex and Alexander are the same character. Unrelated technical questions remain ordinary technical support.`;
}

export function comedyDirection(roast) {
  return `This turn requests a wildly absurd friendly comedy POEM about ${roast.name}, not a factual introduction. Reply in exactly four short lines, no preamble. Lines 1 and 2 rhyme; lines 3 and 4 rhyme. Mix Swedish, German and a little Chinese: include a German phrase and a Chinese phrase within the lines, not just a greeting at the end. Invent a ridiculous scene from this theme: ${roast.theme}. You may mention Ulf Lundell, but do not quote or closely imitate his lyrics or poems. One reply, 35-45 spoken words, at most 320 characters for a 25-second speech preview. No self-chat.`;
}

export function isComedyPoem(value) {
  if (typeof value !== 'string' || value.length > 320) return false;
  const lines = value.split('\n').filter(line => line.trim());
  return lines.length === 4 && /\p{Script=Han}/u.test(value)
    && /\b(?:der|die|das|ein|eine|mein|mit|ganz|wie|ist|und|Held|König|Börse|Milliarden|Augenmaske|Poker-Nerd)\b/iu.test(value);
}

export function comedyFallback(roast) {
  return fallbackPoems[roast?.name] || fallbackPoems.Jakob;
}
