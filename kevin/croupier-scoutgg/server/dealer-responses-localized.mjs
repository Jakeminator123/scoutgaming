import {RESPONSES} from './dealer-policy.mjs';
import {dealerLanguage} from '../public/dealer-language.js';

// Fixed translations of the existing response IDs. The model still selects
// only the canonical English response; it never authors text passed to TTS.
export const LOCALIZED_RESPONSES=Object.freeze({
  en:RESPONSES,
  es:Object.freeze({
    greeting:'Hola, bienvenido. Puedo explicar las reglas y los controles de la demo.',
    social:'Gracias por conversar. Puedo explicar las reglas de la demo o los controles disponibles aquí.',
    rules:'El blackjack paga tres a dos. La crupier se planta en todos los diecisietes. Las reglas completas y los pagos de las apuestas laterales están en Demo information.',
    outcome:'El servidor del juego determina las cartas y los pagos. No puedo predecir ni cambiar un resultado.',
    support:'Puede hacer una pausa de 24 horas en la demo con Take a break. Los enlaces de ayuda sobre el juego están en Demo information.',
    privacy:'No comparta datos personales ni financieros. El chat de la mesa se comparte con otros visitantes.',
    fallback:'Puedo explicar las reglas y los controles de la demo. No puedo aconsejar sobre apuestas ni animarle a apostar.',
  }),
  fr:Object.freeze({
    greeting:'Bonjour et bienvenue. Je peux expliquer les règles et les commandes de la démo.',
    social:'Merci pour cette conversation. Je peux expliquer les règles de la démo ou les commandes disponibles ici.',
    rules:'Le blackjack paie trois pour deux. La croupière reste sur tous les dix-sept. Les règles complètes et les gains des mises annexes se trouvent dans Demo information.',
    outcome:'Le serveur du jeu détermine les cartes et les gains. Je ne peux ni prédire ni modifier un résultat.',
    support:'Vous pouvez faire une pause de 24 heures dans la démo avec Take a break. Les liens d’aide concernant les jeux d’argent se trouvent dans Demo information.',
    privacy:'Ne partagez pas de données personnelles ou financières. Le chat de la table est partagé avec les autres visiteurs.',
    fallback:'Je peux expliquer les règles et les commandes de la démo. Je ne peux pas donner de conseils de mise ni vous encourager à jouer.',
  }),
  zh:Object.freeze({
    greeting:'您好，欢迎。我可以解释演示的规则和操作方式。',
    social:'感谢您的交流。我可以解释演示的规则或这里的操作方式。',
    rules:'黑杰克按三比二赔付。庄家在所有十七点的情况下停牌。完整规则和边注赔付说明请查看 Demo information。',
    outcome:'游戏服务器决定发出的牌和赔付。我无法预测或改变结果。',
    support:'您可以点击 Take a break，暂停演示二十四小时。有关赌博问题的求助链接请查看 Demo information。',
    privacy:'请勿分享个人或财务信息。牌桌聊天内容会与其他访客共享。',
    fallback:'我可以解释演示的规则和操作方式。我不能提供下注建议，也不能鼓励您赌博。',
  }),
});

export function localizeResponse(canonical,language='en') {
  const id=Object.keys(RESPONSES).find(key=>RESPONSES[key]===canonical);
  if(!id)throw new Error('Speech must use a reviewed response');
  return LOCALIZED_RESPONSES[dealerLanguage(language)][id];
}

const VALID_NAME=/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '.-]{0,17}$/u;
export function personalizedGreeting(name,language='en') {
  const clean=String(name??'').normalize('NFC').trim().replace(/\s+/g,' ');
  if(!VALID_NAME.test(clean))throw new Error('Greeting name is invalid');
  switch(dealerLanguage(language)) {
    case 'sv': return `Hej ${clean}, hur mår du idag?`;   // Svenska Spel demo 15 Oct: a Swedish table greeted in English text
    case 'es': return `Hola, ${clean}. ¿Cómo estás hoy?`;
    case 'fr': return `Bonjour ${clean}, comment allez-vous aujourd’hui ?`;
    case 'zh': return `你好，${clean}。今天过得怎么样？`;
    default: return `Hi ${clean}, how are you today?`;
  }
}
