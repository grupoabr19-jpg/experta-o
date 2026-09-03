(function(){
  if (!sections.some(item => item.id === 'ranking')) sections.splice(1, 0, { id:'ranking', icon:'R$', label:'Ranking' });
  meta.ranking = ['02','Ranking comercial','Desempenho por tonelagem e percentual da meta, conforme a planilha comercial.'];
  const percentage = item => Number.isFinite(Number(item.attainment)) ? Number(item.attainment) : null;
  const ordered = items => items.filter(item => percentage(item)!==null).sort((a,b)=>(a.position||0)-(b.position||0));
  const identity = (item,kind) => kind==='team' ? `<strong>${item.name||'Equipe a definir'}</strong><small>${item.route||'Região a definir'}</small>` : `<strong>${item.name||'Vendedor a definir'}</strong><small>${item.route||'Região a definir'}</small>`;
  const tons = value => value!=null?Number(value).toLocaleString('pt-BR')+' Ton.':'&mdash;';
  const table = (items,kind) => { const rows=ordered(items); if(!rows.length)return '<div class="ranking-empty">Aguardando dados da planilha de ranking.</div>'; const label=kind==='team'?'Região / equipe':'Vendedor / região'; return `<div class="ranking-table"><div class="ranking-row ranking-head"><span>Pos.</span><span>${label}</span><span>Realizado</span><span>Meta</span><span>% da meta</span><span>Status</span></div>${rows.map(x=>`<div class="ranking-row"><b>${x.position}&ordm;</b><span>${identity(x,kind)}</span><span>${tons(x.tons)}</span><span>${tons(x.targetTons)}</span><em>${x.attainment.toFixed(1)}%</em><span>${x.status||'&mdash;'}</span></div>`).join('')}</div>`; };
  window.populateRanking=populate;
  window.loadRanking?.();
  setInterval(()=>window.loadRanking?.(),300000);
})();