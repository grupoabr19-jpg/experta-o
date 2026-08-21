const PRIMARY_ADMIN_EMAIL = 'thiago.almeida@grupoabr.com.br';
const ROLE_RANK = { member: 0, area_manager: 1, staff: 2, super_admin: 3 };
const RESOURCES = ['commercial_content','ranking','scripts','sales_routes','hero_announcements','celebration_templates'];
const LEVELS = { none: 0, view: 1, manage: 2 };
const COMMERCIAL_AREA_SLUGS = new Set(['diretoria','gestao','coordenacao','marketing','vendas']);
function effectivePermissions(raw, areaSlug = '') {
  const value = { ...raw };
  if (!Object.prototype.hasOwnProperty.call(value, 'commercial_content')) value.commercial_content = COMMERCIAL_AREA_SLUGS.has(areaSlug) ? 'view' : 'none';
  if (!Object.prototype.hasOwnProperty.call(value, 'ranking')) value.ranking = raw.ranking_ticker || 'none';
  if (!Object.prototype.hasOwnProperty.call(value, 'scripts')) value.scripts = raw.project_war || raw.kommo || 'none';
  if (!Object.prototype.hasOwnProperty.call(value, 'celebration_templates')) value.celebration_templates = areaSlug === 'rh' && raw.hero_announcements === 'manage' ? 'manage' : 'none';
  return Object.fromEntries(RESOURCES.map(resource => [resource, value[resource] || 'none']));
}

module.exports = function createAdminApi({ db, authenticatedUser, ensureProfile, send, parseBody, cleanText, safeUrl }) {
  async function context(req) {
    const user = await authenticatedUser(req);
    if (!user) return null;
    let profile = await ensureProfile(user);
    if (user.email === PRIMARY_ADMIN_EMAIL && profile.role !== 'super_admin') {
      profile = (await db().query("UPDATE public.user_profiles SET role='super_admin',active=true,updated_at=now() WHERE user_id=$1 RETURNING *", [user.id])).rows[0];
    }
    const permissions = {};
    if (profile.area_id) {
      const result = await db().query('SELECT resource,access_level FROM public.area_permissions WHERE area_id=$1', [profile.area_id]);
      result.rows.forEach(item => { permissions[item.resource] = item.access_level; });
    }
    const areaSlug = profile.area_id ? (await db().query('SELECT slug FROM public.portal_areas WHERE id=', [profile.area_id])).rows[0]?.slug || '' : '';
    return { user, profile, permissions: effectivePermissions(permissions, areaSlug) };
  }
  function allowed(ctx, resource, level = 'view') {
    if (!ctx || ctx.profile.active === false) return false;
    if (ctx.profile.role === 'super_admin') return true;
    if (resource === 'feed' && ctx.profile.role === 'staff' && level === 'manage') return true;
    const areaLevel = LEVELS[ctx.permissions[resource]] || 0;
    return areaLevel >= LEVELS[level] && (level === 'view' || ROLE_RANK[ctx.profile.role] >= ROLE_RANK.area_manager);
  }
  async function requireAccess(req, res, resource, level) {
    const ctx = await context(req);
    if (!ctx) { send(res, 401, { error: 'Faça login para continuar.' }); return null; }
    if (ctx.profile.active === false) { send(res, 403, { error: 'Este perfil está desativado.' }); return null; }
    if (resource && !allowed(ctx, resource, level)) { send(res, 403, { error: 'Seu perfil não possui permissão para esta ação.' }); return null; }
    return ctx;
  }
  async function me(req, res) {
    const ctx = await requireAccess(req, res); if (!ctx) return;
    return send(res, 200, { profile: ctx.profile, permissions: ctx.permissions, resources: RESOURCES, isSuperAdmin: ctx.profile.role === 'super_admin', canModerateFeed: ctx.profile.role === 'staff' || ctx.profile.role === 'super_admin', canManageAnnouncements: allowed(ctx, 'hero_announcements', 'manage'), canManageCelebrations: allowed(ctx, 'celebration_templates', 'manage') });
  }
  async function areas(req, res) {
    const ctx = await requireAccess(req, res); if (!ctx) return;
    if (ctx.profile.role !== 'super_admin') return send(res, 403, { error: 'Apenas o administrador principal pode gerenciar áreas.' });
    if (req.method === 'GET') {
      const [areaRows, permissionRows] = await Promise.all([db().query('SELECT id,name,slug,description,active,created_at FROM public.portal_areas ORDER BY name'), db().query('SELECT area_id,resource,access_level FROM public.area_permissions ORDER BY resource')]);
      return send(res, 200, { areas: areaRows.rows.map(area => ({ ...area, permissions: effectivePermissions(Object.fromEntries(permissionRows.rows.filter(p => p.area_id === area.id).map(p => [p.resource, p.access_level])), area.slug) })), resources: RESOURCES });
    }
    if (req.method === 'POST') {
      const input = await parseBody(req); const name = cleanText(input.name, 80); const description = cleanText(input.description, 240);
      const slug = cleanText(input.slug || name, 80).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!name || !slug) return send(res, 400, { error: 'Informe o nome da área.' });
      const created = await db().query('INSERT INTO public.portal_areas(name,slug,description) VALUES($1,$2,$3) RETURNING *', [name, slug, description]);
      return send(res, 201, created.rows[0]);
    }
    if (req.method === 'PUT') {
      const input = await parseBody(req); const areaId = cleanText(input.areaId, 80);
      if (!areaId) return send(res, 400, { error: 'Área inválida.' });
      if (input.permissions && typeof input.permissions === 'object') for (const [resource, level] of Object.entries(input.permissions)) {
        if (!RESOURCES.includes(resource) || !(level in LEVELS)) continue;
        await db().query('INSERT INTO public.area_permissions(area_id,resource,access_level) VALUES($1,$2,$3) ON CONFLICT(area_id,resource) DO UPDATE SET access_level=EXCLUDED.access_level', [areaId, resource, level]);
      }
      if (typeof input.active === 'boolean') await db().query('UPDATE public.portal_areas SET active=$2,updated_at=now() WHERE id=$1', [areaId, input.active]);
      return send(res, 200, { saved: true });
    }
    return send(res, 405, { error: 'Método não permitido.' });
  }
  async function users(req, res) {
    const ctx = await requireAccess(req, res); if (!ctx) return;
    if (ctx.profile.role !== 'super_admin') return send(res, 403, { error: 'Apenas o administrador principal pode gerenciar perfis.' });
    if (req.method === 'GET') {
      const result = await db().query('SELECT p.user_id,p.email,p.display_name,p.role,p.area_id,p.active,p.created_at,a.name area_name FROM public.user_profiles p LEFT JOIN public.portal_areas a ON a.id=p.area_id ORDER BY p.display_name');
      return send(res, 200, { users: result.rows });
    }
    if (req.method === 'PUT') {
      const input = await parseBody(req); const userId = cleanText(input.userId, 160); const role = cleanText(input.role, 30); const areaId = cleanText(input.areaId, 80) || null;
      if (!userId || !(role in ROLE_RANK)) return send(res, 400, { error: 'Perfil ou papel inválido.' });
      const target = await db().query('SELECT email FROM public.user_profiles WHERE user_id=$1', [userId]);
      if (target.rows[0]?.email === PRIMARY_ADMIN_EMAIL && role !== 'super_admin') return send(res, 409, { error: 'O administrador principal não pode perder esse papel.' });
      const updated = await db().query('UPDATE public.user_profiles SET role=$2,area_id=$3,active=$4,updated_at=now() WHERE user_id=$1 RETURNING *', [userId, role, areaId, input.active !== false]);
      return send(res, 200, updated.rows[0]);
    }
    return send(res, 405, { error: 'Método não permitido.' });
  }
  async function moderateFeed(req, res) {
    const ctx = await requireAccess(req, res); if (!ctx) return;
    if (!['staff','super_admin'].includes(ctx.profile.role)) return send(res, 403, { error: 'Apenas a moderação pode realizar esta ação.' });
    if (req.method !== 'PUT') return send(res, 405, { error: 'Método não permitido.' });
    const input = await parseBody(req); const postId = cleanText(input.postId, 80);
    if (!postId) return send(res, 400, { error: 'Publicação inválida.' });
    const result = await db().query('UPDATE public.feed_posts SET hidden_at=CASE WHEN $2 THEN now() ELSE NULL END,hidden_by=CASE WHEN $2 THEN $3 ELSE NULL END WHERE id=$1 RETURNING id,hidden_at', [postId, input.hidden === true, ctx.user.id]);
    return send(res, 200, result.rows[0] || {});
  }
  function payload(input) { return { title: cleanText(input.title, 81), subtitle: cleanText(input.subtitle, 141), body: cleanText(input.body, 321), url: safeUrl(input.url), startsAt: input.startsAt ? new Date(input.startsAt) : new Date(), expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, active: input.active !== false }; }
  function valid(item) { return item.title && item.title.length <= 80 && item.subtitle.length <= 140 && item.body && item.body.length <= 320 && item.url && !Number.isNaN(item.startsAt?.valueOf()) && !Number.isNaN(item.expiresAt?.valueOf()) && item.expiresAt > item.startsAt; }
  async function announcements(req, res, url) {
    if (req.method === 'GET' && url.searchParams.get('public') === '1') {
      const result = await db().query('SELECT id,title,subtitle,body,url,starts_at,expires_at FROM public.hero_announcements WHERE active=true AND starts_at<=now() AND expires_at>now() ORDER BY starts_at DESC LIMIT 3');
      return send(res, 200, { announcements: result.rows });
    }
    const ctx = await requireAccess(req, res, 'hero_announcements', req.method === 'GET' ? 'view' : 'manage'); if (!ctx) return;
    if (req.method === 'GET') return send(res, 200, { announcements: (await db().query('SELECT id,title,subtitle,body,url,starts_at,expires_at,active,created_at,updated_at FROM public.hero_announcements ORDER BY created_at DESC LIMIT 3')).rows });
    const input = await parseBody(req); const item = payload(input);
    if (!valid(item)) return send(res, 400, { error: 'Confira os limites dos textos, o link e a validade.' });
    if (req.method === 'POST') {
      const count = await db().query('SELECT count(*)::int total FROM public.hero_announcements WHERE active=true AND expires_at>now()');
      if (count.rows[0].total >= 3) return send(res, 409, { error: 'O RH pode manter no máximo três slides ativos.' });
      const created = await db().query('INSERT INTO public.hero_announcements(author_user_id,title,subtitle,body,url,starts_at,expires_at,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [ctx.user.id, item.title, item.subtitle, item.body, item.url, item.startsAt, item.expiresAt, item.active]);
      return send(res, 201, created.rows[0]);
    }
    if (req.method === 'PUT') {
      const id = cleanText(input.id, 80); if (!id) return send(res, 400, { error: 'Comunicado inválido.' });
      const updated = await db().query('UPDATE public.hero_announcements SET title=$2,subtitle=$3,body=$4,url=$5,starts_at=$6,expires_at=$7,active=$8,updated_at=now() WHERE id=$1 RETURNING *', [id, item.title, item.subtitle, item.body, item.url, item.startsAt, item.expiresAt, item.active]);
      return send(res, 200, updated.rows[0]);
    }
    return send(res, 405, { error: 'Método não permitido.' });
  }
  async function authorize(req,res,resource,level='view'){return requireAccess(req,res,resource,level);}
  async function celebrationTemplates(req,res){
    const ctx=await requireAccess(req,res,'celebration_templates','manage');if(!ctx)return;
    const currentYear=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(new Date()));
    if(req.method==='GET'){const requested=Number(new URL(req.url,'http://localhost').searchParams.get('year')||currentYear);const rows=await db().query('SELECT event_type,template_year,subject_template,headline,message_html,active,updated_at FROM public.celebration_email_templates WHERE template_year=$1 ORDER BY event_type',[requested]);return send(res,200,{year:requested,templates:rows.rows});}
    if(req.method==='PUT'){const input=await parseBody(req),eventType=cleanText(input.eventType,24),templateYear=Number(input.templateYear),subject=cleanText(input.subjectTemplate,180),headline=cleanText(input.headline,120),messageHtml=cleanText(input.messageHtml,6000);if(!['birthday','work_anniversary'].includes(eventType)||templateYear<currentYear||templateYear>currentYear+5||!subject||!headline||!messageHtml)return send(res,400,{error:'Confira o ano e os campos do template.'});const result=await db().query(`INSERT INTO public.celebration_email_templates(event_type,template_year,subject_template,headline,message_html,active,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_type,template_year) DO UPDATE SET subject_template=EXCLUDED.subject_template,headline=EXCLUDED.headline,message_html=EXCLUDED.message_html,active=EXCLUDED.active,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING *`,[eventType,templateYear,subject,headline,messageHtml,input.active!==false,ctx.user.id]);return send(res,200,result.rows[0]);}
    return send(res,405,{error:'Método não permitido.'});
  }  return { me, areas, users, moderateFeed, announcements, celebrationTemplates, authorize };
};