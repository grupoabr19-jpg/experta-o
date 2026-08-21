(function(){
  const sectionResources={ranking:'ranking',rotas:'sales_routes',portfolio:'portfolio',prospeccao:'scripts',followup:'scripts',objecoes:'scripts',fechamento:'scripts',reativacao:'project_war',kommo:'kommo',blog:'blog',marketing:'marketing',ideaaco:'ideaaco'};
  const topResources={prospeccao:'scripts',objecoes:'scripts',reativacao:'project_war',kommo:'kommo'};
  const allowed=(permissions,resource)=>permissions?.[resource]==='view'||permissions?.[resource]==='manage';
  async function applyAccess(){
    let access={permissions:{},isSuperAdmin:false};try{const response=await fetch('/api/access/me',{credentials:'same-origin'});if(response.ok)access=await response.json();}catch{}
    const can=resource=>access.isSuperAdmin||allowed(access.permissions,resource);
    window.portalAccess=access;
    for(let index=sections.length-1;index>=0;index--){const resource=sectionResources[sections[index].id];if(resource&&!can(resource))sections.splice(index,1);}
    document.querySelectorAll('.topnav a').forEach(link=>{const id=(link.getAttribute('href')||'').replace(/^.*[#/]/,'');const resource=topResources[id];if(resource&&!can(resource))link.remove();});
    document.body.classList.toggle('ticker-denied',!can('ranking_ticker'));
    if(!can('ranking_ticker')){const ticker=document.querySelector('#ticker');if(ticker)ticker.hidden=true;}
    const current=(location.pathname.replace(/^\/+|\/+$/g,'')||location.hash.replace(/^#/,'')||'visao');if(sectionResources[current]&&!sections.some(item=>item.id===current)){history.replaceState({},'',location.pathname.startsWith('/')?'/conta':'#conta');}
    renderNav();renderContent();observeSections();
  }
  applyAccess();
})();