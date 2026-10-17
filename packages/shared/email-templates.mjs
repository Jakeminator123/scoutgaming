// Preview content only. Transactional delivery remains an explicit mail action.
// Placeholders contain no account data, tracking URLs or legacy administration links.
export const EMAIL_TEMPLATES = Object.freeze([
  {id:'welcome',name:'Welcome / account created',heading:'Welcome to the table.',
    text:'Your Scout Live Casino account is ready. Your table is waiting.',
    fields:[['Account','[PLAYER EMAIL]'],['Starting balance','[DEMO BALANCE]'],['Tables','Classic · High Roller · VIP Salon']],action:'Take a seat'},
  {id:'deposit-receipt',name:'Deposit receipt',heading:'Deposit confirmed.',
    text:'Every movement on your wallet is logged and visible in your account history.',
    fields:[['Amount','[AMOUNT]'],['Method','[METHOD]'],['Reference','[TX REF]'],['New balance','[BALANCE]']],action:'Back to the table'},
  {id:'tournament-invite',name:'Tournament invite',heading:'A seat with your name on it.',
    text:'Your tournament invitation. Check the confirmed format and start time before registering.',
    fields:[['Tournament','[TOURNAMENT]'],['Buy-in','[BUY-IN]'],['Prize pool','[PRIZE POOL]'],['Starts','[DATE / TIME]'],['Format','[FORMAT]']],action:'View tournament'},
  {id:'rg-checkin',name:'Responsible gambling check-in',heading:'Still fun?',
    text:'Take a pause when you need one. Choose limits, a timeout or a break. Responsible gambling support is free and confidential.',
    fields:[['Support','[RG CONTACT]']],action:'Review my limits'},
].map(template=>Object.freeze({...template,fields:Object.freeze(template.fields.map(Object.freeze))})));
