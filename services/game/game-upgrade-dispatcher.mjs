// One application-owned dispatcher. Legacy services receive only an upgrade
// registration port, so their existing on/off lifecycle cannot compete for 101.
const routes=Object.freeze({
  room:path=>path==='/shared-room'||path.startsWith('/shared-room/'),
  speech:path=>path==='/speech-stream'||path==='/lipsync-worker',
  moving:path=>path==='/moving-speech-stream'||path.startsWith('/lipsync-moving/'),
});
export function createGameUpgradeDispatcher(server) {
  if(!server||typeof server.on!=='function'||typeof server.off!=='function'||typeof server.once!=='function')throw TypeError('HTTP server required');
  const handlers=new Map(),ports=new Map();let stopped=false;
  function reject(socket,status) {
    if(socket.destroyed)return;
    const broken=()=>socket.destroy(),timer=setTimeout(broken,1000);timer.unref?.();
    const cleanup=()=>{clearTimeout(timer);socket.off('error',broken);};
    socket.once('error',broken);socket.once('close',cleanup);
    try{socket.end('HTTP/1.1 '+status+' Rejected\r\nConnection: close\r\nCache-Control: private, no-store\r\nContent-Length: 0\r\n\r\n',()=>socket.destroy());}
    catch{broken();}
  }
  function dispatch(request,socket,head) {
    if(stopped){reject(socket,503);return;}
    // This selects ownership only. Each owner still validates its raw path,
    // authority, origin, authentication and handshake before emitting 101.
    const raw=request?.url,path=typeof raw==='string'&&raw.startsWith('/')?raw.split(/[?#]/,1)[0]:'';
    const name=Object.keys(routes).find(name=>routes[name](path)),handler=handlers.get(name);
    if(!handler){reject(socket,404);return;}
    const written=socket.bytesWritten;
    const failed=()=>{if(socket.destroyed)return;if(socket.bytesWritten===written)reject(socket,503);else socket.destroy();};
    try {Promise.resolve(handler(request,socket,head)).catch(failed);}catch{failed();}
  }
  server.on('upgrade',dispatch);
  const close=()=>{stopped=true;handlers.clear();};
  server.once('close',()=>{close();server.off('upgrade',dispatch);});
  return Object.freeze({close,port(name) {
    if(!Object.hasOwn(routes,name))throw TypeError('Unknown upgrade owner');
    if(!ports.has(name)) {
      const port=Object.freeze({
        on(event,handler) {
          if(event!=='upgrade'||typeof handler!=='function')throw TypeError('Upgrade registration required');
          if(stopped||handlers.has(name))throw Error('Upgrade owner already registered or stopped');
          handlers.set(name,handler);return port;
        },
        off(event,handler) {
          if(event!=='upgrade')throw TypeError('Upgrade registration required');
          if(handlers.get(name)===handler)handlers.delete(name);return port;
        },
      });
      ports.set(name,port);
    }
    return ports.get(name);
  }});
}
