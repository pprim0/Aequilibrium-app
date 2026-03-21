import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, shadow } from '../theme';
import { getTodayHabits, toggleHabit } from '../store/habits';
import { getMonthSummary, getTransactions, getBudget } from '../store/finance';
import { getGoals } from '../store/goals';

// ── Helpers ───────────────────────────────────────────────

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

function weekdayLabel() {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long' });
}

// ── Mini componentes ──────────────────────────────────────

function Avatar({ name }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name[0].toUpperCase()}</Text>
    </View>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function ProgressBar({ percent, color = colors.primary, height = 8 }) {
  const safe = Math.min(Math.max(percent, 0), 100);
  const barColor = percent >= 90 ? colors.error : percent >= 70 ? colors.warning : color;
  return (
    <View style={[styles.progressTrack, { height }]}>
      <View style={[styles.progressFill, { width: `${safe}%`, backgroundColor: barColor, height }]} />
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

function SectionHeader({ title, action, onPress }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.seeAll}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function HabitRow({ habit, onToggle }) {
  return (
    <TouchableOpacity
      style={styles.habitRow}
      onPress={() => onToggle(habit.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.habitCheck, habit.done && styles.habitCheckDone]}>
        {habit.done && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
      </View>
      <View style={[styles.emojiBox, { backgroundColor: habit.done ? colors.primaryPale : '#F5F5F5' }]}>
        <Text style={{ fontSize: 15 }}>{habit.emoji}</Text>
      </View>
      <View style={styles.habitInfo}>
        <Text style={[styles.habitName, habit.done && styles.habitNameDone]}>
          {habit.name}
        </Text>
        <Text style={styles.habitTime}>{habit.time}</Text>
      </View>
      <Text style={styles.habitStreak}>🔥 {habit.streak}</Text>
    </TouchableOpacity>
  );
}

const QUICK_ACTIONS = [
  { emoji: '➖', label: 'Despesa', bg: colors.errorPale },
  { emoji: '➕', label: 'Receita', bg: colors.primaryPale },
  { emoji: '✅', label: 'Hábito', bg: colors.warningPale },
  { emoji: '🎯', label: 'Meta', bg: colors.infoPale },
];

// ── Screen principal ──────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const [habits, setHabits] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expenses: 0, balance: 0 });
  const [budget, setBudget] = useState([]);
  const [goals, setGoals] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  const month = currentMonth();

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  async function loadAll() {
    try {
      setLoading(true);
      const [h, sum, bud, gls, txs] = await Promise.all([
        getTodayHabits(),
        getMonthSummary(month),
        getBudget(),
        getGoals(),
        getTransactions(month),
      ]);
      setHabits(h);
      setSummary(sum);
      setBudget(bud);
      setGoals(gls);
      setRecentTx(txs.slice(0, 2));
    } catch (e) {
      console.error('Erro ao carregar home:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id) {
    setHabits(prev =>
      prev.map(h => h.id === id
        ? { ...h, done: !h.done, streak: h.done ? h.streak - 1 : h.streak + 1 }
        : h)
    );
    try {
      await toggleHabit(id);
    } catch (e) {
      loadAll();
    }
  }

  const totalBudget = budget.reduce((a, b) => a + b.amount, 0);
  const budgetPercent = totalBudget > 0 ? Math.round((summary.expenses / totalBudget) * 100) : 0;
  const habitsDone = habits.filter(h => h.done).length;
  const habitsTotal = habits.length;
  const topStreak = habits.reduce((max, h) => h.streak > max ? h.streak : max, 0);
  const topGoal = goals[0];

  const insightText = habitsDone > 0
    ? `Nos dias em que cozinhas em casa, gastas menos 12€ em média.`
    : `Completa hábitos hoje para começares a gerar insights personalizados.`;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}, Pedro 👋</Text>
          <Text style={styles.greetingSub}>
            {habitsTotal - habitsDone > 0
              ? `${habitsTotal - habitsDone} hábitos por concluir hoje`
              : 'Todos os hábitos concluídos! 🎉'}
          </Text>
        </View>
        <Avatar name="Pedro" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroDate}>
              {todayLabel().charAt(0).toUpperCase() + todayLabel().slice(1)}
            </Text>
            <Badge
              label={weekdayLabel().charAt(0).toUpperCase() + weekdayLabel().slice(1)}
              color="#fff"
              bg="rgba(255,255,255,0.2)"
            />
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{habitsDone}/{habitsTotal}</Text>
              <Text style={styles.heroStatLabel}>Hábitos</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{summary.expenses}€</Text>
              <Text style={styles.heroStatLabel}>Gastos mês</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>🔥 {topStreak}</Text>
              <Text style={styles.heroStatLabel}>Streak</Text>
            </View>
          </View>
        </View>

        {/* Hábitos do dia */}
        <Card>
          <SectionHeader
            title="Hábitos de hoje"
            action="Ver todos"
            onPress={() => navigation.navigate('Hábitos')}
          />
          {habits.length === 0 ? (
            <View style={styles.emptySmall}>
              <Text style={styles.emptySmallText}>Ainda não tens hábitos criados.</Text>
            </View>
          ) : (
            habits.slice(0, 3).map((h, i) => (
              <View key={h.id}>
                <HabitRow habit={h} onToggle={handleToggle} />
                {i < Math.min(habits.length, 3) - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
        </Card>

        {/* Resumo financeiro */}
        <Card>
          <SectionHeader
            title="Finanças"
            action="Detalhes"
            onPress={() => navigation.navigate('Finanças')}
          />
          <View style={styles.financeTop}>
            <View>
              <Text style={styles.financeAmount}>{summary.expenses}€</Text>
              <Text style={styles.financeSub}>de {totalBudget}€ orçamento</Text>
            </View>
            <Badge
              label={`${budgetPercent}% usado`}
              color={budgetPercent >= 90 ? colors.error : colors.primary}
              bg={budgetPercent >= 90 ? colors.errorPale : colors.primaryPale}
            />
          </View>
          <ProgressBar percent={budgetPercent} />
          <View style={styles.financeDivider} />
          <View style={styles.financeRow}>
            <View style={styles.financeStat}>
              <Text style={[styles.financeStatVal, { color: colors.success }]}>+{summary.income}€</Text>
              <Text style={styles.financeStatLabel}>Receitas</Text>
            </View>
            <View style={styles.financeStat}>
              <Text style={[styles.financeStatVal, { color: colors.error }]}>-{summary.expenses}€</Text>
              <Text style={styles.financeStatLabel}>Despesas</Text>
            </View>
            <View style={styles.financeStat}>
              <Text style={[styles.financeStatVal, { color: colors.primary }]}>
                {Math.max(0, summary.income - summary.expenses)}€
              </Text>
              <Text style={styles.financeStatLabel}>Poupança</Text>
            </View>
          </View>
        </Card>

        {/* Meta principal */}
        {topGoal && (
          <View style={styles.metaCard}>
            <View style={styles.metaTop}>
              <Text style={{ fontSize: 28 }}>{topGoal.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.metaLabel}>Meta principal</Text>
                <Text style={styles.metaTitle}>{topGoal.name}</Text>
              </View>
              <Text style={styles.metaPercent}>
                {Math.round((topGoal.current / topGoal.target) * 100)}%
              </Text>
            </View>
            <View style={styles.metaProgressRow}>
              <Text style={styles.metaProgressText}>
                {topGoal.current}€ de {topGoal.target}€
              </Text>
            </View>
            <ProgressBar percent={Math.round((topGoal.current / topGoal.target) * 100)} />
          </View>
        )}

        {/* Insight */}
        <View style={styles.insightCard}>
          <Text style={styles.insightTag}>⚡ Insight</Text>
          <Text style={styles.insightText}>{insightText}</Text>
        </View>

        {/* Quick actions */}
        <View>
          <SectionHeader title="Ações rápidas" />
          <View style={styles.qaGrid}>
            {QUICK_ACTIONS.map((qa) => (
              <TouchableOpacity
                key={qa.label}
                style={styles.qaBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (qa.label === 'Despesa' || qa.label === 'Receita') {
                    navigation.navigate('Finanças');
                  } else if (qa.label === 'Hábito') {
                    navigation.navigate('Hábitos');
                  }
                }}
              >
                <View style={[styles.qaIcon, { backgroundColor: qa.bg }]}>
                  <Text style={{ fontSize: 16 }}>{qa.emoji}</Text>
                </View>
                <Text style={styles.qaLabel}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: 12, paddingBottom: 32 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: 8 },
  greeting: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: colors.text },
  greetingSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.text2, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: '#fff' },

  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },

  progressTrack: { backgroundColor: colors.border, borderRadius: 100, overflow: 'hidden' },
  progressFill: { borderRadius: 100 },

  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text },
  seeAll: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.primary },

  divider: { height: 1, backgroundColor: colors.border },

  // Hero
  heroCard: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, ...shadow.md },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heroDate: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: '#fff' },
  heroStatLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroStatDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Habits
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  habitCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  habitCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  emojiBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  habitInfo: { flex: 1 },
  habitName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.text },
  habitNameDone: { color: colors.text3, textDecorationLine: 'line-through' },
  habitTime: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, marginTop: 1 },
  habitStreak: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.warning },

  // Finance
  financeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  financeAmount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: colors.text },
  financeSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3 },
  financeDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  financeRow: { flexDirection: 'row' },
  financeStat: { flex: 1, alignItems: 'center' },
  financeStatVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  financeStatLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, marginTop: 2 },

  // Meta
  metaCard: { backgroundColor: '#E8F5EE', borderRadius: radius.md, padding: spacing.md },
  metaTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  metaLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  metaTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.text },
  metaPercent: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.primary },
  metaProgressRow: { marginBottom: 6 },
  metaProgressText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.text2 },

  // Insight
  insightCard: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md },
  insightTag: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  insightText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 21 },

  // Quick actions
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qaBtn: { width: '47.5%', backgroundColor: colors.card, borderRadius: radius.sm, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadow.sm },
  qaIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.text },

  // Empty
  emptySmall: { paddingVertical: 16, alignItems: 'center' },
  emptySmallText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.text3 },
});