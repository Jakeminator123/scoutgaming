let pending, generation=0;
const dialog=document.createElement('dialog');dialog.id='auth-modal';
dialog.innerHTML=`<button class="auth-close" type="button" aria-label="Close sign in">×</button><p class="auth-eyebrow">SCOUT / GAMING</p><h2 id="auth-title">Sign in</h2><p id="auth-purpose"></p><form><label for="auth-email">Email address</label><input id="auth-email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"><label for="auth-password">Password</label><input id="auth-password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required><small>Use 12–128 characters.</small><p id="auth-error" role="alert"></p><button id="auth-submit" type="submit">Sign in →</button></form><button id="auth-mode" type="button">New here? Create an account</button><p class="auth-note">Demo credits only. Your table stays here.</p>`;
dialog.setAttribute('aria-labelledby','auth-title');document.body.appendChild(dialog);
const $=s=>dialog.querySelector(s);let register=false;
function mode(){ $('#auth-title').textContent=register?'Create your account':'Sign in';$('#auth-submit').textContent=register?'Create account →':'Sign in →';$('#auth-mode').textContent=register?'Already have an account? Sign in':'New here? Create an account';$('#auth-password').autocomplete=register?'new-password':'current-password';$('#auth-error').textContent=''; }
$('.auth-close').onclick=()=>dialog.close('cancel');$('#auth-mode').onclick=()=>{register=!register;mode();};
$('form').onsubmit=async e=>{e.preventDefault();const attempt=generation;$('#auth-submit').disabled=$('#auth-mode').disabled=true;$('#auth-error').textContent='';try{const r=await fetch(`/api/auth/${register?'register':'login'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#auth-email').value,password:$('#auth-password').value})});const out=await r.json();if(!r.ok)throw Error(out.error??'Unable to sign in');if(attempt===generation && dialog.open)dialog.close('authenticated');}catch(e){$('#auth-error').textContent=e.message;}finally{$('#auth-submit').disabled=$('#auth-mode').disabled=false;}};
export function requestLogin(purpose){
  if(pending)return pending;
  generation++;register=false;mode();$('#auth-purpose').textContent=purpose;$('#auth-password').value='';dialog.returnValue='';
  pending=new Promise(resolve=>dialog.addEventListener('close',()=>{const ok=dialog.returnValue==='authenticated';pending=null;$('#auth-password').value='';resolve(ok);},{once:true}));dialog.showModal();return pending;
}
