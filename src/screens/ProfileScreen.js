import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, shadow } from '../theme';
import { sendTestNotification, cancelAllReminders } from '../utils/notifications';
import { getMyProfile } from '../services/profileService';
import { signOut } from '../services/authService';
import { deleteMyAccount } from '../services/accountService';
import { getGoals } from '../services/goalService';
import { getMonthSummary, getBudget } from '../services/financeService';
import { getAllHabits, getTodayHabits } from '../services/habitService';
import EditProfileModal from '../components/EditProfileModal';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month) {
  return new Date(`${month}-01`).toLocaleDateString('pt-PT', {
    month: 'long',
    year: 'numeric',
  });
}

function SettingsRow({ item }) {
  return (
    <TouchableOpacity
      style={[styles.settingsRow, item.danger && styles.settingsRowDanger]}
      onPress={item.onPress}
      activeOpacity={item.onPress ? 0.7 : 1}
    >
      <View style={[styles.settingsIcon, { backgroundColor: item.danger ? colors.errorPale : colors.bg }]}>
        <Text style={{ fontSize: 17 }}>{item.emoji}</Text>
      </View>
      <View style={styles.settingsText}>
        <Text style={[styles.settingsLabel, item.danger && { color: colors.error }]}>{item.label}</Text>
        {item.sub && <Text style={styles.settingsSub}>{item.sub}</Text>}
      </View>
      {item.arrow && <Text style={styles.chevron}>›</Text>}
      {item.toggle !== undefined && (
        <Switch
          value={item.value}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      )}
    </TouchableOpacity>
  );
}

function EmptyCard({ emoji, title, sub }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const month = currentMonth();
  const [profile, setProfile] = useState(null);
  const [goals, setGoals] = useState([]);
  const [habits, setHabits] = useState([]);
  const [todayHabits, setTodayHabits] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expenses: 0, balance: 0 });
  const [budget, setBudget] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [])
  );

  async function loadProfileData() {
    try {
      setLoading(true);
      const [profileData, goalsData, habitsData, todayHabitsData, monthSummary, monthBudget] = await Promise.all([
        getMyProfile(),
        getGoals(),
        getAllHabits(),
        getTodayHabits(),
        getMonthSummary(month),
        getBudget(month),
      ]);

      setProfile(profileData);
      setGoals(goalsData);
      setHabits(habitsData);
      setTodayHabits(todayHabitsData);
      setSummary(monthSummary);
      setBudget(monthBudget);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao terminar sessão:', error);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Apagar conta',
      'Isto vai apagar os teus dados da app neste momento e terminar a sessão. Esta ação é irreversível.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Confirmação final',
      'Tens a certeza absoluta? Vamos apagar perfil, hábitos, transações, metas, categorias, orçamentos e preferências.',
      [
        { text: 'Voltar atrás', style: 'cancel' },
        {
          text: 'Apagar tudo',
          style: 'destructive',
          onPress: performAccountDeletion,
        },
      ]
    );
  }

  async function performAccountDeletion() {
    try {
      setDeletingAccount(true);
      await deleteMyAccount();
      try {
        await signOut();
      } catch (_) {
        // Se o utilizador já foi removido do auth, a sessão local será descartada no reload do bootstrap.
      }
    } catch (error) {
      console.error('Erro ao apagar conta:', error);
      Alert.alert(
        'Não foi possível apagar a conta',
        error.message || 'Tenta novamente dentro de instantes.'
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  const activeHabits = habits.length;
  const bestStreak = habits.reduce((max, habit) => Math.max(max, habit.streak), 0);
  const habitsDoneToday = todayHabits.filter((habit) => habit.done).length;
  const habitsConsistency = todayHabits.length > 0
    ? Math.round((habitsDoneToday / todayHabits.length) * 100)
    : 0;
  const totalBudget = budget.reduce((sum, item) => sum + item.amount, 0);
  const budgetUsage = totalBudget > 0 ? Math.round((summary.expenses / totalBudget) * 100) : 0;
  const financialHealth = totalBudget > 0 ? Math.max(0, 100 - budgetUsage) : (summary.balance >= 0 ? 100 : 35);
  const score = Math.round((habitsConsistency * 0.6) + (financialHealth * 0.4));

  const stats = [
    { label: 'Hábitos ativos', value: String(activeHabits) },
    { label: 'Melhor streak', value: `🔥 ${bestStreak}` },
    { label: 'Score', value: String(score) },
  ];

  const monthSummary = [
    { label: 'Poupança', value: `${summary.balance.toFixed(0)}€`, sub: `${summary.income.toFixed(0)}€ receitas`, color: summary.balance >= 0 ? colors.success : colors.error },
    { label: 'Gastos', value: `${summary.expenses.toFixed(0)}€`, sub: totalBudget > 0 ? `de ${totalBudget.toFixed(0)}€` : 'Sem orçamento', color: colors.error },
    { label: 'Hábitos', value: `${habitsConsistency}%`, sub: todayHabits.length > 0 ? 'consistência hoje' : 'sem hábitos hoje', color: colors.primary },
  ];

  const settingsGroups = useMemo(() => [
    {
      title: 'Conta',
      items: [
        { emoji: '👤', label: 'Editar perfil', sub: 'Nome e frase', arrow: true, onPress: () => setEditVisible(true) },
        { emoji: '🔔', label: 'Notificações', sub: 'Lembretes ativos', arrow: true },
        { emoji: '🔒', label: 'Privacidade', sub: 'Dados e segurança', arrow: true },
        { emoji: '🔔', label: 'Testar notificação', sub: 'Recebe um teste em 3 segundos', arrow: true, onPress: () => sendTestNotification({ emoji: '🌱', name: 'Momentum' }) },
        { emoji: '🔕', label: 'Cancelar todos os lembretes', sub: 'Remove notificações agendadas', arrow: true, onPress: () => cancelAllReminders() },
      ],
    },
    {
      title: 'Preferências',
      items: [
        { emoji: '💶', label: 'Moeda', sub: profile?.preferred_currency === 'EUR' ? 'Euro (€)' : profile?.preferred_currency || 'EUR', arrow: true },
        { emoji: '🌙', label: 'Tema escuro', toggle: true, value: false },
        { emoji: '📅', label: 'Início da semana', sub: profile?.week_starts_on === 1 ? 'Segunda-feira' : 'Personalizado', arrow: true },
      ],
    },
    {
      title: 'Dados',
      items: [
        { emoji: '📤', label: 'Exportar dados', sub: 'CSV ou JSON', arrow: true },
        { emoji: '🗑️', label: 'Apagar conta', sub: 'Apaga os teus dados da app', arrow: true, danger: true, onPress: handleDeleteAccount },
      ],
    },
  ], [profile]);

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
      {deletingAccount && (
        <View style={styles.deletingOverlay}>
          <View style={styles.deletingCard}>
            <ActivityIndicator color={colors.error} size="large" />
            <Text style={styles.deletingTitle}>A apagar conta</Text>
            <Text style={styles.deletingSub}>Estamos a remover os teus dados e a terminar a sessão.</Text>
          </View>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(profile?.name || 'U')[0].toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.avatarEdit} onPress={() => setEditVisible(true)}>
              <Text style={{ fontSize: 13 }}>✏️</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.profileName}>{profile?.name || 'Utilizador'}</Text>
          <Text style={styles.profileMotivation}>
            "{profile?.motivation || 'Consistência vence intensidade.'}"
          </Text>

          <View style={styles.statsRow}>
            {stats.map((item, index) => (
              <View key={item.label} style={styles.statItem}>
                <Text style={styles.statVal}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
                {index < stats.length - 1 && <View style={styles.statDivider} />}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {monthLabel(month).charAt(0).toUpperCase() + monthLabel(month).slice(1)}
          </Text>
          <View style={styles.monthRow}>
            {monthSummary.map((item) => (
              <View key={item.label} style={styles.monthStat}>
                <Text style={[styles.monthVal, { color: item.color }]}>{item.value}</Text>
                <Text style={styles.monthLabel}>{item.label}</Text>
                <Text style={styles.monthSub}>{item.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Metas ativas</Text>
          {goals.length === 0 ? (
            <EmptyCard
              emoji="🎯"
              title="Ainda não tens metas"
              sub="Quando criares uma meta de poupança, ela vai aparecer aqui."
            />
          ) : (
            goals.slice(0, 3).map((goal, index) => {
              const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
              return (
                <View key={goal.id} style={[styles.goalRow, index > 0 && { marginTop: 10 }]}>
                  <Text style={{ fontSize: 22 }}>{goal.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalName}>{goal.name}</Text>
                    <View style={styles.goalTrack}>
                      <View
                        style={[
                          styles.goalFill,
                          {
                            width: `${percent}%`,
                            backgroundColor: percent >= 80 ? colors.success : colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={[styles.goalPercent, percent >= 80 && { color: colors.success }]}>{percent}%</Text>
                </View>
              );
            })
          )}
        </View>

        {settingsGroups.map((group) => (
          <View key={group.title}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.settingsCard}>
              {group.items.map((item, index) => (
                <View key={item.label}>
                  <SettingsRow item={item} />
                  {index < group.items.length - 1 && <View style={styles.settingsDivider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪  Terminar sessão</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Momentum v0.1.0 · Feito com 🌱</Text>
      </ScrollView>

      <EditProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSave={setProfile}
        currentName={profile?.name}
        currentMotivation={profile?.motivation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: 12, paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  profileCard: { backgroundColor: '#E8F5EE', borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', ...shadow.sm },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: '#fff' },
  avatarEdit: { position: 'absolute', bottom: 0, right: -4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  profileName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: colors.text },
  profileMotivation: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.primary, marginTop: 4, fontStyle: 'italic', textAlign: 'center' },
  statsRow: { flexDirection: 'row', marginTop: 20, width: '100%' },
  statItem: { flex: 1, alignItems: 'center', position: 'relative' },
  statVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.text },
  statLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, marginTop: 2, textAlign: 'center' },
  statDivider: { position: 'absolute', right: 0, top: '10%', height: '80%', width: 1, backgroundColor: 'rgba(0,0,0,0.08)' },

  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text, marginBottom: 14 },

  monthRow: { flexDirection: 'row' },
  monthStat: { flex: 1, alignItems: 'center' },
  monthVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18 },
  monthLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.text2, marginTop: 2 },
  monthSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, marginTop: 1, textAlign: 'center' },

  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.text, marginBottom: 6 },
  goalTrack: { height: 6, backgroundColor: colors.border, borderRadius: 100, overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 100 },
  goalPercent: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.primary, width: 36, textAlign: 'right' },

  groupTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  settingsCard: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, ...shadow.sm },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  settingsRowDanger: {},
  settingsIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsText: { flex: 1 },
  settingsLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.text },
  settingsSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, marginTop: 1 },
  chevron: { fontSize: 20, color: colors.text3 },
  settingsDivider: { height: 1, backgroundColor: colors.border },

  emptyCard: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text },
  emptySub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.text3, textAlign: 'center', lineHeight: 20 },

  logoutBtn: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', ...shadow.sm },
  logoutText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.error },
  version: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, textAlign: 'center', marginTop: 4 },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,20,20,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    padding: spacing.lg,
  },
  deletingCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 10,
    ...shadow.md,
  },
  deletingTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17, color: colors.text },
  deletingSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 20 },
});
