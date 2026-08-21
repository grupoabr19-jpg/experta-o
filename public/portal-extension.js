(function(){
  var extra=[
    {id:'blog',icon:'N',label:'Blog e notícias'},
    {id:'marketing',icon:'M',label:'Materiais de marketing'},
    {id:'ideaaco',icon:'I',label:'IdeaAÇO'}
  ];
  extra.reverse().forEach(function(item){if(!sections.some(function(s){return s.id===item.id;}))sections.splice(2,0,item);});
  meta.blog=['','Blog Expertaço','Notícias, produtos, campanhas e informações úteis para a equipe comercial.'];
  meta.marketing=['','Materiais de marketing','Links oficiais para catálogos, marcas e materiais de apoio comercial.'];
  meta.ideaaco=['','IdeaAÇO','Um canal para notícias, sugestões, críticas construtivas e, principalmente, novas ideias.'];
  cards.push(
    {id:'blog-destaques',section:'blog',audience:'todos',title:'Central de novidades',tags:['notícias','produtos'],html:'<div class="blog-grid"><article><small>NOVOS PRODUTOS</small><h4>Espaço para lançamentos</h4><p>Inclua aplicações, medidas, diferenciais e orientação comercial.</p></article><article><small>INTELIGÊNCIA COMERCIAL</small><h4>Notícias para vender melhor</h4><p>Mercado, aço, construção, indústria, logística e oportunidades regionais.</p></article><article><small>EQUIPE</small><h4>Boas práticas e conquistas</h4><p>Cases, aprendizados das rotas e ações que merecem ser replicadas.</p></article></div>'},
    {id:'marketing-links',section:'marketing',audience:'todos',title:'Biblioteca comercial',tags:['materiais','downloads'],html:'<div class="resource-links"><a href="/catalogo-grupo-abr.pdf" target="_blank" rel="noopener"><b>Catálogo Grupo ABR</b><span>Produtos e especificações</span></a><a href="/experta%C3%A7o.png" download><b>Marca Expertaço</b><span>Arquivo de identidade</span></a><a href="#portfolio"><b>Portfólio navegável</b><span>Links diretos por família</span></a></div>'},
    {id:'ideaaco-form',section:'ideaaco',audience:'todos',title:'Sua ideia pode virar aço',tags:['ideias','melhoria'],html:'<div class="idea-intro"><b>Observe. Questione. Sugira. Construa.</b><p>Compartilhe uma ideia, notícia, oportunidade, sugestão ou crítica construtiva.</p></div><form id="ideaForm" class="idea-form"><label>Seu nome<input name="name" required></label><label>Categoria<select name="category"><option>Ideia</option><option>Oportunidade</option><option>Novo produto</option><option>Notícia</option><option>Sugestão</option><option>Crítica construtiva</option></select></label><label class="full">Título<input name="title" required></label><label class="full">Conte sua ideia<textarea name="message" rows="5" required></textarea></label><button class="button primary" type="submit">Salvar contribuição</button><small class="full">Nesta etapa, o rascunho fica salvo neste navegador. A sincronização com AppSheet será o próximo conector.</small></form>'}
  );
  var pct=function(x){return Number(x.targetAmount)>0?Number(x.salesAmount||0)/Number(x.targetAmount)*100:null;};
  var top=function(items){return (items||[]).map(function(x){return Object.assign({},x,{score:pct(x)});}).filter(function(x){return x.score!==null;}).sort(function(a,b){return b.score-a.score;}).slice(0,3);};
  var podium=function(items,label){if(!items.length)return '<p class="hero-empty">Aguardando metas e realizado para formar o pódio.</p>';return '<div class="hero-podium">'+items.map(function(x,i){return '<div><span>'+(i+1)+'º</span><b>'+x.name+'</b><small>'+(x.route||label)+'</small><strong>'+x.score.toFixed(1)+'%</strong></div>';}).join('')+'</div>';};
  var hero=document.getElementById('inicio');
  var slides=[];
  function paint(index){
    hero.innerHTML='<div class="hero-stage">'+slides[index].html+'</div><div id="heroMascot" class="hero-mascot '+(slides[index].ranking?'show':'')+'" aria-hidden="true"><img src="/mascote-animado.gif" alt="" width="216" height="384" decoding="async"></div><div class="hero-controls">'+slides.map(function(_,i){return '<button class="'+(i===index?'active':'')+'" data-slide="'+i+'" aria-label="Ir para o slide '+(i+1)+'"></button>';}).join('')+'</div>';
    hero.dataset.topic=slides[index].topic;
    hero.querySelectorAll('[data-slide]').forEach(function(btn){btn.onclick=function(){current=Number(btn.dataset.slide);paint(current);};});
  }
  function setupHero(data){
    slides=[
      {topic:'ranking-vendedores',ranking:true,html:'<div class="eyebrow">PÓDIO DE VENDEDORES</div><h1>Quem está na frente<br><span>em proporção à meta.</span></h1>'+podium(top(data.sellers),'Vendedor')+'<div class="hero-actions"><a class="button primary" href="#ranking">Ver ranking completo →</a></div>'},
      {topic:'ranking-equipes',ranking:true,html:'<div class="eyebrow">PÓDIO DE EQUIPES</div><h1>Rotas que transformam<br><span>meta em resultado.</span></h1>'+podium(top(data.teams||data.regions),'Equipe')+'<div class="hero-actions"><a class="button primary" href="#ranking">Comparar equipes →</a></div>'},
      {topic:'noticias',ranking:false,html:'<div class="eyebrow">INTELIGÊNCIA PARA VENDER</div><h1>Informação que vira<br><span>boa conversa.</span></h1><p>Notícias de mercado, novos produtos, campanhas, oportunidades regionais e boas práticas da equipe.</p><div class="hero-actions"><a class="button primary" href="#blog">Abrir o blog →</a><a class="button secondary" href="#marketing">Materiais de marketing</a></div>'},
      {topic:'ideaaco',ranking:false,html:'<div class="eyebrow">IDEAAÇO</div><h1>Boas ideias também<br><span>constroem resultados.</span></h1><p>Envie sugestões, oportunidades, notícias e críticas construtivas. A proposta principal é transformar observações em ideias que possam ser testadas.</p><div class="hero-actions"><a class="button primary" href="#ideaaco">Compartilhar uma ideia →</a></div>'}
    ];
    paint(0);
  }
  var current=0;
  fetch('/api/ranking').then(function(r){return r.json();}).then(setupHero).catch(function(){setupHero({sellers:[],teams:[]});});
  setInterval(function(){if(!slides.length)return;current=(current+1)%slides.length;paint(current);},9000);
  renderNav();renderContent();observeSections();
  document.addEventListener('submit',function(e){if(e.target.id!=='ideaForm')return;e.preventDefault();var values=Object.fromEntries(new FormData(e.target).entries());var saved=JSON.parse(localStorage.getItem('ideaaco-drafts')||'[]');saved.push(Object.assign({createdAt:new Date().toISOString()},values));localStorage.setItem('ideaaco-drafts',JSON.stringify(saved));e.target.reset();toast('Contribuição salva como rascunho.');});
})();