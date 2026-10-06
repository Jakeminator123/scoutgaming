import asset0 from './assets/amira-portrait.jpg';
import asset1 from './assets/astrid-portrait.jpg';
import asset2 from './assets/astrid-stream.png';
import asset3 from './assets/azure-room.jpg';
import asset4 from './assets/darkhall-room.jpg';
import asset5 from './assets/goldensalon-room.jpg';
import asset6 from './assets/mei-portrait.jpg';
import asset7 from './assets/prive-room.jpg';
import asset8 from './assets/scout-mark.png';
import asset9 from './assets/vera-portrait.jpg';
import start from './assets/astrid-start.png';
const assets={'/bo/img/amira-portrait.jpg':asset0.src,'/bo/img/astrid-portrait.jpg':asset1.src,'/bo/img/astrid-stream.png':asset2.src,'/bo/img/azure-room.jpg':asset3.src,'/bo/img/darkhall-room.jpg':asset4.src,'/bo/img/goldensalon-room.jpg':asset5.src,'/bo/img/mei-portrait.jpg':asset6.src,'/bo/img/prive-room.jpg':asset7.src,'/bo/img/scout-mark.png':asset8.src,'/bo/img/vera-portrait.jpg':asset9.src,'/bo/design-studio/astrid/startbild.png':start.src};
export function assetUrl(value) { if (typeof value !== 'string') return undefined; if (/^data:image\/(png|jpeg|webp);base64,/.test(value)) return value; return assets[value]; }
