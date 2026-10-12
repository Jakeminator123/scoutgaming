// Canonical Astrid media families. Builder, validator and studio folders share this catalog.
const speechEvent = line => ['goodluck', 'insurance', 'double'].includes(line) ? `speak.${line}` : 'speak.other';
const familyId = (eventId, situation) => `astrid/${eventId}/${situation}`;

const dealDefinitions = [
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
].map(([directory, eventId, situation]) => ({
  id: familyId(eventId, situation), dealerId: 'astrid', eventId, situation, playbackType: 'once',
  standardPaths: [`deal/${directory}/${directory}.mp4`], variantDirectory: `deal/${directory}/variant`,
}));

const speechLines = [
  'blackjack', 'bust', 'chatter1', 'chatter2', 'dealerblackjack', 'dealerbust', 'double', 'farewell',
  'goodluck', 'greeting', 'insurance', 'lose', 'peek', 'placebets', 'push', 'sidebet', 'win',
];
const speechDefinitions = speechLines.map(line => {
  const eventId = speechEvent(line);
  return {
    id: familyId(eventId, line), dealerId: 'astrid', eventId, situation: line, playbackType: 'once',
    standardPaths: [`repliker/${line}/${line}.mp4`], variantDirectory: `repliker/${line}/variant`,
  };
});

const idleDefinition = {
  id: familyId('idle.ready', 'ready'), dealerId: 'astrid', eventId: 'idle.ready', situation: 'ready', playbackType: 'idle-pool',
  standardPaths: [
    'idle/idle_breath_f73_s303.mp4',
    'idle/idle_still_f73_s302.mp4',
  ],
  variantDirectory: 'idle/variant',
};

export const MEDIA_FAMILY_DEFINITIONS = Object.freeze(
  [...dealDefinitions, ...speechDefinitions, idleDefinition]
    .map(definition => Object.freeze({ ...definition, standardPaths: Object.freeze([...definition.standardPaths]) })),
);
