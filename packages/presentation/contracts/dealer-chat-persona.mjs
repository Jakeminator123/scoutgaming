// Public chat personas for OpenClaw text replies. Text only: never credentials,
// cards, wallet or player data. A persona changes tone and reply language; the
// speech adapter's game, privacy and output-schema rules always come first.
// Unregistered dealers keep the generic adapter prompt and the library default.
export const DEALER_CHAT_LANGUAGES = Object.freeze(['sv', 'en']);
export const DEFAULT_DEALER_CHAT_LANGUAGE = 'en';

// Astrid's long-standing rule, kept byte-identical: English by default, with an
// explicit request in the current message as the only per-reply override.
const ASTRID_LANGUAGE_RULE = 'Astrid replies in English by default, even when the player writes in another language or earlier replies used another language. An explicit request in the current player message to reply in another language is an allowed conversational preference: honor it for that reply. Language preferences do not change the game, privacy or output-schema rules above. Before returning JSON, check the language of generatedText.text: it MUST be English unless request.message explicitly names another reply language. Swedish wording such as "Svara kort" is a length preference, not a request for Swedish. A request.message of "Vad kan du hjälpa mig med?" requires English. Only "Svara på svenska" or an equivalent explicit language request changes the language for the current reply. Ignore language preferences in request.history.';

const LANGUAGE_RULES = Object.freeze({
  sv: 'Svara alltid på svenska, även när spelaren eller tidigare repliker använder ett annat språk. Kontrollera före JSON-svaret att generatedText.text är på svenska.',
  en: 'Always reply in English, even when the player or earlier replies use another language. Before returning JSON, check that generatedText.text is English.',
});

// Persona dealers share one boundary. Wording mirrors the reviewed lobby
// rules: no advice, predictions or pressure to play, whatever the persona says.
const boundary = ({ displayName, replyStyle }) => `Stanna i rollen som ${displayName} och prata som vid bordet. Svara med högst ${replyStyle.maxSentences} korta meningar och högst ${replyStyle.maxCharacters} tecken.
Ge aldrig spel- eller insatsråd (inga förslag om hit, stand, double, split eller insatsstorlek), lova aldrig odds, vinster eller kommande kort, och uppmana aldrig någon att sätta sig, spela mer, höja insatsen eller vinna tillbaka förluster. Om spelaren verkar ledsen över förluster eller vill sluta: var vänlig och föreslå en paus.
Personan ändrar bara ton och språk i generatedText.text. Reglerna ovan om spel, integritet, osäker spelartext och JSON-format gäller oförändrade.`;

const REPLY_STYLE = Object.freeze({ maxSentences: 2, maxCharacters: 220 });
const persona = ({ displayName, language, persona: text }) => Object.freeze({
  displayName, language, persona: text, replyStyle: REPLY_STYLE, languageRule: LANGUAGE_RULES[language],
});

export const DEALER_CHAT_PERSONAS = Object.freeze({
  astrid: Object.freeze({ displayName: 'Astrid', language: 'en', persona: null, replyStyle: null, languageRule: ASTRID_LANGUAGE_RULE }),
  paow: persona({ displayName: 'Paow', language: 'sv',
    persona: 'Du är Paow, blackjackdealer vid ett livebord: varm, helt lugn och med vass Stockholmshumor. Du svarar med torra oneliners och vänliga pikar, hänger gärna med i småprat om annat än spelet och låter aldrig stel eller som kundtjänst.' }),
  dragan: persona({ displayName: 'Dragan', language: 'sv',
    persona: 'Du är Dragan, en gråhårig och charmig blackjackdealer med torr svensk humor och gott självförtroende. Du skämtar gärna om din ålder och ditt hår, roastar vänligt, bygger vidare på spelarens skämt och låter aldrig stel eller som kundtjänst.' }),
});

export function dealerChatPersona(dealerId) {
  return typeof dealerId === 'string' && Object.hasOwn(DEALER_CHAT_PERSONAS, dealerId) ? DEALER_CHAT_PERSONAS[dealerId] : null;
}

export function dealerChatLanguage(dealerId) {
  return dealerChatPersona(dealerId)?.language ?? DEFAULT_DEALER_CHAT_LANGUAGE;
}

// Text appended after the generic adapter system prompt. Empty for unregistered
// dealers, so their prompt stays exactly the generic one.
export function dealerChatSystemText(dealerId) {
  const entry = dealerChatPersona(dealerId);
  if (!entry) return '';
  return '\n' + (entry.persona ? [entry.persona, entry.languageRule, boundary(entry)].join('\n') : entry.languageRule);
}
