# Plano: Painel "Gerente Helix"

Vou construir um painel administrativo completo, dark, com verde neon, integrado ao projeto atual (TanStack Start + Tailwind v4), sem afetar o jogo existente na rota `/`.

## Stack e adaptações
- **Router**: TanStack Router (já no projeto) em vez de React Router — mesma capacidade, é o padrão da stack.
- **Estado**: Zustand (já usado no jogo).
- **Forms**: React Hook Form + Zod.
- **Ícones**: lucide-react. **Animações**: framer-motion. Ambos já instalados.
- **Persistência**: localStorage via camada de `services/` preparada para backend real.

## Rotas (arquivos em `src/routes/`)
```
/login                        → login.tsx
/admin                        → admin.tsx (layout com Sidebar + TopHeader + <Outlet/>)
/admin/painel                 → admin.painel.tsx
/admin/criar-demo             → admin.criar-demo.tsx
/admin/indicar                → admin.indicar.tsx
/admin/indicados              → admin.indicados.tsx
/admin/meus-saques            → admin.meus-saques.tsx
/admin/ajustes-indicados      → admin.ajustes-indicados.tsx
/admin/notificacoes           → admin.notificacoes.tsx
```
O jogo continua em `/`. Nenhuma rota do jogo é alterada.

## Design tokens
Adiciono em `src/styles.css` uma classe raiz `.admin-theme` com as cores solicitadas (#07080C, #111217, #161720, #1B1C26, #272936, #22C55E, #00E676, #3B82F6, etc.) mapeadas para variáveis (`--admin-bg`, `--admin-sidebar`, `--admin-card`, `--admin-neon`, …) e utilitários Tailwind arbitrários. Assim o jogo mantém seu próprio tema.

## Componentes (`src/components/admin/`)
`Sidebar`, `TopHeader`, `AdminLayout`, `StatCard`, `SectionTitle`, `AdminCard`, `AdminButton`, `AdminInput`, `AdminTable`, `EmptyState`, `ToggleSwitch`, `FloatingChatButton`, `CopyButton`, `Badge`, `MoneyValue`.

## Store e services
- `src/store/useAdminStore.ts` — métricas, indicados, comissões, saques, contas demo, notificações, modo influencer. Persistência em localStorage.
- `src/services/adminApi.ts` (+ `demoAccountsService`, `referralService`, `withdrawalService`, `notificationService`) com todas as funções listadas, async com delay curto, prontas para trocar por `fetch`.
- `src/data/mockAdminData.ts` — estado inicial exatamente como pedido (métricas zeradas, `totalReferrals: 1`, link `?ref=YCWM29`, etc.).
- `src/utils/`: `formatCurrency`, `formatDate`, `sanitize`, `validators`, `clipboard`.

## Páginas — funcionalidades
- **Painel**: 6 `StatCard`s no grid solicitado.
- **Criar Demo**: form validado (Zod: qtd 1–100, saldo ≥ 0), gera `demo 1..N`, senha `nome@N`, toast de sucesso.
- **Indicar**: link + botão Copiar (com feedback "Copiado!"), 2 mini-cards, toggle Influencer persistido.
- **Indicados**: 4 cards de comissão + 3 blocos (N1/N2/N3) cada com busca, badge, tabela e empty state, botão Atualizar.
- **Meus Saques**: 2 cards (saldo + form PIX), validação (valor > 0 e ≤ saldo), histórico em tabela.
- **Ajustes Indicados**: banner orçamento 70%, 3 cards N1/N2/N3, cálculo "Usando: X%" em tempo real, bloqueio > 70%, botões Salvar/Restaurar.
- **Notificações**: card informativo azul, webhook (Salvar/Testar/Remover) com validação de URL, 3 toggles de eventos (ligados por padrão).
- **Login**: tela simples preparada para autenticação (sem backend agora; salva flag em localStorage).

## Layout
- Sidebar fixa 280px desktop, colapsável no mobile via botão hambúrguer no `TopHeader`.
- Logo "Gerente" (branco) + "Helix" (verde) no topo.
- Item ativo: fundo verde translúcido + barra vertical verde à esquerda.
- Item "Sair" fixado no rodapé da sidebar.
- `TopHeader` com título/subtítulo, linha inferior, indicador online verde.
- `FloatingChatButton` azul, canto inferior direito, presente em todas as rotas `/admin/*`.
- Responsivo: cards 3→2→1 col, tabelas com `overflow-x-auto`.

## Segurança
- Sanitização (`sanitize.ts` — strip de `<`, `>`, controle de tamanho), validação Zod em todos os forms, sem `dangerouslySetInnerHTML`, sem `eval`, valores monetários validados, sem log de webhook, camada de service isolada da UI.

## Fora de escopo desta entrega
- Autenticação real / backend (a estrutura fica pronta, `adminApi` centraliza chamadas).
- Integração com o jogo (o painel é independente).

Depois de aprovado, implemento tudo em um único ciclo e valido o build.