// DOM placement and lifecycle for the single-player / Studio preview client.
// The server owns the round. This controller only reads it to place its controls.
import { layoutGameOverlay, BLACKJACK_COMPACT_QUERY } from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import { placeActions, placeDealControl, placeChat } from './action-placement.mjs';

const COMPACT_BOXES = [2, 3, 4];

export function createGameInterface({ document, viewport = globalThis, layerComposition,
  studioPreview, seatEls, state, seatOfLive, activeBoxHighlight }) {
  const $ = selector => document.querySelector(selector);
  const getComputedStyle = element => viewport.getComputedStyle(element);
  const compactQuery = viewport.matchMedia(BLACKJACK_COMPACT_QUERY);
  let started = false, closed = false, interfaceFrame = 0, interfaceObserver;
  let removeGeometryListener, onCompactChange;
  const tableImage = $('#tableimg');

  function playedBoxes() {
    if (!compactQuery.matches) return seatEls.map((_, index) => index);
    // A desktop hand may resume on a phone. Keep its server-owned outer box visible.
    const round = state.round, active = round?.live()?.[round.active]?.box;
    if (Number.isInteger(active)) {
      const start = Math.max(0, Math.min(seatEls.length - 3, active - 1));
      return [start, start + 1, start + 2];
    }
    return COMPACT_BOXES;
  }

  function layoutSeats() {
    if (closed) return;
    const { innerWidth, innerHeight } = viewport;
    const { filmedProfile, localCards } = state;
    // Resize/compositor callbacks can arrive before MediaQueryList's change event.
    // Read the same current format before choosing the visible server boxes.
    const compactSeats = compactQuery.matches;
    const banner=$('#banner');
    Object.assign(banner.style,{top:'',bottom:''});
    const scene=$('#scene').getBoundingClientRect(),plane=layerComposition?.referencePlane();
    if(plane){
      const table=$('#table2d').getBoundingClientRect(),boxes=playedBoxes();
      const hud=$('#hud-bottom').getBoundingClientRect();
      const layout=layoutGameOverlay(plane,boxes,{left:12,right:scene.width-12,top:80,
        bottom:Math.min(scene.height-12,hud.height>0&&hud.top>scene.top+80?hud.top-scene.top-12:scene.height-12)},{compact:compactSeats,filmedProfile});
      $('#scene').dataset.betPlacement=layout.followCards?'under-cards':'manual';
      let geometryNotice=$('#table-geometry-warning');
      if(!geometryNotice&&layout.geometryWarning){
        geometryNotice=document.createElement('p');geometryNotice.id='table-geometry-warning';geometryNotice.setAttribute('role','status');
        Object.assign(geometryNotice.style,{position:'absolute',top:'70px',left:'12px',right:'12px',zIndex:'20',padding:'8px',background:'#241c10',color:'#ffe1a3',pointerEvents:'none'});
        $('#scene').append(geometryNotice);
      }
      if(geometryNotice){geometryNotice.textContent=layout.geometryWarning??'';geometryNotice.hidden=!layout.geometryWarning;}
      seatEls.forEach((el,i)=>el.classList.toggle('seat-off',!boxes.includes(i)));
      for(const seat of layout.seats){
        Object.assign(seatEls[seat.box].style,{left:(scene.left+seat.x-table.left)+'px',top:(scene.top+seat.y-table.top)+'px'});
        seatEls[seat.box].style.setProperty('--game-seat-scale',layout.controlScale);
      }
      if(compactSeats)Object.assign(banner.style,{top:'auto',bottom:(scene.height-Math.min(...layout.seats.map(seat=>seat.y))+60*layout.controlScale+12)+'px'});
      Object.assign($('#dealer-cards').style,{left:(scene.left+layout.dealer.x-table.left)+'px',top:(scene.top+layout.dealer.y-table.top)+'px'});
      if(filmedProfile&&layout.sourcePlane&&layout.tableId&&!layout.geometryWarning)
        layout.filmedLayout={profileId:filmedProfile.id,tableId:layout.tableId,layout:layout.tableLayout,sourcePlane:layout.sourcePlane};
      localCards?.setProjection(layout,scene.width,scene.height);
      layoutDealControl();
      return;
    }
    delete $('#scene').dataset.betPlacement;
    layoutDealControl();
    const width = Math.min(innerWidth, innerHeight * 9 / 16), height = width * 16 / 9;
    const left = (innerWidth - width) / 2, top = (innerHeight - height) / 2;
    const table = $('#table2d').getBoundingClientRect(), boxes = playedBoxes();
    seatEls.forEach((el, i) => el.classList.toggle('seat-off', !boxes.includes(i)));
    boxes.forEach((box, k) => {
      const x = .13 + .74 * k / Math.max(1, boxes.length - 1);
      const y = .68 + .035 * Math.sin(Math.PI * k / Math.max(1, boxes.length - 1));
      Object.assign(seatEls[box].style, { left: (left + x * width - table.left) + 'px', top: (top + y * height - table.top) + 'px' });
    });
    Object.assign($('#dealer-cards').style, { left: (left + width * .5 - table.left) + 'px', top: (top + height * .58 - table.top) + 'px' });

  }

  function layoutDealControl() {
    const { innerWidth } = viewport;
    layoutChat();
    const control=$('#deal-now'),scene=$('#scene');
    let notice=$('#deal-placement-warning');
    if(scene.dataset.betPlacement!=='under-cards'){
      Object.assign(control.style,{position:'',left:'',top:'',bottom:'',transform:'',visibility:''});
      if(notice)notice.hidden=true;
      return;
    }
    if(control.disabled||getComputedStyle(control).display==='none'){if(notice)notice.hidden=true;return;}
    control.style.visibility='';
    const visible=el=>el.getClientRects().length&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
    const targets=seatEls.filter(el=>!el.classList.contains('seat-off')).flatMap(el=>[...el.querySelectorAll('.spot,.sidearcs,.bet-target,.clear-box,.stake')]).filter(visible).map(el=>el.getBoundingClientRect());
    const obstacles=[...document.querySelectorAll('#wallet,#chip-row,#bottom-right,#player-choices,#rehearsal,#game-title,#sound-btn,#sign-out,#chat,.local-presentation-mode')].filter(visible).map(el=>el.getBoundingClientRect());
    const placement=placeDealControl({width:control.offsetWidth,height:control.offsetHeight,
      viewport:{width:innerWidth,top:0,bottom:$('#dealer-picker').getBoundingClientRect().top},targets,obstacles});
    if(placement)Object.assign(control.style,{position:'fixed',left:placement.x+'px',top:placement.y+'px',bottom:'auto',transform:'none'});
    else control.style.visibility='hidden';
    if(!placement&&!notice){notice=document.createElement('p');notice.id='deal-placement-warning';notice.className='local-presentation-status';notice.setAttribute('role','status');scene.append(notice);}
    if(notice){notice.textContent='Givknappen ryms inte. Förstora spelytan eller justera bordsprofilen.';notice.hidden=!!placement;}
  }

  function layoutChat(){
    const { innerWidth, innerHeight } = viewport;
    const chat=$('#chat');if(!chat||studioPreview||!document.body.classList.contains('astrid-voice-ui'))return;
    const open=$('#chat-log').classList.contains('open'),ui=layerComposition?.gameUi?.();
    const config=ui?.chat??{x:1,y:0,width:innerWidth<=860?.95:.28,height:.45};
    const obstacles=[...document.querySelectorAll('#game-title,#sound-btn,#sign-out,#hud-bottom,#dealer-picker,#local-card-overlay .playing-card,#local-card-overlay .card-totals g[data-seat],.seat:not(.seat-off) .spot,.seat:not(.seat-off) .sidearcs')]
      .filter(el=>el.getClientRects().length&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).opacity!=='0')
      .map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
    const placement=placeChat({width:open?Math.max(240,innerWidth*config.width):190,height:open?Math.max(62,innerHeight*config.height):Math.max(62,chat.scrollHeight+2),
      viewport:{width:innerWidth,top:0,bottom:innerHeight},position:config,obstacles});
    if(placement){
      Object.assign(chat.style,{position:'fixed',left:placement.x+'px',top:placement.y+'px',right:'auto',bottom:'auto',width:placement.width+'px',maxHeight:placement.height+'px'});
    }
  }

  function showActions(seat) {
    const { round, balance } = state;
    const { innerWidth, innerHeight } = viewport;
    layoutChat();
    const legal = round?.legal() ?? [];
    const bar = $('#actions');
    bar.hidden = legal.length === 0;
    const top = $('#actions-top');
    top.hidden = legal.length === 0;
    let notice=$('#action-placement-warning');
    if(notice)notice.hidden=true;
    // Measure the current viewport afresh, including after a compact/no-fit layout.
    for(const panel of [bar,top]){
      panel.classList.remove('action-compact');
      panel.classList.remove('above-hand');
      Object.assign(panel.style,{position:'',left:'',top:'',bottom:'',transform:'',visibility:''});
    }
    const stake = round?.live()[round.active]?.stake ?? Infinity;
    for (const b of [...bar.querySelectorAll('button'), ...top.querySelectorAll('button')]) {
      b.disabled = !legal.includes(b.dataset.act) ||
        ((b.dataset.act === 'double' || b.dataset.act === 'split') && balance < stake);
    }
    if (bar.hidden) return;
    const activeSeat=seat ?? seatOfLive(round.active),r=activeSeat.getBoundingClientRect();
    const compact=getComputedStyle(bar).display!=='none';
    // Only one action panel is needed. Both layouts keep the same legal moves.
    top.hidden=compact;
    const controls=compact?bar:top;
    const visibleBounds=el=>{
      if(!el.getClientRects().length)return null;
      const bounds=el.getBoundingClientRect();
      if(bounds.width<=0||bounds.height<=0)return null;
      for(let current=el;current;current=current.parentElement){
        const style=getComputedStyle(current);
        if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||parseFloat(style.opacity)===0)return null;
      }
      return bounds;
    };
    // Local presentation hides legacy DOM cards/totals and paints the visible SVG.
    // Empty results and hidden duplicates must not consume the remaining space.
    const obstacles=[...document.querySelectorAll('.card,.hand-total,#local-card-overlay .playing-card,#local-card-overlay .card-totals g[data-seat][data-hand],.seat .spot.staked,.seat .sidearcs,.sideresult,#wallet,#bottom-right,#player-choices,#rehearsal,#game-title,#sound-btn,#sign-out,#chat')].map(visibleBounds).filter(Boolean);
    const totals=[...activeSeat.querySelectorAll('.hand-total'),...document.querySelectorAll('#local-card-overlay .card-totals g[data-active="true"]')].map(visibleBounds).filter(Boolean);
    const anchor={x:r.x,bottom:Math.max(r.y,...totals.map(b=>b.bottom))};
    const bounds={width:innerWidth,top:Math.max(0,Math.min(innerHeight*.35,$('#table2d').getBoundingClientRect().top)),bottom:Math.min(innerHeight,$('#dealer-picker').getBoundingClientRect().top)};
    const saved=layerComposition?.gameUi?.()?.actions;
    const preferred=saved?{x:saved.x*Math.max(0,innerWidth-controls.offsetWidth),y:saved.y*Math.max(0,bounds.bottom-controls.offsetHeight)}:undefined;
    const locate=(margin,top=bounds.top)=>placeActions({width:controls.offsetWidth,height:controls.offsetHeight,viewport:{...bounds,top},anchor,obstacles,belowAnchor:!saved,margin,preferred});
    let placement=locate(12);
    if(!placement){
      // Keep a complete 44px touch target while bringing each label inside it.
      controls.classList.add('action-compact');
      placement=locate(4)??locate(4,0);
    }
    if(placement){
      controls.style.position='fixed';controls.style.transform='none';controls.style.bottom='auto';
      controls.style.left=`${placement.x}px`;controls.style.top=`${placement.y}px`;
      controls.style.setProperty('--action-pointer-x',`${Math.max(16,Math.min(controls.offsetWidth-16,r.x-placement.x))}px`);
      controls.classList.toggle('above-hand',placement.y<r.y);
    }else{
      // Never reuse a stale position or the overlapping CSS fallback.
      controls.style.visibility='hidden';
      if(!notice){notice=document.createElement('p');notice.id='action-placement-warning';notice.className='local-presentation-status';notice.setAttribute('role','status');$('#scene').append(notice);}
      notice.textContent='Spelknapparna ryms inte. Vrid mobilen eller förstora spelytan.';
      notice.hidden=false;
    }
  }

  function scheduleInterfaceLayout() {
    if (closed || interfaceFrame) return;
    interfaceFrame = viewport.requestAnimationFrame(() => {
      interfaceFrame = 0;
      if (closed) return;
      layoutSeats(); layoutChat();
      if (state.round && !state.busy) activeBoxHighlight();
    });
  }
  const resize = () => { if (!closed) { layoutSeats(); activeBoxHighlight(); } };
  const formatChanged = () => { if (!closed) onCompactChange(playedBoxes()); };

  function start({ startup, onCompactChange: updateCompact }) {
    if (started || closed) return;
    started = true;
    onCompactChange = updateCompact;
    // Subscribe only after the initial round/seat layout exists, even when the
    // selected first frame was ready before this controller was initialized.
    layoutSeats();
    removeGeometryListener = layerComposition?.onGeometryChange(layoutSeats);
    compactQuery.addEventListener('change', formatChanged);
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('pagehide', close, { once: true });
    tableImage?.addEventListener('load', layoutSeats);
    interfaceObserver = new viewport.ResizeObserver(scheduleInterfaceLayout);
    for (const element of [$('#chat'), $('#hud-bottom'), $('#game-title')]) {
      if (element) interfaceObserver.observe(element);
    }
    startup.whenReady.then(() => {
      if (closed || startup.state !== 'ready') return;
      layoutSeats(); activeBoxHighlight();
    });
  }

  function close() {
    if (closed) return;
    closed = true;
    interfaceObserver?.disconnect();
    viewport.cancelAnimationFrame(interfaceFrame);
    interfaceFrame = 0;
    removeGeometryListener?.();
    compactQuery.removeEventListener('change', formatChanged);
    viewport.removeEventListener('resize', resize);
    viewport.removeEventListener('pagehide', close);
    tableImage?.removeEventListener('load', layoutSeats);
  }

  return { start, close, playedBoxes, layoutSeats, layoutDealControl, layoutChat,
    showActions, scheduleInterfaceLayout, get compactSeats() { return compactQuery.matches; } };
}
