## Goal

Ajustar a jogabilidade e o visual de HUD do Helix Cash para ficar fiel ao vídeo de referência, sem quebrar temas, skins, sons, menus, modais, pontuação e moedas fictícias já existentes. Nada de dinheiro real: os campos com "R$" no vídeo viram pontuação/moedas virtuais no jogo (rótulos com o símbolo `✦` já usado).

## O que o vídeo mostra (referência de gameplay)

- Torre helicoidal alta e estreita, plataformas com aparência contínua em espiral e setores perigosos escuros bem visíveis.
- Bola sempre no terço superior da tela, cai com gravidade forte e quica curto (~metade do espaçamento entre andares).
- Câmera zoom médio, desce suave junto com a bola, sem trancos.
- Rotação por arrasto direto — resposta imediata, com uma pitada de suavização, sem inércia longa.
- Fundo com nuvens grandes e desfocadas, tema muito colorido/saturado.
- HUD topo com três células: valor à esquerda, score central + barra de progresso + meta à direita.
- Modal de vitória card escuro com valor destacado.

## Mudanças

### 1. `src/game/config/constants.ts` — tuning físico e de câmera
- `PLATFORM_SPACING`: 1.4 → 1.25 (torre mais densa como no vídeo).
- `TOWER_RADIUS`: 1.6 → 2.1; `CORE_RADIUS`: 0.6 → 0.65; `PLATFORM_HEIGHT`: 0.35 → 0.22.
- `BALL_RADIUS`: 0.28 → 0.32.
- `GRAVITY`: −18 → −22; `BOUNCE_VELOCITY`: 5.2 → 5.6 (pico ≈ 0.71 < spacing 1.25).
- `MAX_FALL_SPEED`: −14 → −13.
- `ROTATION_SENSITIVITY`: 0.006 → 0.009 (desktop); adicionar `TOUCH_ROTATION_SENSITIVITY` = 0.011.
- `ROTATION_SMOOTHING`: 0.25 → 0.35 (mais snap).
- `CAMERA_HEIGHT_OFFSET`: 2.5 → 3.2; `CAMERA_DISTANCE`: 5.5 → 6.5; adicionar `CAMERA_LOOK_AT_OFFSET` = −1.0; `CAMERA_LERP`: 0.08 (mantém).
- `PHYSICS_MAX_STEP` e `COLLISION_COOLDOWN` mantidos.

### 2. `src/game/engine/useTowerControls.ts`
- Detectar `PointerEvent.pointerType === "touch"` e usar `TOUCH_ROTATION_SENSITIVITY` no delta do arrasto.
- Ligar o listener ao elemento canvas (via prop) em vez de `window`, para poder aplicar `touch-action: none`. Alternativa: continuar em window mas cancelar `passive` false onde precisar. Manter comportamento atual de teclado.

### 3. `src/components/GameCanvas.tsx`
- Aplicar `style={{ touchAction: "none", userSelect: "none" }}` no wrapper `div` e no `<Canvas>`.
- Câmera inicial usar novos `CAMERA_DISTANCE`/altura; `lookAt(0, ball.y + CAMERA_LOOK_AT_OFFSET, 0)`.
- Nada muda na CCD/substeps/cooldown já corretos, apenas usar as novas constantes.

### 4. `src/game/engine/levelGenerator.ts`
- Reduzir `gapSize` default proporcional a 0.42π (aprox. 2 setores em 8) — hoje já usa 2 setores; garantir mínimo 2 e mudar `DANGER_ZONE_SIZE` = ~1 setor (mantém 8 setores).
- Recomputar `totalHeight` com o novo `PLATFORM_SPACING`.

### 5. `src/game/entities/PlatformRing.tsx` / `TowerCore.tsx` / `Ball.tsx`
- Ajustar geometria para os novos raios/espessura (só valores, sem reescrita).
- Manter materiais/temas.

### 6. `src/components/GameHUD.tsx` — layout topo estilo referência
- Barra superior com três blocos:
  - Esquerda: rótulo pequeno "SALDO" + valor `✦ {totalCoins}`.
  - Centro: rótulo "SCORE" grande + barra de progresso fina embaixo + "META" à direita da barra.
  - Direita: rótulo "COMBO/NÍVEL" + botão pausa.
- Botão de som flutuante já existente permanece.
- Combo continua discreto (chip abaixo do topo). Manter cores dos temas.
- Deixar explícito no aviso do menu principal: "Moedas virtuais — sem dinheiro real" (texto já existe).

### 7. `src/components/VictoryModal.tsx`
- Reestilizar card escuro, título "PARABÉNS!", número grande com `✦ + {coinsGanhas}` (não `R$`). Botão primário grande "Próximo nível" (mantém funcionalidade atual).

### 8. `src/routes/__root.tsx` + `src/styles.css`
- Garantir `html, body, #root { height: 100%; margin: 0; overflow: hidden; touch-action: none; overscroll-behavior: none; }` para evitar scroll no mobile.

### 9. Combo/queda longa
- `passedSincelastBounce` já existe; ajustar `CASH_FEVER_THRESHOLD` = 4 e mostrar chip "COMBO xN" já implementado. Sem novos sistemas.

### 10. Debug
- Renomear/expor `DEBUG_PHYSICS` como `DEBUG_GAMEPLAY` (alias) e continuar usando o overlay atual, agora incluindo `combo` além dos campos existentes.

## Arquivos alterados

- `src/game/config/constants.ts` (tuning)
- `src/game/engine/useTowerControls.ts` (touch sensitivity)
- `src/components/GameCanvas.tsx` (câmera, touch-action, novas constantes)
- `src/game/entities/PlatformRing.tsx`, `TowerCore.tsx`, `Ball.tsx` (geometria)
- `src/game/engine/levelGenerator.ts` (spacing/gap)
- `src/components/GameHUD.tsx` (layout topo)
- `src/components/VictoryModal.tsx` (card fiel ao vídeo, texto/valor)
- `src/routes/__root.tsx` / `src/styles.css` (touch-action global)
- `src/components/PhysicsDebugOverlay.tsx` + `src/game/engine/physicsDebug.ts` (adicionar combo)

## Como validar (comparando com o vídeo)

1. Arrastar horizontalmente — torre gira com resposta imediata; touch no mobile sem scroll.
2. Bola cai por gravidade forte, quica curto sem subir mais de meio andar, nunca atravessa sólido nem volta bugada.
3. Em queda longa por gaps, chip "COMBO x2/x3/x4" aparece e Cash Fever quebra 1 danger.
4. Câmera segue suave; bola permanece no terço superior da viewport.
5. HUD topo idêntico em estrutura (esq/centro/dir + barra), rótulos com `✦` (nunca `R$`).
6. Modal de vitória fiel ao vídeo (card escuro, número grande, botão primário) usando moedas virtuais.
7. Trocar temas continua alterando só o visual; skins, sons, pontuação e persistência intactos.

## Notas técnicas

- Mantido CCD com `prevBottom/nextBottom` e cooldown por anel — nenhuma regressão na anti-tunneling.
- Nenhum sistema de dinheiro real. Rótulos "R$" do vídeo são substituídos pelo símbolo `✦` para deixar explícito que é pontuação virtual.
- Sem novas dependências.
