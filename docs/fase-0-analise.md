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

1. **Não há Node.js nem Python nesta máquina.** Sem Node não se instala nem se testa Next.js, Vitest, Playwright ou a CLI do Supabase. Para correr os testes SQL (pgTAP e RLS) localmente também é preciso Docker; a alternativa é um projeto Supabase só para testes.
2. **O esquema atual do Supabase não está no repositório.** Antes da fase 2 preciso do resultado de `npx supabase db dump --schema public` ou de acesso ao projeto. Sem isso, a migração das tabelas antigas é feita às cegas.
3. **A pasta não é um repositório git.** Proponho fazer `git init` e um commit inicial antes de mexer em código, para se poder voltar atrás.
4. Web Push no iPhone só funciona com a app adicionada ao ecrã principal, em iOS 16.4 ou superior. Fica documentado.

## 5. Decisões pendentes (preciso de resposta antes da fase 2)

- **D1 — "Livre para gastar" com rendimento parcial.** Com os dados reais de hoje, o Excel dá **−730,23 €**. O motivo é que o extra de 300 € já está registado, o que desativa o aviso "Regista o rendimento", mas o ordenado de novembro ainda não entrou. Mesmo assim, o plano de 550 € em dívidas, a renda e os outros fixos já são descontados. Proposta: o aviso passa a depender do **rendimento esperado** do mês (ordenado + subsídio, definidos como rendimentos recorrentes). Enquanto esse rendimento não entrar, mostrar "Livre previsto" rotulado como estimativa. Alternativa: copiar o Excel tal como está.
- **D2 — Ordenado (decidido).** Os rendimentos esperados são dados do utilizador, editáveis em Definições. Ficam numa tabela `income_sources` (nome, categoria, valor, dia previsto, válido de / até), com tantos valores e períodos quantos quiseres, e nada fica fixo no código. O preset "Primo" só sugere os valores iniciais (1038 € até dez 2026, 1088 € a partir de jan 2027, subsídio 200 €), que podes alterar a qualquer momento. A meta do fundo lê estes valores através da `target_formula` (`includes: ["salary","meal_allowance"]`), usando o valor em vigor no mês corrente ou o mais recente; a escolha também é configurável.
- **D3 — Dia de pagamento do Spotify e da Netflix.** No Excel estão sem dia ("Define o dia"). O Spotify conta como "Por pagar", e por isso já está reservado. Que dia uso para cada um?
- **D4 — Organização das pastas.** `web/` ao lado da app Expo, e a app Expo arquivada na fase 6. Confirmas?

## 6. Plano da fase 1 (depois das respostas)

1. `git init`, instalar Node LTS e criar `web/` (Next.js, TS, Tailwind, shadcn, i18n pt-PT, tokens do tema).
2. Obter o esquema atual e escrever a migração base com as tabelas da §3, RLS em todas, índices e a restrição `UNIQUE (user_id, rule_id, period_key)` no `xp_ledger`.
3. Funções e views de cálculo da §3, com testes pgTAP para o cenário de referência (205,60 €) e para os restantes casos da secção 8 do enunciado.
4. Seeds com os presets "Primo" (incluindo Barbeiro e Apple Pay) e "Genérico".
