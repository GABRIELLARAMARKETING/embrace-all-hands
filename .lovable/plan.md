# Painel Gerente Helix — Backend Real e Integração

Este é um escopo grande (12 telas + regras multinível + comissões + saques + auditoria). Vou entregar em **fases sequenciais**, cada uma testável, sem quebrar o que já existe.

## Contexto atual (o que já está no projeto)

- **Stack**: TanStack Start (React 19 + Vite 7) + Lovable Cloud (Supabase). Sem Next.js, sem backend Express separado — backend = `createServerFn` + Supabase.
- **Painel Gerente já existe visualmente** em `src/routes/gerente.*.tsx` (painel, indicar, meus-saques, indicados, ajustes-indicados, criar-demo, gerentes, saques, notificacoes) com store Zustand mockada (`useAdminStore`).
- **Auth/RBAC**: já existe `user_roles` (enum `app_role`), função `has_role`, e a rota `/gerente` já bloqueia por `admin`/`super_admin`. **Precisa acrescentar role `manager`** ou reusar `admin` — decisão abaixo.
- **Tabelas existentes relevantes**: `profiles` (com `manager_id`, `affiliate_balance`, `total_received`), `commissions`, `affiliate_withdrawals`, `transactions`, `audit_logs`, `platform_settings`.
- **Já implementado no lado Admin**: dashboard, gerentes, afiliados, saques, finance, commissions, risk-alerts, audit-logs, settings, reports + realtime.

## Decisões que preciso confirmar antes de codar

Como o escopo é enorme, preciso alinhar 4 pontos que mudam o desenho:

1. **Role do gerente**: hoje `/gerente` exige role `admin`. Prompt pede role `MANAGER` separada. Crio nova role `manager` no enum `app_role` e mudo o gate de `/gerente` para aceitar `manager` (admins continuam entrando)?
2. **Subgerentes**: o schema atual não tem hierarquia entre gerentes. Deixo a tela `/gerente/gerentes` como "preparado, retorna vazio" (como o próprio prompt permite no item 10)?
3. **Contas demo**: criar `auth.users` reais via Admin API é caro em quota e polui a base. Ok gravar as demos só em `profiles` com `is_demo=true` sem `auth.users` (login demo fica desabilitado nesta fase)?
4. **Cadastro via `?ref=CODIGO`**: hoje `/auth` existe mas não lê `ref`. Ok eu adicionar leitura do `?ref` no signup e vincular `referred_by_id`/`manager_id` automaticamente?

Assumindo **sim para todas**, o plano abaixo é o que executo.

## Plano de execução (fases)

### Fase 1 — Schema + helpers (1 migration)

Adiciona ao banco:

- Enum `app_role`: acrescentar valor `manager`.
- `profiles`: colunas `affiliate_code text unique`, `referred_by_id uuid`, `is_demo bool default false`, `is_influencer bool default false`.
- `manager_profiles`: `user_id`, `total_budget_percent`, `level1_percent`, `level2_percent`, `level3_percent` (defaults 50/5/1, budget 70).
- `referrals`: `referrer_id`, `referred_id`, `manager_id`, `level (1..3)`, `source_code`.
- `referral_logs`: `referrer_id`, `referred_id`, `source_code`, `ip`, `user_agent`.
- `deposits` (nova, separada de `transactions` que hoje é genérica): status enum + `confirmed_at`.
- `demo_account_batches` + `demo_accounts`.
- Função `generate_affiliate_code()` (6 chars, checa colisão) e trigger em `profiles` para preencher `affiliate_code` no insert.
- Trigger `handle_new_user` estendido: lê `raw_user_meta_data->>'ref'`, resolve dono do código, monta cadeia de 3 níveis em `referrals`, define `referred_by_id` e `manager_id`, grava `referral_logs`.
- Função `process_deposit_commissions(deposit_id uuid)` (SECURITY DEFINER, idempotente por `deposit_id`): calcula N1/N2/N3 + resto para o gerente com base em `manager_profiles`, grava em `commissions` + `transactions`.
- RLS + GRANTs para todas as novas tabelas (managers leem só a própria rede via `has_role` + `manager_id = auth.uid()`).

### Fase 2 — Server functions (`src/lib/manager.functions.ts`)

Middleware `requireManager` (aceita `manager`, `admin`, `super_admin`). Funções:

- `getManagerDashboardSummary` — depósitos/saques pendentes, recebido/sacado 24h, total indicados por nível.
- `getManagerReferralLink` — retorna `affiliate_code`, link `${APP_PUBLIC_URL}/?ref=CODE`, contadores.
- `listManagerReferrals(level)` — nível 1/2/3 com totais depositados/comissão gerada.
- `listNetworkWithdrawals(status, search)` — saques dos usuários da rede.
- `getMyCommissionSummary` + `listMyWithdrawals` + `requestMyWithdrawal({pixKey, amount})`.
- `getCommissionSettings` + `updateCommissionSettings({n1,n2,n3})` + `resetCommissionSettings`.
- `createDemoAccounts({namePattern, passwordPattern, quantity, initialBalance})` + `listDemoAccounts`.
- `listSubmanagers` — retorna vazio (preparado, conforme item 10).

Todas com auditoria em `audit_logs` para ações críticas.

### Fase 3 — Frontend: trocar mocks pelo real

Cada tela `/gerente/*` passa a usar TanStack Query chamando as server functions:

- `gerente.painel.tsx` — cards reais + skeleton + botão atualizar.
- `gerente.indicar.tsx` — link real do usuário + contadores + toggle influencer persistente.
- `gerente.indicados.tsx` — 3 níveis reais + busca.
- `gerente.meus-saques.tsx` — saldo real + histórico + solicitação persistida.
- `gerente.ajustes-indicados.tsx` — carrega/salva percentuais reais com validação de orçamento.
- `gerente.criar-demo.tsx` — cria lote real, mostra credenciais uma vez, lista batches.
- `gerente.saques.tsx` — saques da rede com filtros funcionais + realtime.
- `gerente.gerentes.tsx` — empty state real "sem subgerentes".

Manter layout, componentes visuais (`AdminCard`, `StatCard`, `AdminTable`) e navegação.

### Fase 4 — Fluxo `?ref=CODE` no signup

- `/auth` lê `?ref` da URL e passa em `options.data.ref` no `signUp`; a trigger `handle_new_user` já criada na Fase 1 faz o vínculo.
- Adicionar `APP_PUBLIC_URL` como `PlatformSetting` (default `https://helixfast.lovable.app`) — usado pelo backend para montar o link.

### Fase 5 — Processamento de comissão

- Nesta fase **não há gateway PIX** (prompt proíbe). Deixo função `process_deposit_commissions` pronta + um endpoint admin `POST /api/public/internal/deposits/:id/process-commissions` protegido por secret (`INTERNAL_WEBHOOK_SECRET` via `add_secret`) para uso futuro do gateway.
- Botão manual em `/admin/finance` "aprovar depósito" chama a mesma função (útil para testes).

### Fase 6 — Seed

Prompt pede seed grande (1 super admin, 3 gerentes, 150 usuários, depósitos, saques, comissões). Faço **seed enxuto** via migration: cria 1 `manager_profiles` default para cada `admin` existente + PlatformSettings default. **Não crio auth.users** em seed (perigoso em produção; usuários criam via `/auth`).

## Detalhes técnicos

- **Grants**: cada tabela nova tem `GRANT SELECT ON ... TO authenticated` + policies escopadas por `has_role` + `manager_id = auth.uid()`.
- **Idempotência**: `commissions` ganha unique `(deposit_id, level)` para bloquear duplicação.
- **PIX**: sempre retornado mascarado (`***1234`) em qualquer listagem.
- **Realtime**: reusa `useAdminRealtime` já existente para `affiliate_withdrawals` no `/gerente/saques`.
- **Sem gateway PIX real**, sem alterar jogo, sem expor `password_hash` (não existe — Supabase gerencia).

## Arquivos que vão mudar

Criados: 1 migration Fase 1, `src/lib/manager.functions.ts`, `src/hooks/useManagerQueries.ts`.
Editados: 8 rotas `/gerente/*`, `/auth` (leitura de `?ref`), `useAdminStore` (remoção dos mocks migrados).

## Fora do escopo desta entrega

- Gateway PIX real (proibido no prompt).
- Rate limit em login (Supabase já faz).
- Envio de e-mail transacional.
- Subgerentes reais (modelo preparado, UI vazia — permitido pelo prompt).

---

**Posso prosseguir com essas 4 decisões (nova role `manager`, subgerentes preparados-mas-vazios, demos sem `auth.users`, `?ref` no signup)?** Se sim, começo pela Fase 1 (migration) — que precisa da sua aprovação separada por ser mudança de schema.
