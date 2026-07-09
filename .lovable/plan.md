# Sistema Multinível — Diagnóstico e Plano

## O que já existe e está funcionando

Ao analisar o projeto, quase toda a estrutura pedida **já está implementada**:

**Banco de dados (Lovable Cloud):**
- `profiles`: tem `affiliate_code`, `referred_by_id`, `manager_id`, `status` (active/inactive/blocked), `balance`, `affiliate_balance`
- `referrals`: rastreia indicações nos níveis 1, 2 e 3
- `commissions`: tem `level`, `status` (pending/available/paid/cancelled), `deposit_id`, `manager_id`
- `manager_profiles`: percentuais configuráveis por nível (`level1_percent`, `level2_percent`, `level3_percent`, `total_budget_percent`)
- `affiliate_withdrawals`: saques com status pending/approved/paid/rejected
- `user_roles` + função `has_role` / `is_admin` (papéis: super_admin, admin, gerente, afiliado, jogador)
- `risk_alerts` com status `open/closed`
- `audit_logs`

**Regras automáticas (triggers/funções):**
- `handle_new_user`: já captura `?ref=CODIGO` do `raw_user_meta_data`, resolve o dono, salva `referred_by_id` e propaga `manager_id`, e cria as linhas em `referrals` (níveis 1, 2, 3). Impede auto-indicação.
- `process_deposit_commissions`: gera comissões multinível automaticamente quando um depósito é aprovado, respeitando os percentuais do gerente.
- `credit_deposit_atomic`: credita depósito + dispara comissões de forma atômica.
- `ensure_affiliate_code`: gera código único no cadastro.
- `protect_profile_financials` / `protect_manager_budget`: impedem alteração indevida de campos sensíveis.

**Backend / Frontend admin já funcionais:**
- `getAdminDashboardSummary` — retorna todos os 8 cards pedidos (total users, gerentes ativos, afiliados ativos, saques pendentes, pago no mês, alertas abertos, contas bloqueadas, comissões pendentes) direto do banco.
- Página `/admin/dashboard` já renderiza os cards com valores reais, `formatCurrency` em BRL, realtime nos depósitos, botão atualizar.
- `listAllAffiliates`, `updateAffiliate` (bloquear/reatribuir gerente), auditoria automática.
- `/admin/affiliates`, `/admin/managers`, `/admin/commissions`, `/admin/withdrawals`, `/admin/risk-alerts`, `/admin/audit-logs`, `/admin/finance`, `/admin/reports` já existem.

## O que realmente falta

1. **Página "Rede de Indicações"** no admin (visão em árvore por usuário: diretos + totais de comissão gerada/pendente/paga).
2. **Endpoint `getReferralNetwork(userId)`** — retorna dono + indicados diretos + agregados de comissão e saques.
3. **Escopo por papel**: hoje só admin acessa. Adicionar visões limitadas para:
   - Gerente: apenas própria rede (já existe `/gerente/*` — reutilizar).
   - Afiliado: apenas próprios indicados (já existe `/app/indicar` — validar).
4. **Captura do `?ref=` no cadastro público**: verificar se `/auth` está lendo o query param e enviando em `options.data.ref` no `supabase.auth.signUp`. Se não, corrigir (o trigger do banco já espera isso).

## O que **não** vou fazer (e por quê)

- **Não** vou criar tabelas novas (`referral_relations`, `commission_settings`, `alerts`, `withdrawals` genérica): já existem equivalentes (`referrals`, `manager_profiles`, `risk_alerts`, `affiliate_withdrawals`). Criar duplicatas quebraria triggers e o fluxo de comissão que já funciona.
- **Não** vou migrar para IDs `BIGINT AUTO_INCREMENT`: o projeto usa UUID em toda a base (Supabase padrão). Trocar quebraria RLS, foreign keys e o app inteiro.
- **Não** vou criar endpoints REST `/api/admin/*`: o stack é TanStack Start com `createServerFn` (RPC tipado). Já é o padrão do projeto e mais seguro.
- **Não** vou trocar `formatCurrency` — já existe em `src/utils/formatCurrency.ts` no padrão BRL.

## Entregas propostas

**Backend (`src/lib/admin.functions.ts`):**
- `getReferralNetwork({ userId })` — retorna:
  ```ts
  {
    user: { id, display_name, role, status, affiliate_code },
    directReferrals: Array<{ id, name, email, status, created_at, level }>,
    totalReferrals: number,       // níveis 1+2+3
    pendingCommissions: number,   // R$
    paidCommissions: number,      // R$
    totalWithdrawals: number      // R$ pagos
  }
  ```

**Frontend admin (nova rota `/admin/network`):**
- Busca por nome/código, lista gerentes → afiliados → indicados.
- Card com totais por pessoa (indicados, comissão gerada/pendente/paga).
- Botão "Ver rede" (drill-down) e "Bloquear/Desbloquear" (já existe `updateAffiliate`).
- Adicionar item "Rede de Indicações" no `Sidebar` admin.

**Cadastro (`src/routes/auth.tsx`):**
- Ler `?ref=` da URL, persistir em `sessionStorage`, enviar em `signUp({ options: { data: { ref } } })`. O trigger `handle_new_user` cuida do resto.

**Critérios de aceite atendidos:**
Cards do dashboard (1–11), rede de indicações visível (12), gerente/afiliado escopados (13–15), zero mocks (16–18), funciona em produção (19–20).

## Fora do escopo desta tarefa (se quiser, aviso e faço em seguida)

- Página global "Configurações de Comissão" (hoje é **por gerente** em `manager_profiles`; centralizar exige repensar o modelo de negócio — não é bug, é decisão de produto).
- Refactor de logs para uma tabela `alerts` separada de `risk_alerts`.

Confirma que sigo com essas 3 entregas (endpoint + página Rede + captura do `?ref=`)?
