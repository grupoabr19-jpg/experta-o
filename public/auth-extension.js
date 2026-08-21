(function(){
  if(!sections.some(item=>item.id==='conta'))sections.splice(2,0,{id:'conta',icon:'U',label:'Minha área'});
  meta.conta=['','Minha área','Acesso exclusivo para colaboradores com e-mail @grupoabr.com.br.'];
  cards.push({id:'user-area',section:'conta',audience:'todos',title:'Acesso corporativo',tags:['conta','segurança'],html:'<div id="authArea" class="auth-area"><p>Verificando sua sessão...</p></div>'});

  const normalizeSession=data=>data?.user?data:data?.data?.user?data.data:data?.session?.user?data.session:null;
  async function request(route,options={}){
    const response=await fetch('/api/auth/'+route,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||data.error||'Não foi possível concluir a operação.');
    return data;
  }
  function loginMarkup(message=''){
    return '<div class="auth-shell"><div class="auth-copy"><span class="section-kicker">AMBIENTE CORPORATIVO</span><h3>Entre no Expertaço</h3><p>Use exclusivamente seu endereço profissional terminado em <b>@grupoabr.com.br</b>.</p><div class="warning"><b>Acesso protegido</b><span>Não compartilhe sua senha ou sua sessão com outras pessoas.</span></div></div><div class="auth-panel">'+(message?'<p class="auth-message">'+message+'</p>':'')+'<div class="auth-tabs"><button type="button" class="active" data-auth-tab="login">Entrar</button><button type="button" data-auth-tab="register">Criar conta</button></div><form id="loginForm" class="auth-form"><label>E-mail corporativo<input name="email" type="email" required autocomplete="email" placeholder="nome@grupoabr.com.br"></label><label>Senha<input name="password" type="password" minlength="8" required autocomplete="current-password"></label><button class="button primary" type="submit">Entrar</button></form><form id="registerForm" class="auth-form" hidden><label>Nome completo<input name="name" required autocomplete="name"></label><label>E-mail corporativo<input name="email" type="email" required autocomplete="email" placeholder="nome@grupoabr.com.br"></label><label>Senha<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><small>Use no mínimo oito caracteres.</small><button class="button primary" type="submit">Criar conta</button></form></div></div>';
  }
  function profileMarkup(session){
    const user=session.user||session;
    return '<div class="profile-shell"><div class="profile-avatar">'+String(user.name||user.email||'U').charAt(0).toUpperCase()+'</div><div><span class="section-kicker">COLABORADOR AUTENTICADO</span><h3>'+String(user.name||'Usuário Expertaço')+'</h3><p>'+String(user.email||'')+'</p><p class="profile-note">Sua conta corporativa está ativa. Esta área receberá favoritos, contribuições do #IdeAÇO, votos e histórico de atividades.</p><button type="button" class="button secondary profile-logout" data-auth-logout>Sair da conta</button></div></div>';
  }
  async function renderAuth(){
    const host=document.querySelector('#authArea');if(!host)return;
    try{const data=await request('get-session',{method:'GET'});const session=normalizeSession(data);host.innerHTML=session?profileMarkup(session):loginMarkup();}
    catch{host.innerHTML=loginMarkup();}
  }
  document.addEventListener('click',async event=>{
    const tab=event.target.closest('[data-auth-tab]');
    if(tab){document.querySelectorAll('[data-auth-tab]').forEach(button=>button.classList.toggle('active',button===tab));document.querySelector('#loginForm').hidden=tab.dataset.authTab!=='login';document.querySelector('#registerForm').hidden=tab.dataset.authTab!=='register';return;}
    if(event.target.closest('[data-auth-logout]')){try{await request('sign-out',{method:'POST',body:'{}'});}catch{}renderAuth();}
  });
  document.addEventListener('submit',async event=>{
    if(!['loginForm','registerForm'].includes(event.target.id))return;
    event.preventDefault();const form=event.target,button=form.querySelector('button[type="submit"]'),values=Object.fromEntries(new FormData(form).entries());
    if(!/@grupoabr\.com\.br$/i.test(values.email||'')){toast('Use seu e-mail @grupoabr.com.br.');return;}
    button.disabled=true;button.textContent='Aguarde...';
    try{await request(form.id==='loginForm'?'sign-in/email':'sign-up/email',{method:'POST',body:JSON.stringify(values)});toast(form.id==='loginForm'?'Login realizado.':'Conta criada com sucesso.');await renderAuth();}
    catch(error){toast(error.message);button.disabled=false;button.textContent=form.id==='loginForm'?'Entrar':'Criar conta';}
  });
  new MutationObserver(()=>{if(document.body.dataset.route==='conta'&&document.querySelector('#authArea:not([data-ready])')){document.querySelector('#authArea').dataset.ready='1';renderAuth();}}).observe(document.querySelector('#playbookContent'),{childList:true,subtree:true});
  renderNav();renderContent();observeSections();
})();