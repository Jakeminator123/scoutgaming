// Canonical media families, one presentation bank per dealer. Builder, validator and studio folders share this catalog.
const speechEvent = line => ['goodluck', 'insurance', 'double'].includes(line) ? `speak.${line}` : 'speak.other';
const familyId = (dealerId, eventId, situation) => `${dealerId}/${eventId}/${situation}`;

const DEAL_FOLDERS = [
  ['deal_pos1', 'deal.player.left', 'box0'],
  ['deal_pos2', 'deal.player.left', 'box1'],
  ['deal_pos3', 'deal.player.centre', 'box2'],
  ['deal_pos4', 'deal.player.centre', 'box3'],
  ['deal_pos5', 'deal.player.centre', 'box4'],
  ['deal_pos6', 'deal.player.right', 'box5'],
  ['deal_pos7', 'deal.player.right', 'box6'],
  ['deal_posdealer', 'deal.dealer', 'dealer-up'],
  ['deal_hole', 'deal.dealer', 'dealer-hole'],
  ['deal_flip', 'reveal.dealer', 'dealer-hole'],
];
const dealDefinitions = (dealerId, directories) => DEAL_FOLDERS
  .filter(([directory]) => directories.includes(directory))
  .map(([directory, eventId, situation]) => ({
    id: familyId(dealerId, eventId, situation), dealerId, eventId, situation, playbackType: 'once',
    standardPaths: [`deal/${directory}/${directory}.mp4`], variantDirectory: `deal/${directory}/variant`,
  }));

const speechLines = [
  'blackjack', 'bust', 'chatter1', 'chatter2', 'dealerblackjack', 'dealerbust', 'double', 'farewell',
  'goodluck', 'greeting', 'insurance', 'lose', 'peek', 'placebets', 'push', 'sidebet', 'win',
];
const speechDefinitions = dealerId => speechLines.map(line => {
  const eventId = speechEvent(line);
  return {
    id: familyId(dealerId, eventId, line), dealerId, eventId, situation: line, playbackType: 'once',
    standardPaths: [`repliker/${line}/${line}.mp4`], variantDirectory: `repliker/${line}/variant`,
  };
});

const idleDefinition = {
  id: familyId('astrid', 'idle.ready', 'ready'), dealerId: 'astrid', eventId: 'idle.ready', situation: 'ready', playbackType: 'idle-pool',
  standardPaths: [
    'idle/idle_breath_f73_s303.mp4',
    'idle/idle_still_f73_s302.mp4',
  ],
  variantDirectory: 'idle/variant',
};

const freeze = definitions => Object.freeze(definitions
  .map(definition => Object.freeze({ ...definition, standardPaths: Object.freeze([...definition.standardPaths]) })));

// Astrid: Emil's bank, unchanged.
export const MEDIA_FAMILY_DEFINITIONS = freeze([
  ...dealDefinitions('astrid', DEAL_FOLDERS.map(([directory]) => directory)), ...speechDefinitions('astrid'), idleDefinition,
]);

// Dragge and Paow: H3 KLARA deal takes. Neither has a flip take or an idle pool;
// Paow has no hole take, so her hole card and reveal stay on the 2D path.
// Dragge also speaks the 17 lines in English; Paow has no voice.
const H3_DEALS = ['deal_pos1', 'deal_pos2', 'deal_pos3', 'deal_pos4', 'deal_pos5', 'deal_pos6', 'deal_pos7', 'deal_posdealer'];

// Bank root per dealer: media/dealers/<dealer>/runtime/presentation. The source
// names the delivery the bank's lab-video-manifest.json was built from.
export const PRESENTATION_BANKS = Object.freeze({
  astrid: Object.freeze({ source: 'emil/dealklipp-v1', families: MEDIA_FAMILY_DEFINITIONS }),
  dragge: Object.freeze({ source: 'h3/klara-dragge', families: freeze([...dealDefinitions('dragge', [...H3_DEALS, 'deal_hole']), ...speechDefinitions('dragge')]) }),
  paow: Object.freeze({ source: 'h3/klara-paow', families: freeze(dealDefinitions('paow', H3_DEALS)) }),
});
export const PRESENTATION_BANK_DEALERS = Object.freeze(Object.keys(PRESENTATION_BANKS));
export const presentationBank = dealerId => typeof dealerId === 'string' && Object.hasOwn(PRESENTATION_BANKS, dealerId) ? PRESENTATION_BANKS[dealerId] : null;
