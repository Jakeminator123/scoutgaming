// Proposed contract, not the current roulette API. Compile: asy -f pdf roulette-filmflode.asy
size(680, 550);
defaultpen(fontsize(10pt));
pen edge=rgb(0.25,0.38,0.36);
void box(pair p, string s, real w=230) {
  filldraw(shift(p)*box((-w/2,-20),(w/2,20)), rgb(0.92,0.97,0.93), edge);
  label(s,p);
}
void arrow(pair a, pair b) { draw(a--b,edge,Arrow); }
box((0,390),"VILA: samma roulette-dealer");
box((0,320),"SPELA: spara kommando och requestId");
box((0,250),"Server: pending, dolt utfall, reveal-tid",280);
box((-160,165),"Dealer: hjulimpuls och kulslapp",270);
box((160,165),"Hjul + en kula: neutral rorelse",270);
box((160,85),"Server reveal: utfall blir offentligt",270);
box((160,5),"Ett av 37 mal / korta avslut",270);
box((160,-75),"Ratt slutbild och resultat",270);
box((-160,-75),"Tillbaka till kompatibel VILA",270);
arrow((0,370),(0,340));
arrow((0,300),(0,270));
arrow((-80,230),(-160,185));
arrow((80,230),(160,185));
arrow((-25,165),(25,165));
label("cue",(0,177));
arrow((160,145),(160,105));
arrow((160,65),(160,25));
arrow((160,-15),(160,-55));
arrow((25,-75),(-25,-75));
label("BAKGRUND: eget bild/video-lager genom hela scenen",(0,-125));
label("OpenClaw: bara neutrala varianter vid lugn VILA",(0,-150));
label("Blur ar en skarv, inte ett sekretesskydd",(0,-175));
