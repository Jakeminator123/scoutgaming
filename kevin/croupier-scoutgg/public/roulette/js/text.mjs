// Spelets texter per språk (som blackjackens lang). Bordets lang väljer tabellen (?lang= eller bordet), standard "en".
// Lägg till ett språk genom att kopiera en-tabellen; nycklar som saknas faller tillbaka på engelska.
// Terminologin följer live-roulettespelen: Straight, Split, Street, Corner, Six Line, Trio, First Four, Dozen, Column.
import { BET_BY_ID, pocketColor } from "./regler.mjs";

const en = {
  locale: "en-US",
  // topplistan och plånboken
  last: "LAST", balance: "Balance", totalBet: "Total bet", limits: (min, max, tot) => `${min} – ${max} · max ${tot}`,
  sound: "Sound on/off", settings: "Settings", stats: "Statistics (last 100)", rules: "Rules & payouts", fullscreen: "Fullscreen",
  close: "Close (Esc)", undo: "Undo (Ctrl+Z)", double: "Double", clear: "Clear", chip: (v) => `Chip ${v}`, chipNoFunds: (v) => `Chip ${v}: not enough balance`,
  // knappen och listen
  play: "PLAY", repeat: "REPEAT", noMoreBets: "NO MORE BETS", noMoreShort: "NO MORE BETS", yourBets: "YOUR BETS",
  topUp: (b) => `Top up ${b}`,
  // satsbordet
  even: "Even", odd: "Odd", low: "1–18", high: "19–36", dozens: ["1st 12", "2nd 12", "3rd 12"], column: "2:1",
  // besked
  noFunds: "Not enough balance", noFundsFor: (b) => `Not enough balance for ${b}`, noFundsRepeat: "Not enough balance to repeat",
  maxPerBet: (m) => `Max ${m} per bet`, maxTotal: (m) => `Max ${m} per round`, capped: (b) => `Capped at ${b} on this bet`, outOfFunds: "Balance is empty",
  // resultatet
  red: "Red", black: "Black", zero: "Zero", colorWord: (n) => (n === 0 ? "ZERO" : pocketColor(n) === "red" ? "RED" : "BLACK"),
  said: (n) => (n === 0 ? "Zero." : `${n}, ${pocketColor(n) === "red" ? "red" : "black"}.`),
  props: (n) => (n === 0 ? "Zero" : `${pocketColor(n) === "red" ? "Red" : "Black"} · ${n % 2 ? "Odd" : "Even"} · ${n <= 18 ? "1–18" : "19–36"}`),
  youWin: "You win", noWin: "No win this time", stake: "Bet", net: "net", more: (k) => `+ ${k} more`,
  // satsningarnas namn (vinstkortet, listen)
  bet: { straight: "Straight", split: "Split", street: "Street", corner: "Corner", line: "Six Line", trio: "Trio", firstFour: "First Four",
    dozen: "Dozen", column: "Column", red: "Red", black: "Black", even: "Even", odd: "Odd", low: "1–18", high: "19–36" },
  // panelerna
  rulesTitle: "Rules & payouts",
  rulesIntro: (min, max, tot) => `European roulette with a single zero. Bet ${min}–${max} per bet and up to ${tot} per round. Wins are paid with the stake returned. Return to player 97.3%.`,
  rulesHead: ["Bet", "Numbers", "Pays"],
  rulesRows: ["Straight", "Split", "Street", "Trio (0/1/2 or 0/2/3)", "Corner", "First Four (0/1/2/3)", "Six Line", "Dozen", "Column (2:1)", "Red/Black, Even/Odd, 1–18/19–36"],
  rulesNote: "Place a chip in the middle of a number (straight), on a line (split), on a cross (corner), on the bottom edge (street) or on the edge and a line (six line). Keys: Space plays or repeats, Ctrl+Z undoes, Esc closes.",
  statsTitle: "Statistics", statsIntro: (n) => `The last ${n} rounds at this table.`, hot: "Hot", cold: "Cold",
  colour: "Colour", oddEven: "Odd/Even", lowHigh: "Low/High",
  settingsTitle: "Settings", soundLbl: "Sound", volume: "Volume", quality: "Picture quality", qHigh: "High", qLow: "Low (no shadows, for slower computers)",
  saved: "Your choices are saved in this browser.",
  // laddningen
  loadKicker: "Live roulette", loadSteps: { rum: "Room", astrid: "Dealer", klipp: "Clips", hjul: "Wheel" },
  loading: { start: "Opening the studio", wheel: "Wheel", dealer: "Dealer", physics: "Physics", table: "Table", studio: "Studio", welcome: "Welcome" },
  dealerTag: "AI dealer",
};
export const TEXTER = { en };

export function sprak(lang = "en") {
  const T = TEXTER[lang] ?? en;
  const t = new Proxy(T, { get: (o, k) => (k in o ? o[k] : en[k]) });
  const fmt = (n) => n.toLocaleString(t.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kort = (n) => n.toLocaleString(t.locale, { maximumFractionDigits: 2 });
  // satsningens namn ur motorns katalog (nummer och typ), på bordets språk
  function betNamn(id) {
    const b = BET_BY_ID[id], B = t.bet;
    if (B[id]) return B[id];
    if (id === "first-four") return B.firstFour;
    const nr = b.numbers;
    if (b.type === "dozen") return t.dozens[+id.split("-")[1] - 1];
    if (b.type === "column") return `${B.column} ${id.split("-")[1]}`;
    if (b.type === "street" || b.type === "line") return `${B[b.type]} ${nr[0]}–${nr[nr.length - 1]}`;
    if (b.type === "straight") return `${B.straight} ${nr[0]}`;
    return `${B[b.type] ?? b.type} ${nr.join("/")}`;
  }
  return { t, fmt, kort, betNamn };
}
