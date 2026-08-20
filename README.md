# Playbook de Vendas — Grupo ABR

Aplicação web de consulta rápida para a equipe comercial do Grupo ABR. Reúne scripts de prospecção, objeções por perfil, reativação, pós-venda, gestão de crise, qualificação no Kommo e ranking de vendas.

## Executar localmente

Requer Node.js 20 ou superior. Não há dependências externas.

```bash
npm run dev
```

Acesse `http://localhost:3000`.

Validações:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

## Ranking

Defina `SALES_DATA_MODE`:

- `mock`: usa `data/ranking.json` e funciona imediatamente.
- `manual`: permite gravar um payload completo por `POST /api/ranking/manual`, usando `Authorization: Bearer <ADMIN_TOKEN>`.
- `api`: consulta `SALES_DATA_URL` no servidor. Se necessário, envia `ASTER_AUTH_TOKEN` como Bearer.

Contrato esperado:

```json
{
  "updatedAt": "2026-08-20T15:00:00.000Z",
  "period": "Agosto/2026",
  "regions": [{ "id": "sul", "name": "Sul", "position": 1, "salesAmount": 100000, "orders": 20, "trend": 5 }],
  "sellers": [{ "id": "v1", "name": "Consultor", "region": "Sul", "position": 1, "salesAmount": 50000, "orders": 10, "trend": 3 }]
}
```

O modo manual grava no sistema de arquivos. No Render, esse armazenamento é efêmero; para produção, use Postgres, Key Value ou uma fonte externa persistente.

## Integrações

Copie `.env.example` para `.env` apenas no ambiente local e configure as variáveis. O projeto não carrega `.env` automaticamente porque não possui dependências; forneça-as pelo terminal ou pela plataforma. No Render, cadastre os segredos em **Environment**.

Tokens do Aster e Kommo permanecem exclusivamente no servidor. A integração do Kommo está preparada por configuração, mas propositalmente não executa escritas até que o contrato real seja definido.

## Deploy no Render

1. Envie o projeto para um repositório Git.
2. No Render, crie um Blueprint usando `render.yaml`.
3. Preencha as variáveis marcadas como `sync: false`.
4. Inicie em `SALES_DATA_MODE=mock`.
5. Confirme `/api/health` e depois conecte a fonte real do ranking.

O build copia o frontend e o logotipo `expertaço.png` para `dist/`. O servidor escuta a porta definida por `PORT` e hospeda o SPA e a API no mesmo serviço.

## Atualizar conteúdo

Os cards ficam no array `cards` de `public/app.js`. Cada item possui identificador, seção, público, título, tags e HTML. O conteúdo atual foi derivado do documento `Playbook_Vendas_GrupoABR.docx`; as cores e diretrizes seguem `Manual_Identidade_Visual_Grupo_ABR.pptx`.

## Checklist de produção

- Revisar textos, produtos ativos e condições com a liderança comercial.
- Confirmar links oficiais de redes sociais.
- Definir a origem real do ranking e validar seu JSON.
- Definir autenticação corporativa antes de habilitar administração.
- Adicionar persistência permanente se o modo manual for necessário.
- Configurar tokens somente como segredos do Render.
- Validar as regras e campos reais do pipeline do Kommo.
