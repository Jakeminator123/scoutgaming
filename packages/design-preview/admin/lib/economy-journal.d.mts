export const JOURNAL_LIMIT: number;
export type JournalRow = {key:string;at:string;playerId:string;type:string;currency:string;amount:number};
export function journalType(type:string):string;
export function readEconomyJournal(payload:unknown):JournalRow[];
export function summarizeEconomyJournal(journal:JournalRow[],options?:{currency?:string;days?:number;now?:number}):{
  currencies:string[];currency:string|null;rows:JournalRow[];count:number;credit:number;debit:number;net:number;
  daily:{day:string;credit:number;debit:number;count:number}[];types:{label:string;count:number}[];
  sourceCount:number;sourceFrom:string|null;sourceTo:string|null;
};
