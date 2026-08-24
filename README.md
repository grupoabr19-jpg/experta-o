# Intranet #ParceirAÇO | Grupo ABR

Aplicação web interna do Grupo ABR para apoio comercial, comunicação interna e automação operacional.

## O que o sistema faz

- Exibe um playbook de vendas com scripts, objeções, reativação, pós-venda, crise, Kommo e regras de ouro.
- Mostra um ranking comercial com base em fonte externa, JSON local ou gravação manual.
- Oferece uma área autenticada do colaborador com perfil, foto e feed interno.
- Permite administração de áreas, perfis, comunicados e templates de celebração.
- Envia e-mails automáticos de aniversário e aniversário de empresa.
- Publica conteúdos estáticos e assets de apoio como catálogo e marca.

## Arquitetura

- `server.js` centraliza o servidor HTTP, a API e o roteamento da SPA.
- `admin-server.js` concentra permissões e endpoints administrativos.
- `public/` contém a SPA e as extensões de interface.
- `scripts/` contém build e automações de e-mail.
- `data/ranking.json` serve como fallback local do ranking.
- `dist/` é a saída do build para deploy.

## Como executar

Requer Node.js 20+.

```bash
node server.js
```

Se preferir desenvolvimento com watch:

```bash
node --watch server.js
```

A aplicação sobe em `http://localhost:3000` por padrão.

## Validação

```bash
node --test
node --check server.js
node --check public/app.js
node --check public/auth-extension.js
node --check public/admin-extension.js
node --check scripts/send-celebrations.js
```

## Ranking

O comportamento do ranking é controlado por `SALES_DATA_MODE`:

- `mock`: lê `data/ranking.json`.
- `manual`: aceita `POST /api/ranking/manual` com `Authorization: Bearer <ADMIN_TOKEN>`.
- `api`: consulta `SALES_DATA_URL` e converte CSV ou JSON em contrato interno.

O contrato esperado inclui:

- `period`
- `updatedAt`
- `teams` ou `regions`
- `sellers`

## Autenticação e perfil

- A autenticação é proxied para Neon Auth via `/api/auth/*`.
- Apenas e-mails `@grupoabr.com.br` são aceitos no fluxo corporativo.
- O perfil autenticado usa PostgreSQL em `public.user_profiles`.
- O feed interno usa `public.feed_posts`.

## Celebrações por e-mail

- O envio usa Gmail SMTP com `IDEAACO_EMAIL_USER` e `IDEAACO_EMAIL_APP_PASSWORD`.
- Os templates ficam em `public.celebration_email_templates`.
- As imagens-base e a composição do cartão comemorativo são persistidas no banco.
- O envio automático grava um log em `public.celebration_email_log`.

## Deploy no Render

- O build copia os arquivos públicos para `dist/`.
- O servidor responde na porta `PORT`.
- O healthcheck é `/api/health`.
- As variáveis sensíveis são configuradas no Render como secrets.

## Limpeza e manutenção

- O modo manual do ranking grava em arquivo e não deve ser tratado como persistência definitiva em produção.
- O projeto depende de PostgreSQL para perfil, feed, áreas e templates.
- Os documentos de marca e vendas originais serviram de base para o conteúdo da intranet.

## Próximos cuidados

- Confirmar com a liderança comercial qualquer atualização de produto ou discurso.
- Validar o contrato real da planilha de ranking.
- Revisar o comportamento de autenticação antes de expandir permissões.
- Monitorar o envio SMTP em produção após a correção de timeout.
