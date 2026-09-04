(function(){
  if (!sections.some(item => item.id === 'ranking')) sections.splice(1, 0, { id:'ranking', icon:'R$', label:'Ranking' });
  meta.ranking = ['02','Ranking comercial','Desempenho por tonelagem e percentual da meta, conforme a planilha comercial.'];
  const percentage = item => Number.isFinite(Number(item.attainment)) ? Number(item.attainment) : null;
  const ordered = items => items.filter(item => percentage(item)!==null).sort((a,b)=>(a.position||0)-(b.position||0));
  const identity = (item,kind) => kind==='team' ? `<strong>${item.name||'Equipe a definir'}</strong><small>${item.route||'Região a definir'}</small>` : `<strong>${item.name||'Vendedor a definir'}</strong><small>${item.route||'Região a definir'}</small>`;
  const tons = value => value!=null?Number(value).toLocaleString('pt-BR')+' Ton.':'&mdash;';
  const table = (items,kind) => { const rows=ordered(items); if(!rows.length)return '<div class="ranking-empty">Aguardando dados da planilha de ranking.</div>'; const label=kind==='team'?'Região / equipe':'Vendedor / região'; return `<div class="ranking-table"><div class="ranking-row ranking-head"><span>Pos.</span><span>${label}</span><span>Realizado</span><span>Meta</span><span>% da meta</span><span>Status</span></div>${rows.map(x=>`<div class="ranking-row"><b>${x.position}&ordm;</b><span>${identity(x,kind)}</span><span>${tons(x.tons)}</span><span>${tons(x.targetTons)}</span><em>${x.attainment.toFixed(1)}%</em><span>${x.status||'&mdash;'}</span></div>`).join('')}</div>`; };
  const populate = data => {
    const teams=data.teams||data.regions||[], sellers=data.sellers||[], management=data.management||{};
    for(let index=cards.length-1;index>=0;index--) if(cards[index].section==='ranking') cards.splice(index,1);
    cards.push(
      {id:'ranking-leadership',section:'ranking',audience:'todos',title:'Liderança comercial',tags:['gestão'],html:`<div class="leadership"><span><small>Direção geral</small><b>${management.generalManager||'&mdash;'}</b></span><span><small>Gerente de vendas</small><b>${management.salesManager||'&mdash;'}</b></span><span><small>Supervisor de vendas</small><b>${management.salesSupervisor||'&mdash;'}</b></span></div>`},
      {id:'ranking-teams',section:'ranking',audience:'todos',title:'Ranking por região / equipe',tags:['ranking'],html:table(teams,'team')},
      {id:'ranking-sellers',section:'ranking',audience:'todos',title:'Ranking por vendedor',tags:['ranking'],html:table(sellers,'seller')}
    );
    renderNav(); renderContent(); observeSections();
  };
  window.populateRanking=populate;
  window.loadRanking?.();
  setInterval(()=>window.loadRanking?.(),300000);
})();