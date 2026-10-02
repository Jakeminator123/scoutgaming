"""Generate isolated engine copy atomically; never write through hard links."""
from pathlib import Path
import hashlib,json,os
here=Path(__file__).resolve().parent
root=next(p for p in here.parents if (p/'web/public/dealer-engine.mjs').exists())
src=root/'web/public/dealer-engine.mjs';dst=here.parent/'runtime/public/dealer-engine.mjs'
s=src.read_text()
def replace(old,new):
 global s
 assert s.count(old)==1,old
 s=s.replace(old,new)
replace('  async start() {\n    this.running = true;', '''  // Isolated-review lease: leave the same feeder, decoders and compositor alive.
  suspendPresentation() {
    this.presentationLeases ??= new Set();
    const token = {}; this.presentationLeases.add(token);
    this.suspensionStats ??= { acquired: 0, released: 0 };
    this.suspensionStats.acquired++;
    let released = false;
    return () => {
      if (released) return;
      released = true; this.presentationLeases.delete(token);
      this.suspensionStats.released++;
      if (!this.presentationLeases.size) this.resetPresentationDeadline = true;
    };
  }
  get presentationSuspended() { return (this.presentationLeases?.size ?? 0) > 0; }

  async start() {
    if (this.running) return; // never launch a second feeder/presenter
    this.running = true;''')
replace('      while (this.running) {\n        try {','''      while (this.running) {
        if (this.presentationSuspended) { await new Promise(r => setTimeout(r, 40)); continue; }
        try {''')
replace('          const [off, size] = cur.meta.frames[cur.i];','''          // fetchClip/fetchHandsClip can finish after a lease was acquired.
          // Preserve the cursor but submit nothing until the same loop resumes.
          if (!this.running || this.presentationSuspended) continue;
          const [off, size] = cur.meta.frames[cur.i];''')
replace('    const drain = () => {\n      const now = performance.now();','''    const drain = () => {
      if (this.presentationSuspended) return;
      const now = performance.now();
      if (this.resetPresentationDeadline) { next = now; this.resetPresentationDeadline = false; }''')
replace('      const d = this.stats.decoded - (this.lastDecoded ?? 0);','''      if (this.presentationSuspended) { this.lastDecoded = this.stats.decoded; this.stalls = 0; return; }
      const d = this.stats.decoded - (this.lastDecoded ?? 0);''')
# Atomic replacement is mandatory: original isolated file may be hard-linked.
assert not dst.is_symlink();tmp=dst.with_suffix('.suspension.tmp');tmp.write_text(s);os.replace(tmp,dst)
receipt={'source':str(src),'sourceSHA256':hashlib.sha256(src.read_bytes()).hexdigest(),'output':str(dst),'outputSHA256':hashlib.sha256(dst.read_bytes()).hexdigest(),'scope':'isolated4190 only','contract':'suspendPresentation returns idempotent release; caller releases in finally; no stop/start','limitation':'Already submitted decode callbacks may finish, bounded by existing24-frame buffer. Cached/network fetch can finish; no abort or speech pause.'}
(here/'engine-suspension-receipt.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt))
