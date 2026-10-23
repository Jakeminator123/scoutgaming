import {Plus, Trash2, Spade, CircleDot, Building2, Layers} from 'lucide-react';
import styles from './operator-game-board.module.css';

type Company = {id: string; name: string};
type Room = {
  id: string; name: string; game: string; state: string; published: boolean; playable: boolean;
  dealers: {id: string; name: string}[];
  environment?: {image?: string; label: string} | null;
};
type Props = {
  company: Company; companies: Company[]; rooms: Room[]; selectedId?: string;
  disabled: boolean; removeDisabled: boolean;
  onCompanyChange: (id: string) => void; onSelect: (id: string) => void;
  onAdd: () => void; onRemove: (id: string) => void;
};

export function OperatorGameBoard({company, companies, rooms, selectedId, disabled, removeDisabled, onCompanyChange, onSelect, onAdd, onRemove}: Props) {
  return <section className={styles.board} aria-label={'Spelutbud för ' + company.name}>
    <header className={styles.company}>
      <div className={styles.identity}>
        <span className={styles.logo}><Building2 size={27}/></span>
        <label><span className={styles.eyebrow}>SPELBOLAG</span>
          <select aria-label="Välj spelbolag" value={company.id} disabled={disabled} onChange={event => onCompanyChange(event.target.value)}>
            {companies.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <span className={styles.count}>{rooms.length} spelrum i utbudet</span>
        </label>
      </div>
      <button className={styles.add} type="button" disabled={disabled} onClick={onAdd}><Plus size={18}/> Lägg till spel</button>
    </header>
    <div className={styles.sectionTitle}><h2>Bolagets spel</h2><span>Välj ett spel för att ändra dess utseende</span></div>
    <div className={styles.games}>
      {rooms.map(room => <article key={room.id} className={styles.game} data-selected={selectedId === room.id}>
        <button type="button" className={styles.open} aria-label={'Redigera ' + room.name} aria-pressed={selectedId === room.id} disabled={disabled} onClick={() => onSelect(room.id)}>
          <span className={styles.art} data-game={room.game}>
            {room.environment?.image && <img src={room.environment.image} alt="" loading="lazy"/>}
            <span className={styles.symbol}>{room.game === 'roulette' ? <CircleDot size={56} strokeWidth={1}/> : <Spade size={50} strokeWidth={1}/>}</span>
            <span className={styles.gameType}>{room.game === 'roulette' ? 'ROULETTE' : 'BLACKJACK'}</span>
            <span className={styles.state} data-live={room.playable}>{room.playable ? 'Öppet' : room.state === 'pending' ? 'Pausat' : room.published ? 'Inte spelbart' : 'Ej publicerat'}</span>
          </span>
          <span className={styles.description}>
            <strong>{room.name}</strong><span>{room.dealers.map(dealer => dealer.name).join(' · ') || 'Välj dealer'}</span>
            <span className={styles.edit}>{selectedId === room.id ? 'Redigeras nedan' : 'Redigera spel'}</span>
          </span>
        </button>
        <button type="button" className={styles.remove} disabled={removeDisabled} onClick={() => onRemove(room.id)} aria-label={'Ta bort ' + room.name + ' från bolagets utbud'}><Trash2 size={14}/> Ta bort</button>
      </article>)}
      {!rooms.length && <div className={styles.empty}><Layers size={32}/><strong>Här börjar bolagets spelutbud</strong><span>Välj Lägg till spel för att börja.</span></div>}
    </div>
    <p className={styles.note}><Layers size={16}/> Dealer och bord väljs för varje spel. Bakgrunden väljer du separat.</p>
  </section>;
}
