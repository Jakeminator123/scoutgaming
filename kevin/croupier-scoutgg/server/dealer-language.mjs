import { RESPONSES } from './dealer-policy.mjs';

export const DEALER_LANGUAGES = Object.freeze({
  sv: { code: 'sv', name: 'Swedish', label: 'SV' },
  en: { code: 'en', name: 'English', label: 'EN' },
  es: { code: 'es', name: 'Spanish', label: 'ES' },
  fr: { code: 'fr', name: 'French', label: 'FR' },
  zh: { code: 'zh', name: 'Chinese', label: '中文' },
  pt: { code: 'pt', name: 'Portuguese', label: 'PT' },
  ko: { code: 'ko', name: 'Korean', label: 'KO' },
});

const TEXT = Object.freeze({
  en: RESPONSES,
  sv: {
    greeting: 'Hej och välkommen. Jag kan förklara reglerna och kontrollerna i den här demon.',
    social: 'Tack för att du pratar med mig. Jag kan förklara spelets regler eller kontrollerna här.',
    rules: 'Blackjack betalar tre till två. Dealern stannar på alla sjuttor. Fullständiga regler och utbetalningar för sidoinsatser finns under Demoinformation.',
    outcome: 'Spelservern bestämmer korten och utbetalningarna. Jag kan inte förutsäga eller ändra resultatet.',
    support: 'Du kan ta en paus i 24 timmar med knappen Ta en paus. Länkar till stöd finns under Demoinformation.',
    privacy: 'Dela inga personliga eller finansiella uppgifter. Bordschatten syns för andra besökare.',
    fallback: 'Jag kan förklara demons regler och kontroller. Jag kan inte ge råd om insatser eller uppmuntra dig att spela.',
  },
  es: {
    greeting: 'Hola, bienvenido. Puedo explicar las reglas y los controles de esta demostración.',
    social: 'Gracias por conversar. Puedo explicar las reglas del juego o los controles disponibles aquí.',
    rules: 'El blackjack paga tres a dos. La crupier se planta con cualquier diecisiete. Las reglas completas y los pagos de las apuestas laterales están en Información de la demostración.',
    outcome: 'El servidor del juego determina las cartas y los pagos. No puedo predecir ni cambiar el resultado.',
    support: 'Puedes tomar un descanso de 24 horas con el botón Tomar un descanso. Encontrarás enlaces de ayuda en Información de la demostración.',
    privacy: 'No compartas datos personales ni financieros. El chat de la mesa es visible para los demás visitantes.',
    fallback: 'Puedo explicar las reglas y los controles de la demostración. No puedo aconsejar apuestas ni animarte a jugar.',
  },
  fr: {
    greeting: 'Bonjour et bienvenue. Je peux vous expliquer les règles et les commandes de cette démonstration.',
    social: 'Merci pour votre message. Je peux vous expliquer les règles du jeu ou les commandes disponibles ici.',
    rules: 'Le blackjack paie trois contre deux. La donneuse reste sur tout dix-sept. Les règles complètes et les paiements des paris annexes sont dans les informations de démonstration.',
    outcome: 'Le serveur du jeu détermine les cartes et les paiements. Je ne peux ni prédire ni modifier le résultat.',
    support: 'Vous pouvez faire une pause de 24 heures avec le bouton Faire une pause. Les liens d’aide sont dans les informations de démonstration.',
    privacy: 'Ne partagez aucune information personnelle ou financière. Le chat de la table est visible par les autres visiteurs.',
    fallback: 'Je peux expliquer les règles et les commandes de la démonstration. Je ne peux pas conseiller de mises ni vous inciter à jouer.',
  },
  zh: {
    greeting: '你好，欢迎来到牌桌。我可以为你介绍本演示的规则和操作。',
    social: '谢谢你来聊天。我可以介绍游戏规则或这里提供的操作。',
    rules: 'Blackjack 的赔率为三比二。庄家在所有十七点时停牌。完整规则和边注赔率请查看演示说明。',
    outcome: '游戏服务器决定发出的牌和派奖结果。我无法预测或更改结果。',
    support: '你可以点击“休息一下”开启 24 小时休息。演示说明中有相关帮助链接。',
    privacy: '请勿分享个人或财务信息。牌桌聊天内容对其他访客可见。',
    fallback: '我可以介绍演示规则和操作，但不能提供下注建议或鼓励你赌博。',
  },
  pt: {
    greeting: 'Olá, seja bem-vindo. Posso explicar as regras e os controles desta demonstração.',
    social: 'Obrigado pela conversa. Posso explicar as regras do jogo ou os controles disponíveis aqui.',
    rules: 'O blackjack paga três para dois. A banca para em todos os dezessetes. As regras completas e os pagamentos das apostas laterais estão em Demo information.',
    outcome: 'O servidor do jogo define as cartas e os pagamentos. Não posso prever nem mudar o resultado.',
    support: 'Você pode fazer uma pausa de 24 horas com o botão Take a break. Os links de ajuda estão em Demo information.',
    privacy: 'Não compartilhe dados pessoais ou financeiros. O chat da mesa é visível para os outros visitantes.',
    fallback: 'Posso explicar as regras e os controles da demonstração. Não posso dar conselhos de apostas nem incentivar você a jogar.',
  },
  ko: {
    greeting: '안녕하세요, 환영합니다. 이 데모의 규칙과 조작 방법을 설명해 드릴 수 있어요.',
    social: '대화해 주셔서 감사해요. 게임 규칙이나 여기서 쓸 수 있는 조작 방법을 설명해 드릴 수 있어요.',
    rules: '블랙잭은 삼 대 이로 지급됩니다. 딜러는 모든 십칠에서 멈춥니다. 전체 규칙과 사이드 벳 배당은 Demo information에 있어요.',
    outcome: '카드와 지급은 게임 서버가 정합니다. 저는 결과를 예측하거나 바꿀 수 없어요.',
    support: 'Take a break 버튼으로 데모를 24시간 동안 쉴 수 있어요. 도움을 받을 수 있는 링크는 Demo information에 있어요.',
    privacy: '개인 정보나 금융 정보는 공유하지 마세요. 테이블 채팅은 다른 방문자에게도 보여요.',
    fallback: '데모의 규칙과 조작 방법은 설명해 드릴 수 있어요. 하지만 베팅 조언을 하거나 게임을 권할 수는 없어요.',
  },
});

export function normalizeDealerLanguage(value) {
  return Object.hasOwn(DEALER_LANGUAGES, value) ? value : 'en';
}

export function responseId(text) {
  return Object.keys(RESPONSES).find((id) => RESPONSES[id] === text) ?? null;
}

export function localizeResponse(text, language = 'en') {
  const id = responseId(text);
  return id ? TEXT[normalizeDealerLanguage(language)][id] : TEXT[normalizeDealerLanguage(language)].fallback;
}

export function localizedClip(manifest, clip, language = 'en') {
  const code = normalizeDealerLanguage(language);
  if (!clip || code === 'en') return clip;
  return manifest.repliker_sprak?.[code]?.find((line) => line.id === clip.id) ?? clip;
}
