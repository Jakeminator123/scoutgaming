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
  pt:Object.freeze({
    greeting:'Olá, seja bem-vindo. Posso explicar as regras e os controles da demo.',
    social:'Obrigado pela conversa. Posso explicar as regras da demo ou os controles disponíveis aqui.',
    rules:'O blackjack paga três para dois. A banca para em todos os dezessetes. As regras completas e os pagamentos das apostas laterais estão em Demo information.',
    outcome:'O servidor do jogo define as cartas e os pagamentos. Não posso prever nem mudar um resultado.',
    support:'Você pode fazer uma pausa de 24 horas na demo com Take a break. Os links de ajuda sobre jogo estão em Demo information.',
    privacy:'Não compartilhe dados pessoais ou financeiros. O chat da mesa é compartilhado com outros visitantes.',
    fallback:'Posso explicar as regras e os controles da demo. Não posso dar conselhos de apostas nem incentivar você a apostar.',
  }),
  // Korean (Emil 19 Oct: Dragan, Paow and Astrid 2.0 speak it)
  ko:Object.freeze({
    greeting:'안녕하세요, 환영합니다. 이 데모의 규칙과 조작 방법을 설명해 드릴 수 있어요.',
    social:'대화해 주셔서 감사해요. 게임 규칙이나 여기서 쓸 수 있는 조작 방법을 설명해 드릴 수 있어요.',
    rules:'블랙잭은 삼 대 이로 지급됩니다. 딜러는 모든 십칠에서 멈춥니다. 전체 규칙과 사이드 벳 배당은 Demo information에 있어요.',
    outcome:'카드와 지급은 게임 서버가 정합니다. 저는 결과를 예측하거나 바꿀 수 없어요.',
    support:'Take a break 버튼으로 데모를 24시간 동안 쉴 수 있어요. 도움을 받을 수 있는 링크는 Demo information에 있어요.',
    privacy:'개인 정보나 금융 정보는 공유하지 마세요. 테이블 채팅은 다른 방문자에게도 보여요.',
    fallback:'데모의 규칙과 조작 방법은 설명해 드릴 수 있어요. 하지만 베팅 조언을 하거나 게임을 권할 수는 없어요.',
  }),
  // Swedish was missing: a Swedish table's reviewed fallback threw instead of answering (15 Oct).
  sv:Object.freeze({
    greeting:'Hej och välkommen. Jag kan förklara reglerna och kontrollerna i demon.',
    social:'Tack för att du pratar med mig. Jag kan förklara demons regler eller kontrollerna här.',
    rules:'Blackjack betalar tre till två. Dealern stannar på alla sjuttor. Fullständiga regler och utbetalningar för sidoinsatser finns under Demo information.',
    outcome:'Spelservern bestämmer korten och utbetalningarna. Jag kan inte förutsäga eller ändra ett resultat.',
    support:'Du kan ta en paus i 24 timmar i demon med Take a break. Länkar till stöd finns under Demo information.',
    privacy:'Dela inga personliga eller finansiella uppgifter. Bordschatten delas med andra besökare.',
    fallback:'Jag kan förklara demons regler och kontroller. Jag kan inte ge råd om insatser eller uppmuntra dig att spela.',
  }),
});

export function localizeResponse(canonical,language='en') {
  const id=Object.keys(RESPONSES).find(key=>RESPONSES[key]===canonical);
  if(!id)throw new Error('Speech must use a reviewed response');
  return LOCALIZED_RESPONSES[dealerLanguage(language)][id];
}

const VALID_NAME=/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '.-]{0,17}$/u;
// Kevin 23 Oct: the greeting welcomes the player by the nickname they chose; an automatic guest name ("Guest 465",
// shared-table.js guestName) is never said, the greeting then has no name.
const AUTO_GUEST=/^guest\s*\d*$/i;
export function personalizedGreeting(name,language='en') {
  const clean=String(name??'').normalize('NFC').trim().replace(/\s+/g,' ');
  if(!VALID_NAME.test(clean))throw new Error('Greeting name is invalid');
  const said=AUTO_GUEST.test(clean)?null:clean;
  switch(dealerLanguage(language)) {
    case 'sv': return said?`Hej ${said}, välkommen, hur mår du idag?`:'Hej, välkommen, hur mår du idag?';   // Svenska Spel demo 15 Oct: a Swedish table greeted in English text
    case 'es': return said?`Hola, ${said}, bienvenido. ¿Cómo estás hoy?`:'Hola, bienvenido. ¿Cómo estás hoy?';
    case 'fr': return said?`Bonjour ${said}, bienvenue, comment allez-vous aujourd’hui ?`:'Bonjour, bienvenue, comment allez-vous aujourd’hui ?';
    case 'zh': return said?`你好，${said}，欢迎！今天过得怎么样？`:'你好，欢迎！今天过得怎么样？';
    case 'pt': return said?`Oi ${said}, bem-vindo, como você está hoje?`:'Oi, bem-vindo, como você está hoje?';
    case 'ko': return said?`안녕하세요 ${said}님, 환영합니다! 오늘 기분 어떠세요?`:'안녕하세요, 환영합니다! 오늘 기분 어떠세요?';
    default: return said?`Hi ${said}, welcome, how are you today?`:'Hi there, welcome, how are you today?';
  }
}
