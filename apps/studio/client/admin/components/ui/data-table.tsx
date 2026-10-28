'use client';
import {useMemo,useState,type ReactNode} from 'react';
import {ArrowDown,ArrowUp,ArrowUpDown,Search} from 'lucide-react';
import {cn,focusRing} from './kit';

export type Column<T>={id:string;header:ReactNode;cell:(row:T)=>ReactNode;sort?:(row:T)=>string|number;align?:'left'|'right';className?:string};
const collator=new Intl.Collator('sv',{numeric:true,sensitivity:'base'});
/** A table with sortable columns and an optional free-text filter. Sorting is announced through aria-sort. */
export function DataTable<T>({rows,columns,rowKey,label,filter,empty='Inget att visa.',toolbar,initialSort}:{rows:T[];columns:Column<T>[];rowKey:(row:T)=>string;label:string;filter?:{placeholder:string;text:(row:T)=>string};empty?:ReactNode;toolbar?:ReactNode;initialSort?:{id:string;dir:'asc'|'desc'}}) {
  const [sort,setSort]=useState(initialSort??null),[query,setQuery]=useState('');
  const shown=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase('sv');
    const filtered=filter&&needle?rows.filter(row=>filter.text(row).toLocaleLowerCase('sv').includes(needle)):rows;
    const column=sort&&columns.find(row=>row.id===sort.id);
    if(!column?.sort)return filtered;
    const value=column.sort;
    return [...filtered].sort((left,right)=>{const a=value(left),b=value(right);const order=typeof a==='number'&&typeof b==='number'?a-b:collator.compare(String(a),String(b));return sort!.dir==='asc'?order:-order;});
  },[rows,columns,sort,query,filter]);
  return <div className="min-w-0">
    {(filter||toolbar)&&<div className="mb-3 flex flex-wrap items-center gap-2">
      {filter&&<label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-xs"><span className="sr-only">Filtrera {label.toLocaleLowerCase('sv')}</span><Search className="pointer-events-none absolute left-2.5 size-4 text-sg-faint" aria-hidden="true"/>
        <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={filter.placeholder} className={cn('h-9 w-full rounded-lg border border-sg-border bg-sg-surface pl-8 pr-3 text-[13.5px] text-sg-text placeholder:text-sg-faint',focusRing)}/></label>}
      {toolbar}
    </div>}
    <div className="overflow-x-auto"><table className="w-full border-collapse text-[13.5px]" aria-label={label}>
      <thead><tr>{columns.map(column=>{const active=sort?.id===column.id;return <th key={column.id} scope="col" aria-sort={column.sort?active?sort!.dir==='asc'?'ascending':'descending':'none':undefined}
        className={cn('whitespace-nowrap border-b border-sg-border px-3 py-2 text-left text-xs font-semibold text-sg-muted',column.align==='right'&&'text-right')}>
        {column.sort?<button type="button" onClick={()=>setSort(active?{id:column.id,dir:sort!.dir==='asc'?'desc':'asc'}:{id:column.id,dir:'asc'})} className={cn('-mx-1 inline-flex items-center gap-1 rounded border-0 bg-transparent px-1 py-0.5 font-semibold text-inherit hover:text-sg-text',focusRing)}>
          {column.header}{active?sort!.dir==='asc'?<ArrowUp className="size-3.5" aria-hidden="true"/>:<ArrowDown className="size-3.5" aria-hidden="true"/>:<ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true"/>}</button>:column.header}
      </th>;})}</tr></thead>
      <tbody>{shown.map(row=><tr key={rowKey(row)} className="transition-colors hover:bg-sg-surface-2">{columns.map(column=><td key={column.id} className={cn('border-b border-sg-line-2 px-3 py-3 align-middle',column.align==='right'&&'text-right tabular-nums',column.className)}>{column.cell(row)}</td>)}</tr>)}
        {!shown.length&&<tr><td colSpan={columns.length} className="px-3 py-6 text-center text-sg-muted">{query?'Inget matchar filtret.':empty}</td></tr>}</tbody>
    </table></div>
  </div>;
}
