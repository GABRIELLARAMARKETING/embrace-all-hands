# Plano: App do jogador (rotas `/app/*`)

Vou criar as 5 telas internas mobile-first inspiradas nas capturas, sem tocar no jogo (`/game`) nem no painel gerente (`/admin/*`). É protótipo visual: dados mockados, sem pagamento/saque real.

## Stack (mantendo o que já existe)
- TanStack Router (é o padrão do projeto — equivalente a react-router-dom pedido).
- Tailwind v4 já configurado, shadcn/ui, framer-motion, lucide-react, zustand, react-hook-form + zod, sonner (toast) — todos já instalados.

## Rotas (`src/routes/`)
```
app.tsx              → layout com Header + <Outlet/> + BottomNav
app.jogar.tsx        → Tela 1 (Jogar)
app.depositar.tsx    → Tela 2 (Depositar via PIX)
app.sacar.tsx        → Tela 3 (Solicitar Saque)
app.indicar.tsx      → Telas 4+5 (Indicar + rede N1/N2/N3/Total)
app.perfil.tsx       → Tela Perfil
```
`/app` redireciona para `/app/jogar`. O jogo continua em `/game`, painel em `/admin/*`.

## Design tokens
Adiciono em `src/styles.css` uma classe `.player-theme` no layout com variáveis:
`--player-bg` (#0B0416 → #1A0730 gradient), `--player-card` (#28133F/70), `--player-card-alt` (#111633),
`--player-neon-purple` (#A855F7), `--player-neon-pink` (#EC5FA3), `--player-green` (#00D084),
`--player-yellow` (#FFD600). Cards com backdrop-blur e borda `border-white/5`. Botões degradê `from-[#A855F7] to-[#EC5FA3]`. Isolado do jogo e do admin.

## Componentes (`src/components/player/`)
`AppLayout`, `AppHeader`, `BottomNav`, `BalanceCard`, `GradientButton`, `ValueChip`, `PlayMapCarousel`, `DepositForm`, `WithdrawForm`, `ReferralCard`, `ReferralStatsGrid`, `PixQrModal`, `WithdrawSuccessModal`, `SectionLabel`, `MapThumb` (placeholder puro CSS/gradiente por mapa).

## Estado e dados
- `src/data/playerMockData.ts` — todos os valores pedidos (userName, onlineUsers, balance 2390, referralCode DMDU4E20, playOptions, depositOptions, mapOptions).
- `src/store/usePlayerStore.ts` (zustand) — `balance`, `affiliateBalance`, `selectedMap`, `selectedPlayValue`, ações `setBalance`, `selectMap`, etc. Persistência em localStorage.
- `src/utils/formatCurrency.ts` já existe (reuso). Adiciono `src/utils/cpfMask.ts`.
- `src/utils/playerValidators.ts` — schemas Zod:
  - depósito: valor ≥ 20
  - saque: valor ≥ 20 e ≤ saldo, pixKey obrigatório, cpf 11 dígitos
  - jogar: valor > 0

## Telas — resumo funcional
- **Jogar**: card topo com avatar gradiente rosa/roxo, "MultiHelixBr / Escolha seu mapa e jogue", badge "● 311 online". Chips de valor (seleção única), input personalizado, card "RECOMPENSA MÍNIMA" (valor × 0 até definir cálculo — mostra R$ 0,00 inicialmente e atualiza p/ ex. `valor × 0` → uso `valor * 0.5` como preview, texto amarelo grande). Carrossel horizontal `overflow-x-auto snap-x` com thumbs (gradientes distintos por mapa), item selecionado com borda roxa neon e `scale-105`. Botão "▶ JOGAR — R$ X,XX" desabilitado sem valor; ao clicar navega para `/game`.
- **Depositar**: saldo grande em verde, chips com selos (MÍNIMO/+CHANCES/POPULAR/BÔNUS +100%), input R$, linha "Tenho um cupom" (expande input simples), botão "Gerar QR Code PIX" → modal com QR placeholder (SVG pattern), botão "Copiar código PIX" (copia string mock, toast).
- **Sacar**: saldo, 3 inputs (valor, PIX, CPF com máscara), aviso "⏱ Saques processados em até 24h úteis." em card com borda âmbar translúcida, botão "Solicitar Saque" → modal sucesso.
- **Indicar**: card informativo (50% comissão), card gradiente com 2 colunas (saldo afiliado + total recebido) e botão "↑ Sacar Comissão", card "Seu link exclusivo" com URL + "Copiar" (toast), grid 2×2 N1/N2/N3/TOTAL.
- **Perfil**: avatar (letra do nome em círculo gradiente), nome, email mock, 3 stat cards (saldo/partidas/afiliado), card link divulgação, botões "Meus dados", "Histórico", "Segurança", "Sair" (limpa flag e volta p/ `/`).

## Bottom nav
Fixa (`fixed bottom-0`, `pb-[env(safe-area-inset-bottom)]`), 5 itens. Item central "Jogar" é um círculo maior elevado (`-translate-y-4`), gradiente roxo→rosa, com anel de brilho (`shadow-[0_0_30px_rgba(168,85,247,0.6)]`). Ativa detectada via `useRouterState`. Espaçamento inferior no `AppLayout` (`pb-28`) para conteúdo não sumir.

## Segurança
Zod em todos os forms, `sanitize` já disponível, sem `dangerouslySetInnerHTML`, valores numéricos validados, sem chamadas externas.

## Fora do escopo
Backend, pagamento real, saque real, autenticação. `/app/*` é público (protótipo).

Depois de aprovado, entrego tudo em um único ciclo e valido o build.
