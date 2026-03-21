import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';

// ── Dados de exemplo ──────────────────────────────────────

const transactions = [
  { id: 1, emoji: '🛒', name: 'Supermercado Continente', category: 'Alimentação', date: 'Hoje', amount: -28, recurring: false },
  { id: 2, emoji: '🚇', name: 'Carregamento Andante', category: 'Transporte', date: 'Ontem', amount: -30, recurring: false },
  { id: 3, emoji: '💼', name: 'Salário Março', category: 'Receita', date: '1 Mar', amount: 1800, recurring: true },
  { id: 4, emoji: '🍕', name: 'Restaurante — Jantar', category: 'Alimentação', date: '12 Mar', amount: -24, recurring: false },
  { id: 5, emoji: '📱', name: 'Spotify', category: 'Subscrições', date: '10 Mar', amount: -10, recurring: true },
];

const categories = [
  { emoji: '🛒', name: 'Alimentação', spent: 180, budget: 250, color: colors.primary },
  { emoji: '🏠', name: 'Casa', spent: 450, budget: 500, color: colors.warning },
  { emoji: '🚗', name: 'Transporte', spent: 75, budget: 150, color: colors.info },
  { emoji: '🎭', name: 'Lazer', spent: 90, budget: 100, color: colors.error },
  { emoji: '📱', name: 'Subscrições', spent: 45, budget: 80, color: colors.primaryMid },
];

const goals = [
  { id: 1, emoji: '✈️', name: 'Viagem', current: 180, target: 500 },
  { id: 2, emoji: '🛡️', name: 'Fundo emergência', current: 1680, target: 3000 },
  { id: 3, emoji: '💻', name: 'Novo portátil', current: 840, target: 1000 },
];

// ── Mini componentes ──────────────────────────────────────

function ProgressBar({ percent, color = colors.primary, height = 8 }) {
  const safePercent = Math.min(percent, 100);
  const barColor = percent >= 90 ? colors.error : percent >= 70 ? colors.warning : color;
  return (
    <View style={[styles.progressTrack, { height }]}>
      <View style={[styles.progressFill, { width: `${safePercent}%`, backgroundColor: barColor, height }]} />
    </View>
  );
}

function Badge({ label, color = colors.primary, bg = colors.primaryPale }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, action }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && <Text style={styles.seeAll}>{action}</Text>}
    </View>
  );
}

function TransactionRow({ tx }) {
  const isIncome = tx.amount > 0;
  return (
    <View style={styles.txRow}>
      <View style={[styles.txEmoji, { backgroundColor: isIncome ? colors.primaryPale : colors.bg }]}>
        <Text style={{ fontSize: 18 }}>{tx.emoji}</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txName}>{tx.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={styles.txMeta}>{tx.category} · {tx.date}</Text>
          {tx.recurring && (
            <View style={[styles.badge, { backgroundColor: colors.infoPale, paddingHorizontal: 6, paddingVertical: 2 }]}>
              <Text style={[styles.badgeText, { color: colors.info, fontSize: 10 }]}>↻</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.txAmount, { color: isIncome ? colors.success : colors.error }]}>
        {isIncome ? '+' : ''}{tx.amount}€
      </Text>
    </View>
  );
}

function CategoryRow({ cat }) {
  const percent = Math.round((cat.spent / cat.budget) * 100);
  return (
    <View style={styles.catRow}>
      <Text style={{ fontSize: 20, width: 28 }}>{cat.emoji}</Text>
      <View style={styles.catInfo}>
        <View style={styles.catNameRow}>
          <Text style={styles.catName}>{cat.name}</Text>
          <Text style={styles.catAmt}>{cat.spent}€ / {cat.budget}€</Text>
        </View>
        <ProgressBar percent={percent} color={cat.color} height={6} />
        {percent >= 90 && (
          <Text style={styles.catWarning}>⚠️ Perto do limite</Text>
        )}
      </View>
    </View>
  );
}

function GoalCard({ goal }) {
  const percent = Math.round((goal.current / goal.target) * 100);
  return (
    <View style={styles.goalCard}>
      <View style={styles.goalTop}>
        <Text style={{ fontSize: 26 }}>{goal.emoji}</Text>
        <View style={styles.goalInfo}>
          <Text style={styles.goalName}>{goal.name}</Text>
          <Text style={styles.goalMeta}>{goal.current}€ de {goal.target}€</Text>
        </View>
        <Text style={styles.goalPercent}>{percent}%</Text>
      </View>
      <ProgressBar percent={percent} height={6} />
      {percent >= 80 && (
        <Text style={[styles.catWarning, { color: colors.success, marginTop: 4 }]}>🎉 Quase lá!</Text>
      )}
    </View>
  );
}

// ── Screen principal ──────────────────────────────────────

export default function FinanceScreen() {
  const [tab, setTab] = useState('Resumo');
  const tabs = ['Resumo', 'Transações', 'Orçamento', 'Metas'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Finanças</Text>
        <TouchableOpacity style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>Mar 2025</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContent}
      >
        {tabs.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── RESUMO ── */}
        {tab === 'Resumo' && (
          <>
            {/* Saldo card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Saldo do mês</Text>
              <Text style={styles.balanceAmount}>+1.260€</Text>
              <View style={styles.balanceRow}>
                <View>
                  <Text style={styles.balanceSubLabel}>Receitas</Text>
                  <Text style={[styles.balanceSubVal, { color: '#7DC9A8' }]}>+1.800€</Text>
                </View>
                <View>
                  <Text style={styles.balanceSubLabel}>Despesas</Text>
                  <Text style={[styles.balanceSubVal, { color: '#F4A4A4' }]}>-540€</Text>
                </View>
                <View>
                  <Text style={styles.balanceSubLabel}>vs. Fev</Text>
                  <Text style={[styles.balanceSubVal, { color: 'rgba(255,255,255,0.8)' }]}>-12%</Text>
                </View>
              </View>
            </View>

            {/* Orçamento */}
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Orçamento mensal</Text>
                <Badge label="Dentro do limite" />
              </View>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetText}>540€ usados de 1.200€</Text>
                <Text style={styles.budgetPercent}>45%</Text>
              </View>
              <ProgressBar percent={45} />
              <Text style={styles.budgetSub}>660€ disponíveis · 10 dias restantes</Text>
            </View>

            {/* Alerta */}
            <View style={styles.alertBar}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>Perto do limite em Lazer</Text>
                <Text style={styles.alertSub}>Usaste 90€ de 100€ orçamentados</Text>
              </View>
            </View>

            {/* Transações recentes */}
            <View style={styles.card}>
              <SectionHeader title="Recentes" action="Ver todas →" />
              {transactions.slice(0, 4).map((tx, i) => (
                <View key={tx.id}>
                  <TransactionRow tx={tx} />
                  {i < 3 && <View style={styles.txDivider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── TRANSAÇÕES ── */}
        {tab === 'Transações' && (
          <>
            <View style={styles.card}>
              <SectionHeader title="Março 2025" />
              {transactions.map((tx, i) => (
                <View key={tx.id}>
                  <TransactionRow tx={tx} />
                  {i < transactions.length - 1 && <View style={styles.txDivider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── ORÇAMENTO ── */}
        {tab === 'Orçamento' && (
          <>
            <View style={styles.card}>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetText}>Total gasto: 540€</Text>
                <Text style={styles.budgetPercent}>de 1.200€</Text>
              </View>
              <ProgressBar percent={45} height={10} />
            </View>
            <View style={styles.card}>
              <SectionHeader title="Por categoria" />
              {categories.map((cat, i) => (
                <View key={cat.name}>
                  <CategoryRow cat={cat} />
                  {i < categories.length - 1 && <View style={styles.txDivider} />}
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.addCatBtn}>
              <Text style={styles.addCatText}>+ Adicionar categoria</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── METAS ── */}
        {tab === 'Metas' && (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Poupança acumulada</Text>
              <Text style={styles.balanceAmount}>420€</Text>
              <Text style={[styles.balanceSubLabel, { marginTop: 4 }]}>em 3 metas ativas</Text>
            </View>
            {goals.map(g => (
              <GoalCard key={g.id} goal={g} />
            ))}
            <TouchableOpacity style={styles.addCatBtn}>
              <Text style={styles.addCatText}>+ Criar nova meta</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32 }}>+</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: 12, paddingBottom: 100 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: 8 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: colors.text },
  monthBtn: { backgroundColor: colors.bg, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  monthBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.text2 },

  // Tabs
  tabScroll: { flexGrow: 0 },
  tabContent: { paddingHorizontal: spacing.md, gap: 8, paddingBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.text3 },
  tabLabelActive: { color: '#fff' },

  // Card
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },

  // Progress
  progressTrack: { backgroundColor: colors.border, borderRadius: 100, overflow: 'hidden' },
  progressFill: { borderRadius: 100 },

  // Badge
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text },
  seeAll: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.primary },

  // Balance card
  balanceCard: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, ...shadow.md },
  balanceLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  balanceAmount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 36, color: '#fff', letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  balanceSubLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  balanceSubVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, marginTop: 2 },

  // Budget
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  budgetText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.text2 },
  budgetPercent: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.primary },
  budgetSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, marginTop: 8 },

  // Alert
  alertBar: { backgroundColor: colors.warningPale, borderRadius: radius.sm, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  alertTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.warning },
  alertSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text2, marginTop: 2 },

  // Transactions
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  txEmoji: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.text },
  txMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3 },
  txAmount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  txDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  catInfo: { flex: 1 },
  catNameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.text },
  catAmt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.text },
  catWarning: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.error, marginTop: 4 },

  // Goals
  goalCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  goalInfo: { flex: 1 },
  goalName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text },
  goalMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, marginTop: 2 },
  goalPercent: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.primary },

  // Add button
  addCatBtn: { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  addCatText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.primary },

  // FAB
  fab: { position: 'absolute', bottom: 90, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.md },
});