import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';

// ── Dados de exemplo ──────────────────────────────────────

const correlations = [
  {
    id: 1,
    emoji: '🍳',
    title: 'Cozinhar em casa poupa-te 12€/dia',
    desc: 'Nos dias com este hábito, gastas muito menos em alimentação.',
    withHabit: '8€',
    withoutHabit: '20€',
    tag: 'Alimentação',
  },
  {
    id: 2,
    emoji: '🏃',
    title: 'Treino → menos gastos impulsivos',
    desc: 'Nos dias de exercício, os teus gastos são 23% menores.',
    withHabit: '18€',
    withoutHabit: '34€',
    tag: 'Lazer',
  },
  {
    id: 3,
    emoji: '📝',
    title: 'Registar despesas dá clareza',
    desc: 'Quando registas todos os dias, o teu orçamento fica 89% mais preciso.',
    withHabit: '89%',
    withoutHabit: '41%',
    tag: 'Finanças',
  },
];

const recommendations = [
  { emoji: '🥡', text: 'Reduz take-away para 2x/semana e poupas ~60€/mês.' },
  { emoji: '📊', text: 'Regista despesas ao fim do dia para melhor controlo.' },
  { emoji: '🏋️', text: 'Mantém o hábito de treino — impacta positivamente os gastos.' },
];

const weekStats = [
  { day: 'S', habits: 60, spend: 12 },
  { day: 'D', habits: 100, spend: 8 },
  { day: 'S', habits: 80, spend: 22 },
  { day: 'T', habits: 40, spend: 35 },
  { day: 'T', habits: 100, spend: 9 },
  { day: 'Q', habits: 60, spend: 18 },
  { day: 'S', habits: 20, spend: 28 },
];

// ── Mini componentes ──────────────────────────────────────

function ScoreRing({ score }) {
  return (
    <View style={styles.scoreRing}>
      <Text style={styles.scoreVal}>{score}</Text>
    </View>
  );
}

function MiniBarChart({ data }) {
  const maxSpend = Math.max(...data.map(d => d.spend));
  return (
    <View style={styles.chart}>
      {data.map((d, i) => (
        <View key={i} style={styles.chartCol}>
          <View style={styles.chartBarWrap}>
            <View style={[styles.chartBar, {
              height: `${(d.spend / maxSpend) * 100}%`,
              backgroundColor: d.spend > 25 ? colors.error : colors.primary,
            }]} />
          </View>
          <Text style={styles.chartLabel}>{d.day}</Text>
        </View>
      ))}
    </View>
  );
}

function MetricCard({ label, value, sub, highlight }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricVal, highlight && { color: highlight }]}>{value}</Text>
      {sub && <Text style={styles.metricSub}>{sub}</Text>}
    </View>
  );
}

function CorrelationCard({ item }) {
  return (
    <TouchableOpacity style={styles.corrCard} activeOpacity={0.8}>
      <View style={styles.corrTop}>
        <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
        <View style={styles.corrInfo}>
          <Text style={styles.corrTitle}>{item.title}</Text>
          <Text style={styles.corrDesc}>{item.desc}</Text>
        </View>
        <Text style={styles.corrArrow}>›</Text>
      </View>
      <View style={styles.corrStats}>
        <View style={styles.corrStat}>
          <Text style={styles.corrStatLabel}>Com hábito</Text>
          <Text style={[styles.corrStatVal, { color: colors.success }]}>{item.withHabit}</Text>
        </View>
        <View style={styles.corrDivider} />
        <View style={styles.corrStat}>
          <Text style={styles.corrStatLabel}>Sem hábito</Text>
          <Text style={[styles.corrStatVal, { color: colors.error }]}>{item.withoutHabit}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.primaryPale, marginLeft: 'auto' }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>{item.tag}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen principal ──────────────────────────────────────

export default function InsightsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <View style={[styles.badge, { backgroundColor: colors.primaryPale }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>Semana 12</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Score */}
        <View style={styles.scoreCard}>
          <ScoreRing score={82} />
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreTitle}>Score de disciplina</Text>
            <Text style={styles.scoreSub}>Melhor do que 74% dos utilizadores</Text>
            <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 8 }]}>
              <Text style={[styles.badgeText, { color: '#fff' }]}>↑ 8pts vs semana passada</Text>
            </View>
          </View>
        </View>

        {/* Métricas da semana */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Esta semana</Text>
          <View style={styles.metricsGrid}>
            <MetricCard label="Hábitos" value="73%" sub="↑ +12% vs anterior" highlight={colors.primary} />
            <MetricCard label="Gastos" value="142€" sub="↓ -18€ vs média" highlight={colors.text} />
            <MetricCard label="Streak" value="🔥 6" sub="Melhor: 9 dias" />
            <MetricCard label="Poupança" value="120€" sub="Meta: 300€/mês" highlight={colors.success} />
          </View>
        </View>

        {/* Gráfico de gastos */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gastos diários — esta semana</Text>
          <MiniBarChart data={weekStats} />
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Normal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
              <Text style={styles.legendText}>Acima da média</Text>
            </View>
          </View>
        </View>

        {/* Correlações */}
        <View>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Correlações encontradas</Text>
          {correlations.map(item => (
            <CorrelationCard key={item.id} item={item} />
          ))}
        </View>

        {/* Recomendações */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Recomendações</Text>
          {recommendations.map((r, i) => (
            <View key={i} style={[styles.recRow, i < recommendations.length - 1 && styles.recBorder]}>
              <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
              <Text style={styles.recText}>{r.text}</Text>
            </View>
          ))}
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

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: 8 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: colors.text },

  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 },

  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },

  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text, marginBottom: 16 },

  // Score
  scoreCard: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 16, ...shadow.md },
  scoreRing: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  scoreVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: '#fff' },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: '#fff' },
  scoreSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Metrics
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { width: '47.5%', backgroundColor: colors.bg, borderRadius: radius.sm, padding: 14 },
  metricLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  metricVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.text },
  metricSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, marginTop: 2 },

  // Chart
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6, marginBottom: 10 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartBarWrap: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 4, minHeight: 4 },
  chartLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.text3 },
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3 },

  // Correlations
  corrCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: 10, ...shadow.sm },
  corrTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  corrInfo: { flex: 1 },
  corrTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.text },
  corrDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text2, marginTop: 3, lineHeight: 18 },
  corrArrow: { fontSize: 22, color: colors.primary },
  corrStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10, gap: 12 },
  corrStat: { alignItems: 'center' },
  corrStatLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3 },
  corrStatVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, marginTop: 2 },
  corrDivider: { width: 1, height: 32, backgroundColor: colors.border },

  // Recommendations
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  recBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  recText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: colors.text2, flex: 1, lineHeight: 20 },
});