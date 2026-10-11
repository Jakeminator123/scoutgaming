// Run once per explicit user action. Successful rows are never replayed;
// an uncertain commit remains an error for reconciliation, without blind retry.
export async function uploadMediaBatch(items,{upload,onChange,signal}={}){
  let saved=0;
  for(const {row,classification} of items){
    if(row.state!=='ready')continue;
    signal?.throwIfAborted();onChange(row.id,{state:'saving',progress:0});
    try{
      await upload(row.file,classification,value=>onChange(row.id,{progress:Math.round(value.percentage)}));
      saved++;onChange(row.id,{state:'saved',message:'Sparad i facket',progress:100});
    }catch(cause){onChange(row.id,{state:'error',message:(cause instanceof Error?cause.message:'Uppladdningen misslyckades.')+' Kontrollera biblioteket innan filen läggs till igen.'});}
  }
  return saved;
}
