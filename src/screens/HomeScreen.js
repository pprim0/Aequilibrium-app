import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';

// ── Mini componentes ──────────────────────────────────────

function Avatar({ name }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name[0]}</Text>
    </View>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function ProgressBar({ percent, color = colors.primary, height = 8 }) {
  return (
    <View style={[styles.progressTrack, { height }]}>
      <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color, height }]} />
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

// ── Dados de exemplo ──────────────────────────────────────

const habits = [
  { id: 1, emoji: '💧', name: 'Beber 2L de água', time: '08:00', streak: 6, done: true },
  { id: 2, emoji: '🍳', name: 'Cozinhar em casa', time: '12:30', streak: 4, done: true },
  { id: 3, emoji: '🏃', name: 'Exercício', time: '18:00', streak: 3, done: false },
];

const quickActions = [
  { emoji: '➖', label: 'Despesa', bg: colors.errorPale },
  { emoji: '➕', label: 'Receita', bg: colors.primaryPale },
  { emoji: '✅', label: 'Hábito', bg: colors.warningPale },
  { emoji: '🎯', label: 'Meta', bg: colors.infoPale },
];

// ── Screen principal ──────────────────────────────────────

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bom dia, Pedro 👋</Text>
          <Text style={styles.greetingSub}>3 hábitos por concluir · Streak de 6 dias 🔥</Text>
        </View>
        <Avatar name="Pedro" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Card topo — resumo do dia */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroDate}>Hoje, 21 Mar</Text>
            <Badge label="Sábado" color="#fff" bg="rgba(255,255,255,0.2)" />
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>2/5</Text>
              <Text style={styles.heroStatLabel}>Hábitos</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>28€</Text>
              <Text style={styles.heroStatLabel}>Gastos hoje</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>6</Text>
              <Text style={styles.heroStatLabel}>Dias streak</Text>
            </View>
          </View>
        </View>

        {/* Hábitos do dia */}
        <Card>
          <SectionHeader title="Hábitos de hoje" action="Ver todos" />
          {habits.map((h, i) => (
            <View key={h.id} style={[styles.habitRow, i < habits.length - 1 && styles.habitRowBorder]}>
              <View style={[styles.habitCheck, h.done && styles.habitCheckDone]}>
                {h.done && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
              </View>
              <View style={[styles.emojiBox, { backgroundColor: h.done ? colors.primaryPale : '#F5F5F5' }]}>
                <Text style={{ fontSize: 15 }}>{h.emoji}</Text>
              </View>
              <View style={styles.habitInfo}>
                <Text style={[styles.habitName, h.done && styles.habitNameDone]}>{h.name}</Text>
                <Text style={styles.habitTime}>{h.time}</Text>
              </View>
              <Text style={styles.habitStreak}>🔥 {h.streak}</Text>
            </View>
          ))}
        </Card>

        {/* Resumo financeiro */}
        <Card>
          <SectionHeader title="Finanças — Março" action="Detalhes" />
          <View style={styles.financeTop}>
            <View>
              <Text style={styles.financeAmount}>540€</Text>
              <Text style={styles.financeSub}>de 1.200€ orçamento</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Badge label="45% usado" />
              <Text style={[styles.financeSub, { marginTop: 4 }]}>660€ restantes</Text>
            </View>
          </View>
          <ProgressBar percent={45} />
          <View style={styles.financeDivider} />
          <View style={styles.financeRow}>
            <View style={styles.financeStat}>
              <Text style={[styles.financeStatVal, { color: colors.success }]}>+1.800€</Text>
              <Text style={styles.financeStatLabel}>Receitas</Text>
            </View>
            <View style={styles.financeStat}>
              <Text style={[styles.financeStatVal, { color: colors.error }]}>-540€</Text>
              <Text style={styles.financeStatLabel}>Despesas</Text>
            </View>
            <View style={styles.financeStat}>
              <Text style={[styles.financeStatVal, { color: colors.primary }]}>120€</Text>
              <Text style={styles.financeStatLabel}>Poupança</Text>
            </View>
          </View>
        </Card>

        {/* Meta principal */}
        <View style={styles.metaCard}>
          <View style={styles.metaTop}>
            <Text style={{ fontSize: 28 }}>✈️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Meta do mês</Text>
              <Text style={styles.metaTitle}>Fundo de viagem</Text>
            </View>
            <Text style={styles.metaPercent}>36%</Text>
          </View>
          <View style={styles.metaProgress}>
            <Text style={styles.metaProgressText}>180€ de 500€</Text>
          </View>
          <ProgressBar percent={36} />
        </View>

        {/* Insight */}
        <View style={styles.insightCard}>
          <Text style={styles.insightTag}>⚡ Insight da semana</Text>
          <Text style={styles.insightText}>
            Nos dias em que cozinhas em casa, gastas menos{' '}
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff' }}>12€</Text>
            {' '}em média em alimentação.
          </Text>
        </View>

        {/* Quick actions */}
        <View>
          <SectionHeader title="Ações rápidas" />
          <View style={styles.qaGrid}>
            {quickActions.map((qa) => (
              <TouchableOpacity key={qa.label} style={styles.qaBtn} activeOpacity={0.7}>
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

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: 8 },
  greeting: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: colors.text },
  greetingSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.text2, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: '#fff' },

  // Card base
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

  // Hero card
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
  habitRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  habitCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
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
  metaProgress: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
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
});