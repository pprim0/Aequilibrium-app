# Momentum Web — Fase 0: análise e decisão de stack

Data: 28/10/2026 · Fontes: este repositório e `registo_gastos_v2(4)(1).xlsx` (a versão mais recente, com 7 movimentos).

## 1. O que existe

### App Momentum (Expo / React Native)

| Área | Estado | Notas |
|---|---|---|
| Supabase | Em uso | **O esquema não está no repositório**: não há `supabase/migrations`. As tabelas usadas pelo código são `profiles`, `user_preferences`, `habits`, `habit_schedule_days`, `habit_logs`, `habit_categories`, `finance_categories`, `transactions`, `budgets` e `financial_goals`. |
| Hábitos | Funciona | `habitService.js`: frequência diária, dias úteis, fim de semana ou 3×/semana; registo em `habit_logs` (único por hábito e dia); streak calculada no cliente. |
| Finanças | Básico | `financeService.js`: só conhece `income`/`expense` e mês civil. Não tem contas, transferências, dívidas nem mês financeiro. |
| Onboarding | Frágil | Nomes, emojis e percentagens estão escritos no código (`'Alimentação'`, `monthlyBudget * 0.3`). Viola a regra "nada hardcoded". |
| Apagar conta | Existe, sem deploy | A Edge Function `delete-account` faz a validação do utilizador corretamente e usa a service key só no servidor. |
| Tema | Simples | `src/theme`: cores, espaçamentos, raios e sombras. Fonte Plus Jakarta Sans. |
| Legado | Por remover | `src/store/*` (SQLite), biometria e AsyncStorage. |

### Excel (`registo_gastos_v2`)

É uma especificação funcional completa. Calcula tudo a partir da folha **Movimentos** e da **Configuração**, com fórmulas centralizadas na folha oculta `_Calc`. Dados reais atuais:

- **Movimentos**: 7 linhas, todas de 28/10/2026, ou seja, do mês financeiro **Nov 26**. São: extra de 300 €; cartão 150 € de capital + 3,64 € de juros (divididos, n.º 1); Klarna 40,97 €; fundo 50 €; barbeiro 20 €; supermercado 11,80 €.
- **Diário**: vazio. Por isso não há XP, streak nem conquistas de revisão.
- **Novidades face ao enunciado**: categoria **Barbeiro** (grupo Outras cenas, variável) e método de pagamento **Apple Pay**. Entram no preset "Primo".

## 2. Decisão de stack: **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase + Recharts, como PWA**

Porque não Expo para web:

1. **Pouco código de ecrã se aproveita.** Os ecrãs têm entre 15 e 27 KB cada e estão escritos sobre um modelo financeiro que vai mudar por completo (contas, dívidas, mês financeiro). Teriam de ser reescritos em qualquer dos casos.
2. **No desktop, react-native-web fica pior**: sidebar, tabelas com filtros, gráficos, teclado e foco acessíveis. Isto é exatamente o que Movimentos, Orçamento e Insights precisam.
3. **PWA e Web Push** (service worker, manifest, VAPID) são de primeira classe em Next.js. Em Expo web exigem configuração à parte.
4. **O que realmente vale a pena aproveitar é JS puro**: os serviços Supabase, a lógica de hábitos e streaks e os tokens do tema. Isso passa para TypeScript sem dependências de React Native.

**Aproveita-se:** o projeto Supabase e as tabelas `profiles`, `habits`, `habit_schedule_days` e `habit_logs` (mantêm o nome; não se renomeia para `habit_completions`). Também a lógica de `habitService` (passa para `lib/domain`), a Edge Function `delete-account` (estendida às tabelas novas), os tokens de `src/theme` (passam a CSS variables, com modo escuro) e a Plus Jakarta Sans.

**Descarta-se:** `src/store/*` (SQLite), React Navigation, AsyncStorage, SecureStore, expo-local-authentication, as notificações locais Expo e o onboarding com valores fixos. As tabelas `finance_categories`, `transactions` (no formato atual), `budgets` e `financial_goals` são substituídas pelo modelo novo, com uma migração de dados (ver §4).

**Organização proposta:** `web/` para a app Next.js, `supabase/migrations/` e `supabase/tests/` para SQL e pgTAP, e `supabase/functions/` para as Edge Functions. A app Expo fica intacta até à fase 6 e só aí é arquivada.

## 3. Mapa Excel → modelo de dados

| Excel | Tabela / mecanismo |
|---|---|
| Configuração › Parâmetros (dia 25, início, alertas 0,7/0,9/1, conta principal) | `user_settings` |
| Configuração › Contas (Conta à ordem, Dinheiro, Poupança, Investimentos) | `accounts` (`checking`, `cash`, `savings`, `investment`) |
| Objetivos › Dívidas (Cartão, Mãe, Freire, Klarna; Gestão = Plano/Prestações; "Compras feitas com") | `accounts` do tipo `credit` com `debt_strategy` (`plan`/`installments`); `payment_methods.account_id` substitui "Compras feitas com" |
| Configuração › Categorias (tipo, grupo, natureza, limite próprio) | `categories` + `category_groups` |
| Configuração › Orçamento por grupo (Fixas 500, Outras cenas 150, Dinheiro livre 250) | `category_groups.monthly_budget` |
| Configuração › Atalhos (19) | `shortcuts` |
| Configuração › Métodos (8, com Apple Pay) | `payment_methods` |
| Configuração › Plano do mês | `monthly_plans` |
| Configuração › Regra 50/20/20/10 | `allocation_rules` |
| Configuração › Ordenado, subsídio, multiplicador | `income_sources` (valores com período, editáveis) + `goals.target_formula` (ver D2) |
| Configuração › Níveis e valores de XP | `levels`, `xp_rules` |
| Movimentos A–J | `transactions`; "Compra dividida (n.º)" → `split_id`; as colunas K–Y passam a ser calculadas em views |
| Pagamentos fixos › Repetem-se | `recurring_payments`; a ligação passa a ser por `recurring_id`, e não por descrição igual como no Excel |
| Pagamentos fixos › Prestações | `installments` |
| Objetivos › Poupança e marcos | `goals`; os marcos são calculados por view, com a data guardada em `achievement_unlocks` |
| Objetivos › Investimentos › Valor atual | `investment_valuations` |
| Diário | `daily_checkins` |
| Conquistas | `achievements`, `achievement_unlocks`, `missions`, `xp_ledger` |
| `_Calc` (mês financeiro, totais por mês, streak, semanas) | Funções e views SQL: `fin_month_key(date)`, `v_month_totals`, `v_account_balances`, `v_free_to_spend`, `v_recurring_status`, `v_installment_status`, `v_streak`, `v_week_missions` |

Regras confirmadas nas fórmulas e que vão ser reproduzidas tal como estão:

- **Mês financeiro**: um dia ≥ 25 pertence ao mês seguinte; as semanas começam à segunda-feira.
- **Saldo de conta**: saldo inicial + movimentos com data ≥ data do saldo inicial (inclui os desse dia).
- **Livre para gastar**: rendimentos − (despesas − despesas a crédito) − dívidas − poupança − investimento − fixos e prestações por pagar − reservado. **Reservado** = máx(0, plano de dívidas − pago em dívidas com estratégia `plan`) + máx(0, plano do fundo − poupança). Verifiquei o cenário de teste do enunciado à mão e dá **205,60 €**, desde que o Cartão também esteja como `plan`, tal como no Excel.
- **Prestação paga**: total pago à dívida ≥ soma das prestações até essa data. "Por pagar este mês" só se a data for ≤ ao fim do mês financeiro.
- **Fixos de N em N meses**: (meses desde `anchor_month`) mod N ≠ 0 → "Não é este mês".
- **Streak**: um dia sem revisão não quebra a streak se houver no máximo 1 dia de descanso numa janela de 7 dias. O descanso mantém a contagem mas não a aumenta. O dia de hoje ainda não conta como falha.
- **Mês acompanhado**: mês terminado com ≥ 15 dias revistos. **Missão do dinheiro livre**: semana terminada, ≥ 5 dias revistos e gasto em "Dinheiro livre" ≤ orçamento × 7/30,4.
- **Meta do fundo**: ARRED.PARA.CIMA(2 × (1088 + 200), −2) = **2600 €**.

## 4. Riscos e bloqueios

1. ~~Não há Node.js nesta máquina~~ → resolvido: Node 24 instalado. Os testes SQL correm em **PGlite** (Postgres 17 em WebAssembly, dentro do Node), por isso não é preciso Docker.
2. ~~Esquema do Supabase fora do repositório~~ → resolvido: colunas obtidas pelo SQL Editor e reconstruídas em `supabase/tests/fixtures/01_existing_schema.sql`. As políticas e restrições reais não foram exportadas; a reconstrução usa uma aproximação.
3. ~~A pasta não é um repositório git~~ → resolvido: ligada a `github.com/pprim0/Aequilibrium-app`, ramo `main`.
4. Web Push no iPhone só funciona com a app adicionada ao ecrã principal, em iOS 16.4 ou superior. Fica documentado.
5. **O repositório no GitHub é público.** Por isso os valores pessoais (saldos, dívidas, ordenado, plano) estão num ficheiro que não vai para o git: `supabase/seed/preset_primo.local.sql`.

## 5. Decisões

- **D1 — "Livre para gastar" com rendimento parcial (configurável).** Com os dados reais de hoje, a regra do Excel dá **−730,23 €**: o extra de 300 € já está registado, o que desativa o aviso "Regista o rendimento", mas o ordenado de novembro ainda não entrou. A base de dados devolve sempre os dois valores: `free` (regra do Excel) e `free_projected` (soma o rendimento esperado que ainda falta, aqui 1238 € → **507,77 €**). O que a app mostra depende de `user_settings.free_to_spend_mode`: `projected` (por defeito) ou `actual`.
- **D2 — Ordenado (decidido).** Os rendimentos esperados são dados do utilizador, editáveis em Definições. Ficam numa tabela `income_sources` (nome, categoria, valor, dia previsto, válido de / até), com tantos valores e períodos quantos quiseres, e nada fica fixo no código. O preset "Primo" só sugere os valores iniciais: 1038 € até 24/12/2026, 1088 € a partir de 25/12/2026 (início do mês financeiro de jan 2027) e subsídio de 200 €. A meta do fundo lê estes valores através da `target_formula` (`"at": "latest"` ou `"current"`).
- **D3 — Dia de pagamento do Spotify e da Netflix (em aberto).** Ficaram sem dia, como no Excel. Sem dia, o Spotify conta como "por pagar" e nunca como "em atraso". Basta definir o dia mais tarde, nas Definições.
- **D4 — Pastas.** `web/` ao lado da app Expo; a app Expo é arquivada na fase 6.

## 6. Fase 2 — base de dados (feita)

**O que foi feito**

| Ficheiro | Conteúdo |
|---|---|
| `supabase/migrations/20261028120000_momentum_core.sql` | Renomeia as tabelas financeiras antigas para `legacy_*` (sem perder dados). Cria as 22 tabelas novas com RLS. Os FKs compostos `(id, user_id)` impedem apontar para dados de outro utilizador. `xp_ledger` tem `UNIQUE (user_id, rule_id, period_key)`, e o cliente não consegue escrever XP. O tipo do movimento vem da categoria e a conta vem do método de pagamento ou da conta principal (trigger). |
| `supabase/migrations/20261028120100_momentum_calc.sql` | Fonte única dos números: `fin_month_key`, `account_balances`, `money_in_accounts`, `month_totals`, `spent_on`, `recurring_status`, `installment_status`, `expected_income`, `goal_target`, `free_to_spend`, `budget_usage`, `transaction_alerts`, `debt_summary`, `goal_progress`, `investment_summary`, `allocation_comparison`, `month_projection`. Inclui também o trigger que só aceita a revisão diária de hoje ou de ontem. |
| `supabase/migrations/20261028120200_momentum_presets.sql` | `apply_setup(json)` (o onboarding envia um preset editado) e `apply_preset(chave)`. Presets públicos: `generic` e `gamification_default` (XP, níveis, missões, conquistas e o hábito de sistema "Revisão financeira do dia"). |
| `supabase/seed/preset_primo.local.sql` (privado) | Preset "Primo" com os valores do Excel, incluindo Barbeiro e Apple Pay. Fica visível só para a tua conta. |
| `supabase/functions/delete-account` | Atualizada para os nomes `legacy_*`; as tabelas novas apagam-se em cascata com o utilizador. |

**Como testar**

```bash
cd supabase/tests
npm install
npm test
```

**Resultados (28/10/2026): 28 testes, 28 passaram.** São 25 testes no repositório e 3 privados com os teus dados reais.

- Cenário de referência: livre **205,60 €**, rendimentos 1238, despesas 112,40, dívidas 470, poupança 50, reservado 100, saldo 1175,60, gasto hoje 112,40, duplicado só nos cafés e cartão a 0.
- Transferência, poupança, compra Klarna, prestação paga antes do prazo, Netflix alternada, fixo pago a 30/10 a contar para novembro, investimento (+10 €), XP sem duplicados, RLS, revisão só hoje/ontem, apagar o utilizador e presets.
- Dados reais do Excel (privado): rendimento 300, despesas 35,44, por pagar 303,82, reservado 450, livre **−730,23 €** (igual ao Excel), conta à ordem 24,69 €, Klarna 39,97 € e meta do fundo 2600 €.

**Limitações conhecidas**

- **As migrações ainda não foram aplicadas ao Supabase real.** Ao aplicá-las, as tabelas antigas passam a `legacy_*` e os ecrãs de finanças da app Expo deixam de funcionar.
- O motor de gamificação (atribuir XP, streak, missões, conquistas, pg_cron) é a fase 5. Por agora existem as tabelas, as definições e a garantia de unicidade.
- Os testes correm em PGlite com uma reconstrução do esquema; as políticas e restrições reais das tabelas antigas não foram verificadas.
- `momentum_today()` aceita a definição `momentum.today` para testes. Os clientes da API não conseguem alterá-la, mas convém confirmar isso no Supabase real.
- Os dados antigos (`legacy_*`) não são copiados para o modelo novo. O histórico vem do Excel, com o importador da fase 6.

## 7. Fase 3 — plano (registo rápido, movimentos, contas/dívidas, fixos/prestações)

1. Criar `web/`: Next.js 16 (App Router) + TypeScript + Tailwind 4 + `@supabase/ssr`. Componentes de interface escritos à mão no estilo shadcn (sem CLI interativa). Testes com Vitest.
2. Tema: os tokens de `src/theme` passam a variáveis CSS, com modo escuro e Plus Jakarta Sans. Textos em `web/src/i18n/pt-PT.ts`. Formatação pt-PT: `1 234,56 €`, `dd/mm/aaaa`, vírgula decimal ao escrever valores.
3. Autenticação: entrar e criar conta com email e palavra-passe, com a sessão persistente gerida pelo Supabase. Layout com navegação inferior no telemóvel e lateral no desktop, e botão "+" sempre visível.
4. **Registar** (folha que abre com o "+"): data de hoje pré-preenchida, atalhos em chips, valor com teclado numérico, categoria e conta sugeridas (vêm do atalho, da categoria ou do método de pagamento), guardar. Também permite dividir a compra (várias linhas com o mesmo `split_id`) e comprar a crédito: escolher o método Klarna ou Cartão de crédito põe a despesa na conta de crédito.
5. **Movimentos**: lista por mês financeiro, com filtros (categoria, tipo, conta), pesquisa, editar, apagar com confirmação e alertas (duplicado, sem categoria).
6. **Contas & Dívidas**: saldo de cada conta; dívidas em falta em destaque e as pagas a cinzento; prestações e pagamentos fixos com o respetivo estado. Permite criar e editar contas, fixos e prestações.
7. Todos os números vêm das funções SQL da Fase 2. Não se repete nenhum cálculo no cliente.

**Verificação:** Vitest para formatação e leitura de valores; `next build` sem erros; ecrãs a 375 px e 1440 px no browser. Para testar com dados reais, as migrações têm de estar aplicadas num projeto Supabase (idealmente um projeto de desenvolvimento).

## 8. Fase 3 — resumo

**O que foi feito** (pasta `web/`)

- Next.js 16.4 + TypeScript + Tailwind 4 + `@supabase/ssr`. A sessão é renovada no `src/proxy.ts`: visitantes sem sessão são enviados para `/entrar`.
- Tema com os tokens da Momentum e modo escuro, Plus Jakarta Sans, foco visível e alvos de toque com ≥ 44 px. Os textos estão em `src/i18n/pt-PT.ts`.
- **Registar**: botão "+" (no fundo, no telemóvel; na barra lateral, no desktop). Abre uma folha com atalhos em chips, valor com teclado numérico, categoria, data de hoje, método de pagamento, conta sugerida, conta destino (quando a categoria a pede), dividir compra e aviso de compra a crédito. Também edita e apaga movimentos.
- **Movimentos**: navegação por mês financeiro, totais do mês, pesquisa, filtros (categoria, tipo, conta) e alertas de possível duplicado ou falta de categoria. Tocar num movimento abre-o para editar.
- **Contas & Dívidas**: dinheiro nas contas, saldo de cada conta, dívidas (em falta em destaque, pagas a cinzento, progresso, conclusão estimada só com 2 ou mais meses), prestações e pagamentos fixos com estado. Permite criar, editar e apagar contas, fixos e prestações.
- **Configurar**: escolher um preset para uma conta nova. Fica no lugar do onboarding até à fase 6.
- **Início**: livre para gastar (ou livre previsto, ou "Regista o rendimento") e gasto hoje. O painel completo é a fase 4.

**Como testar**

```bash
cd web
npm install
npm test
npm run build
npm run dev
```

**Resultados (28/10/2026)**

- Vitest: 19 testes de formatação e leitura de valores, todos a passar. `eslint` sem erros. `next build` sem erros.
- No browser, com dados de exemplo numa rota temporária (já apagada), verifiquei:
  - a 375 px e a 1440 px: Entrar, a lista de Movimentos, a folha Registar e Contas & Dívidas, sem scroll horizontal;
  - o atalho preenche categoria, descrição, conta e valor habitual;
  - o método Klarna põe a despesa na conta Klarna e mostra o aviso de crédito;
  - a categoria "Dívida: Cartão" sugere a conta destino;
  - dividir a compra acrescenta partes.

**Limitações conhecidas**

- **Ainda não foi testado contra um Supabase real.** Faltam o URL e a anon key em `web/.env.local`, e as migrações aplicadas num projeto. Sem isso, entrar, guardar movimentos e os números reais não estão verificados de ponta a ponta.
- Editar um movimento dividido edita só essa parte.
- Os testes e2e automáticos (Playwright) ficam para quando houver um projeto Supabase de desenvolvimento.
