# Painel Admin Helix — Plano

## 1. Stack detectada (não é a sugerida)

O projeto **não** usa Next.js/Prisma/NextAuth. Ele usa:

- **TanStack Start** (file-based routing em `src/routes/`), React 19, Vite 7
- **Tailwind v4 + shadcn/ui** (já configurados)
- **Lovable Cloud (Supabase)** — Postgres + Auth + RLS + Realtime
- **Server functions** via `createServerFn` (`@tanstack/react-start`), não API Routes
- **TanStack Query** para cache/mutations
- **Zustand** para estado de UI/mock (já existe `useAdminStore`)
- **Zod + React Hook Form**, Recharts disponível via shadcn

Vou **adaptar** o escopo a essa stack (mantendo o mesmo resultado funcional). Prisma/NextAuth não entram.

## 2. Estrutura atual relevante

- Rotas de painel já renomeadas para `/gerente/*` (painel, indicar, indicados, meus-saques, ajustes-indicados, criar-demo, notificações, login).
- Componentes admin em `src/components/admin/*` (AdminCard, AdminTable, StatCard, Badge, etc.) — reaproveitáveis.
- Área do jogador em `/app/*` com perfil, saque, indicação já conectados ao backend (`profiles`, `affiliate_withdrawals`, `game_sessions`).
- Tabelas Supabase existentes: `profiles`, `affiliate_withdrawals`, `game_sessions`, `live_matches`, `game_themes`, `user_theme_inventory`, `user_theme_preferences`.
- Sem tabela de roles ainda, sem audit log, sem alerts, sem transactions genéricas.

## 3. Gaps entre o pedido e o que existe

Faltam para virar "admin panel de verdade":

- **RBAC real**: `app_role` enum + `user_roles` + `has_role()` (padrão Lovable) — hoje o `/gerente/login` só grava flag em localStorage.
- **Novas tabelas**: `manager_profiles`, `affiliate_links`, `commissions`, `transactions`, `audit_logs`, `risk_alerts`, `platform_settings`, `login_logs`.
- **Server functions** (`src/lib/*.functions.ts`) para cada domínio, sempre com `requireSupabaseAuth` + checagem `has_role`.
- **Novas rotas** sob `/gerente/*` (dashboard já existe como `painel`, faltam: usuários, gerentes, afiliados, saques admin, comissões, financeiro, relatórios, audit-logs, alertas, configurações, perfil admin).
- **Gate de rota**: mover `/gerente/*` para `_authenticated/` + checagem de role no `beforeLoad`.

## 4. Escopo é grande demais para uma entrega — proposta de fases

Entregar tudo de uma vez vira código superficial. Sugiro fatiar assim (cada fase é 1 iteração completa: schema + policies + server fns + UI + testes manuais):

**Fase 1 — Fundação (sem UI nova)**
- Enum `app_role` (super_admin, admin, gerente, afiliado), tabela `user_roles`, função `has_role()`, RLS.
- Mover `/gerente/*` para `_authenticated/gerente/*` + gate por role.
- Substituir login mock por Supabase Auth.
- Tabela `audit_logs` + helper `logAudit()` para uso nas próximas fases.

**Fase 2 — Saques (admin)**
- Estender `affiliate_withdrawals` com status expandido, `reviewed_by`, `reviewed_at`, `rejection_reason`, `paid_at`, `ip`, `user_agent`, `notes`.
- Server fns: listar, aprovar, recusar, marcar pago — tudo em transação, com audit log.
- Tela `/gerente/saques` (fila + detalhe + modais de confirmação).

**Fase 3 — Gerentes & Afiliados**
- `manager_profiles`, vínculo afiliado→gerente em `profiles`.
- Telas de listagem, detalhe, ativar/bloquear/trocar gerente.

**Fase 4 — Comissões & Financeiro**
- `commissions`, `transactions`, view de saldo sacável.
- Telas de listagem + filtros + export CSV.

**Fase 5 — Dashboard, Alertas, Logs, Configurações, Relatórios**
- Gráficos Recharts, `risk_alerts`, `platform_settings`, viewer de `audit_logs`, export.

## 5. Riscos técnicos

- **Roles em `profiles` = falha de segurança conhecida** — precisa ser tabela separada (regra Lovable).
- Sem gate de rota atual, qualquer usuário logado acessaria `/gerente/*`.
- `affiliate_withdrawals` já tem policies — alterar schema exige revisar RLS e não quebrar `/app/sacar`.
- Migrations Supabase são aprovadas 1 a 1 pelo usuário; cada fase = 1 ou 2 migrations.
- Recharts + tabelas grandes exigem paginação server-side desde o começo (não fazer client-side).

## 6. Decisões que preciso de você antes de começar a Fase 1

1. **Confirma adaptar para a stack atual** (TanStack Start + Lovable Cloud) em vez de Next.js/Prisma?
2. **Quem é o primeiro super_admin?** Me diga o e-mail da conta que já existe no Auth (ou crio uma nova) — sem isso o painel trava você fora depois do gate.
3. **Começar pela Fase 1 (fundação + gate + auth real) e Fase 2 (saques admin)?** São as duas mais críticas — resto vem em seguida.
4. **Manter os componentes visuais atuais** (`AdminCard`, `AdminTable`, sidebar neon) ou refazer com shadcn puro?

Depois que você responder, eu executo Fase 1 já com a migration, o gate e a auth real, sem tocar no que já funciona em `/app/*`.
