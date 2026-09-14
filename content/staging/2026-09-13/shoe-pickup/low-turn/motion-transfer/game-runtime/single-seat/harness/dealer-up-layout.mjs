import {basisChange} from './game-contract.mjs';
export function applyDealerUpLayout(el,desired,readCorners){
 if(innerWidth!==1091||innerHeight!==837||el.parentElement?.id!=='dealer-cards')throw Error('Dealer-up layout requires reviewed viewport');
 const hand=el.parentElement,ancestors=[];
 for(let n=hand.parentElement;n instanceof Element;n=n.parentElement){const s=getComputedStyle(n);ancestors.push({tag:n.tagName,transform:s.transform,translate:s.translate,zoom:s.zoom});if(s.transform!=='none'||s.translate!=='none'||Number(s.zoom)!==1||s.rotate!=='none'||s.scale!=='none')throw Error('Dealer-up transformed ancestor unsupported');}
 const before=readCorners(el),parent=new DOMMatrix(getComputedStyle(hand).transform);parent.e=0;parent.f=0;
 hand.style.transform=new DOMMatrix([...basisChange(before,desired),0,0]).multiply(parent).toString();
 const center=q=>q.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]),a=center(readCorners(el)),b=center(desired),old=getComputedStyle(hand).translate;
 if(old!=='none'&&old.split(' ').some(v=>!/^[-+.\d]+px$/.test(v)))throw Error('Dealer-up parent translation unsupported');const t=old==='none'?[0,0]:old.split(' ').map(parseFloat);hand.style.translate=`${(t[0]??0)+b[0]-a[0]}px ${(t[1]??0)+b[1]-a[1]}px`;
 const after=readCorners(el),xs=after.map(q=>q[0]),ys=after.map(q=>q[1]),bounds={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
 if(bounds.left<0||bounds.right>innerWidth||bounds.top<0||bounds.bottom>innerHeight)throw Error('Dealer-up target outside viewport');
 return {version:'dealer-up-source-layout-1091x837-v1',before,after,desired,ancestors,bounds,readability:{width:bounds.right-bounds.left,height:bounds.bottom-bounds.top,accepted:false},neighborBounds:[...document.querySelectorAll('.seat .spot,.seat .card,#felt-brand')].map(n=>({className:n.className,bounds:n.getBoundingClientRect().toJSON()})),parentTransform:hand.style.transform,parentTranslate:hand.style.translate,actorWarped:false};
}
