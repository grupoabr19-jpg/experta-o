(function(){
  const pathFor=id=>id==='visao'?'/':'/'+id;
  const route=()=>decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g,'')||'visao');
  const valid=id=>sections.some(s=>s.id===id);
  const clean=id=>valid(id)?id:'visao';

  renderNav=function(){
    const current=clean(route());
    document.querySelector('#sideNav').innerHTML=sections.map(s=>
      '<a href="'+pathFor(s.id)+'" data-route="'+s.id+'" class="'+(current===s.id?'active':'')+'"><span class="nav-label">'+s.label+'</span></a>'
    ).join('');
  };

  renderContent=function(){
    const current=clean(route()),section=sections.find(s=>s.id===current),m=meta[current]||['',section.label,''];
    const sectionCards=cards.filter(c=>c.section===current&&visible(c));
    const host=document.querySelector('#playbookContent');
    host.innerHTML='<section id="'+current+'" class="playbook-section content-section route-page"><header class="section-heading"><div><span class="section-kicker">PLAYBOOK EXPERTAÇO</span><h1>'+m[1]+'</h1></div><p>'+m[2]+'</p></header><div class="grid">'+sectionCards.map(card=>'<article class="card '+(card.script?'highlight':'')+'" data-id="'+card.id+'"><div class="card-tools"><button class="favorite-button '+(state.favorites.has(card.id)?'active':'')+'" aria-label="Favoritar '+card.title+'" title="Favoritar">★</button>'+(card.script?'<button class="copy-button" aria-label="Copiar '+card.title+'" title="Copiar script">Copiar</button>':'')+'</div><h2>'+card.title+'</h2><div class="card-body">'+card.html+'</div><footer>'+card.tags.map(t=>'<span class="tag">'+t+'</span>').join('')+'</footer></article>').join('')+'</div></section>';
    const summary=document.querySelector('#searchSummary');
    summary.hidden=!state.query&&state.filter==='todos';
    summary.textContent=sectionCards.length+' conteúdo'+(sectionCards.length===1?'':'s')+' encontrado'+(sectionCards.length===1?'':'s')+'.';
    bindCards();renderNav();
  };

  function applyRoute(){
    const current=clean(route()),home=current==='visao';
    document.body.dataset.route=current;
    document.querySelector('#inicio').hidden=!home;
    document.querySelector('.quick-panel').hidden=home;
    document.querySelector('#contatos').hidden=home;
    renderContent();
    document.querySelector('#sidebar').classList.remove('open');
    document.querySelector('#backdrop').classList.remove('show');
    document.querySelector('#menuButton').setAttribute('aria-expanded','false');
    scrollTo({top:0,behavior:'instant'});
  }

  document.addEventListener('click',e=>{
    const a=e.target.closest('a');
    if(!a)return;
    const url=new URL(a.href,location.href);
    if(url.origin!==location.origin||a.target==='_blank'||url.pathname.endsWith('.pdf'))return;
    const hashRoute=url.hash&&url.hash.length>1?url.hash.slice(1):null;
    const next=hashRoute&&valid(hashRoute)?pathFor(hashRoute):url.pathname;
    if(!valid(next.replace(/^\//,'')||'visao'))return;
    e.preventDefault();history.pushState({},'',next);applyRoute();
  });
  addEventListener('popstate',applyRoute);
  const heroObserver=new MutationObserver(()=>document.querySelectorAll('#inicio a[href^="#"]').forEach(a=>a.href='/'+a.getAttribute('href').slice(1)));
  heroObserver.observe(document.querySelector('#inicio'),{childList:true,subtree:true});
  document.querySelector('.brand').href='/';
  document.querySelector('.topnav').innerHTML='<a href="/">Início</a><a href="/prospeccao">Scripts</a><a href="/portfolio">Portfólio</a><a href="/ranking">Ranking</a><a href="/kommo">Kommo</a>';
  applyRoute();
})();
