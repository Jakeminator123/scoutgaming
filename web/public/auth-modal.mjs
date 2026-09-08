let pending, generation=0;
const dialog=document.createElement('dialog');dialog.id='auth-modal';
dialog.innerHTML=`<button class="auth-close" type="button" aria-label="Close sign in">×</button><div class="auth-brand" role="img" aria-label="scout/gaming">scout<span>/</span>gaming</div><p class="auth-eyebrow">PRIVÉ BLACKJACK</p><h2 id="auth-title">Sign in</h2><p id="auth-purpose"></p><form><label for="auth-email">Email or username</label><input id="auth-email" type="text" autocomplete="username" maxlength="254" required placeholder="Email or username"><label for="auth-password">Password</label><input id="auth-password" type="password" autocomplete="current-password" minlength="1" maxlength="128" required><small>Use your existing Scout account password.</small><p id="auth-error" role="alert"></p><button id="auth-submit" type="submit">Sign in →</button></form><p class="auth-note">Demo credits only. Your table stays here.</p>`;
dialog.setAttribute('aria-labelledby','auth-title');document.body.appendChild(dialog);
const $=s=>dialog.querySelector(s);
$('.auth-close').onclick=()=>dialog.close('cancel');
$('form').onsubmit=async e=>{e.preventDefault();const attempt=generation;$('#auth-submit').disabled=true;$('#auth-error').textContent='';try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#auth-email').value,password:$('#auth-password').value})});const out=await r.json();if(!r.ok)throw Error(out.error??'Unable to sign in');if(attempt===generation && dialog.open)dialog.close('authenticated');}catch(e){$('#auth-error').textContent=e.message;}finally{$('#auth-submit').disabled=false;}};
export function requestLogin(purpose){
  if(pending)return pending;
  generation++;$('#auth-error').textContent='';$('#auth-purpose').textContent=purpose;$('#auth-password').value='';dialog.returnValue='';
  pending=new Promise(resolve=>dialog.addEventListener('close',()=>{const ok=dialog.returnValue==='authenticated';pending=null;$('#auth-password').value='';resolve(ok);},{once:true}));dialog.showModal();return pending;
}
