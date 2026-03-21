import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, shadow } from '../theme';
import { getTransactions, addTransaction, getMonthSummary, getBudget, getSpentByCategory } from '../store/finance';
import { getGoals } from '../store/goals';

// ── Helpers ───────────────────────────────────────────────

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

const CATEGORIES = [
  { name: 'Alimentação', emoji: '🛒' },
  { name: 'Casa', emoji: '🏠' },
  { name: 'Transporte', emoji: '🚗' },
  { name: 'Lazer', emoji: '🎭' },
  { name: 'Saúde', emoji: '❤️' },
  { name: 'Subscrições', emoji: '📱' },
  { name: 'Compras', emoji: '🛍️' },
  { name: 'Receita', emoji: '💼' },
  { name: 'Outros', emoji: '📦' },
];

// ── Mini componentes ──────────────────────────────────────

function ProgressBar({ percent, color = colors.primary, height = 8 }) {
  const safe = Math.min(percent, 100);
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

function SectionHeader({ title, action }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && <Text style={styles.seeAll}>{action}</Text>}
    </View>
  );
}

function TransactionRow({ tx }) {
  const isIncome = tx.type === 'income';
  return (
    <View style={styles.txRow}>
      <View style={[styles.txEmoji, { backgroundColor: isIncome ? colors.primaryPale : colors.bg }]}>
        <Text style={{ fontSize: 18 }}>{tx.emoji}</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txName}>{tx.description}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={styles.txMeta}>{tx.category} · {formatDate(tx.date)}</Text>
          {tx.recurring === 1 && (
            <Badge label="↻" color={colors.info} bg={colors.infoPale} />
          )}
        </View>
      </View>
      <Text style={[styles.txAmount, { color: isIncome ? colors.success : colors.error }]}>
        {isIncome ? '+' : '-'}{tx.amount}€
      </Text>
    </View>
  );
}

function CategoryRow({ cat, spent }) {
  const percent = cat.amount > 0 ? Math.round((spent / cat.amount) * 100) : 0;
  return (
    <View style={styles.catRow}>
      <Text style={{ fontSize: 20, width: 28 }}>{cat.emoji}</Text>
      <View style={styles.catInfo}>
        <View style={styles.catNameRow}>
          <Text style={styles.catName}>{cat.category}</Text>
          <Text style={styles.catAmt}>{spent || 0}€ / {cat.amount}€</Text>
        </View>
        <ProgressBar percent={percent} height={6} />
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

// ── Modal Adicionar Movimento ─────────────────────────────

function AddTransactionModal({ visible, onClose, onSave }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredCats = type === 'income'
    ? CATEGORIES.filter(c => c.name === 'Receita' || c.name === 'Outros')
    : CATEGORIES.filter(c => c.name !== 'Receita');

  async function handleSave() {
    if (!amount || isNaN(parseFloat(amount))) return;
    setSaving(true);
    try {
      const cat = CATEGORIES.find(c => c.name === category);
      await onSave({
        type,
        amount: parseFloat(amount),
        category,
        description: description || category,
        date: new Date().toISOString().split('T')[0],
        recurring: false,
        emoji: cat?.emoji || '📦',
      });
      setAmount('');
      setDescription('');
      setCategory('Alimentação');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>

          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Novo movimento</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.modalSave, saving && { opacity: 0.5 }]}>Guardar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>

            {/* Toggle tipo */}
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpense]}
                onPress={() => { setType('expense'); setCategory('Alimentação'); }}
              >
                <Text style={[styles.typeBtnText, type === 'expense' && { color: '#fff' }]}>Despesa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'income' && styles.typeBtnIncome]}
                onPress={() => { setType('income'); setCategory('Receita'); }}
              >
                <Text style={[styles.typeBtnText, type === 'income' && { color: '#fff' }]}>Receita</Text>
              </TouchableOpacity>
            </View>

            {/* Valor */}
            <View style={styles.amountWrap}>
              <Text style={styles.currencySymbol}>€</Text>
              <TextInput
                style={[styles.amountInput, { color: type === 'expense' ? colors.error : colors.success }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.text3}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {/* Categoria */}
            <Text style={styles.inputLabel}>Categoria</Text>
            <View style={styles.catGrid}>
              {filteredCats.map(c => (
                <TouchableOpacity
                  key={c.name}
                  style={[styles.catChip, category === c.name && styles.catChipActive]}
                  onPress={() => setCategory(c.name)}
                >
                  <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                  <Text style={[styles.catChipLabel, category === c.name && { color: '#fff' }]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Descrição */}
            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ex: Supermercado Continente"
              placeholderTextColor={colors.text3}
            />

          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Screen principal ──────────────────────────────────────

export default function FinanceScreen() {
  const [tab, setTab] = useState('Resumo');
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expenses: 0, balance: 0 });
  const [budget, setBudget] = useState([]);
  const [spentByCategory, setSpentByCategory] = useState({});
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const tabs = ['Resumo', 'Transações', 'Orçamento', 'Metas'];
  const month = currentMonth();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      setLoading(true);
      const [txs, sum, bud, spent, gls] = await Promise.all([
        getTransactions(month),
        getMonthSummary(month),
        getBudget(),
        getSpentByCategory(month),
        getGoals(),
      ]);

      setTransactions(txs);
      setSummary(sum);
      setBudget(bud);
      setGoals(gls);

      const spentMap = {};
      spent.forEach(s => { spentMap[s.category] = s.total; });
      setSpentByCategory(spentMap);
    } catch (e) {
      console.error('Erro ao carregar finanças:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTransaction(tx) {
    await addTransaction(tx);
    await loadData();
  }

  const budgetPercent = summary.expenses > 0 && budget.length > 0
    ? Math.round((summary.expenses / budget.reduce((a, b) => a + b.amount, 0)) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Finanças</Text>
        <View style={[styles.badge, { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }]}>
          <Text style={[styles.badgeText, { color: colors.text2 }]}>
            {new Date().toLocaleString('pt-PT', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {tabs.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── RESUMO ── */}
          {tab === 'Resumo' && (
            <>
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Saldo do mês</Text>
                <Text style={styles.balanceAmount}>
                  {summary.balance >= 0 ? '+' : ''}{summary.balance.toFixed(0)}€
                </Text>
                <View style={styles.balanceRow}>
                  <View>
                    <Text style={styles.balanceSubLabel}>Receitas</Text>
                    <Text style={[styles.balanceSubVal, { color: '#7DC9A8' }]}>+{summary.income}€</Text>
                  </View>
                  <View>
                    <Text style={styles.balanceSubLabel}>Despesas</Text>
                    <Text style={[styles.balanceSubVal, { color: '#F4A4A4' }]}>-{summary.expenses}€</Text>
                  </View>
                  <View>
                    <Text style={styles.balanceSubLabel}>Poupança</Text>
                    <Text style={[styles.balanceSubVal, { color: 'rgba(255,255,255,0.8)' }]}>
                      {(summary.income - summary.expenses).toFixed(0)}€
                    </Text>
                  </View>
                </View>
              </View>

              {budget.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Orçamento mensal</Text>
                    <Badge
                      label={budgetPercent >= 90 ? '⚠️ Atenção' : 'Dentro do limite'}
                      color={budgetPercent >= 90 ? colors.error : colors.primary}
                      bg={budgetPercent >= 90 ? colors.errorPale : colors.primaryPale}
                    />
                  </View>
                  <View style={styles.budgetRow}>
                    <Text style={styles.budgetText}>{summary.expenses}€ usados</Text>
                    <Text style={styles.budgetPercent}>{budgetPercent}%</Text>
                  </View>
                  <ProgressBar percent={budgetPercent} />
                </View>
              )}

              {transactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>💸</Text>
                  <Text style={styles.emptyTitle}>Ainda não há movimentos</Text>
                  <Text style={styles.emptySub}>Regista a tua primeira despesa ou receita.</Text>
                </View>
              ) : (
                <View style={styles.card}>
                  <SectionHeader title="Transações recentes" />
                  {transactions.slice(0, 5).map((tx, i) => (
                    <View key={tx.id}>
                      <TransactionRow tx={tx} />
                      {i < Math.min(transactions.length, 5) - 1 && <View style={styles.txDivider} />}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* ── TRANSAÇÕES ── */}
          {tab === 'Transações' && (
            transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🧾</Text>
                <Text style={styles.emptyTitle}>Sem transações</Text>
                <Text style={styles.emptySub}>Adiciona o primeiro movimento com o botão +</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <SectionHeader title={`${transactions.length} movimentos`} />
                {transactions.map((tx, i) => (
                  <View key={tx.id}>
                    <TransactionRow tx={tx} />
                    {i < transactions.length - 1 && <View style={styles.txDivider} />}
                  </View>
                ))}
              </View>
            )
          )}

          {/* ── ORÇAMENTO ── */}
          {tab === 'Orçamento' && (
            <>
              <View style={styles.card}>
                <View style={styles.budgetRow}>
                  <Text style={styles.budgetText}>Total gasto: {summary.expenses}€</Text>
                  <Text style={styles.budgetPercent}>{budgetPercent}%</Text>
                </View>
                <ProgressBar percent={budgetPercent} height={10} />
              </View>
              <View style={styles.card}>
                <SectionHeader title="Por categoria" />
                {budget.map((cat, i) => (
                  <View key={cat.category}>
                    <CategoryRow cat={cat} spent={spentByCategory[cat.category] || 0} />
                    {i < budget.length - 1 && <View style={styles.txDivider} />}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── METAS ── */}
          {tab === 'Metas' && (
            <>
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Poupança acumulada</Text>
                <Text style={styles.balanceAmount}>
                  {goals.reduce((a, g) => a + g.current, 0)}€
                </Text>
                <Text style={[styles.balanceSubLabel, { marginTop: 4 }]}>
                  em {goals.length} metas ativas
                </Text>
              </View>
              {goals.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🎯</Text>
                  <Text style={styles.emptyTitle}>Sem metas ainda</Text>
                  <Text style={styles.emptySub}>Cria a tua primeira meta de poupança.</Text>
                </View>
              ) : (
                goals.map(g => <GoalCard key={g.id} goal={g} />)
              )}
              <TouchableOpacity style={styles.addCatBtn}>
                <Text style={styles.addCatText}>+ Criar nova meta</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => setModalVisible(true)}>
        <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32 }}>+</Text>
      </TouchableOpacity>

      {/* Modal */}
      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleAddTransaction}
      />

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: 12, paddingBottom: 100 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: 8 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: colors.text },

  tabScroll: { flexGrow: 0 },
  tabContent: { paddingHorizontal: spacing.md, gap: 8, paddingBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.text3 },
  tabLabelActive: { color: '#fff' },

  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text },
  seeAll: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.primary },

  progressTrack: { backgroundColor: colors.border, borderRadius: 100, overflow: 'hidden' },
  progressFill: { borderRadius: 100 },

  balanceCard: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, ...shadow.md },
  balanceLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  balanceAmount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 36, color: '#fff', letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  balanceSubLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  balanceSubVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, marginTop: 2 },

  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  budgetText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.text2 },
  budgetPercent: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.primary },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  txEmoji: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.text },
  txMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3 },
  txAmount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  txDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

  catRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  catInfo: { flex: 1 },
  catNameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.text },
  catAmt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.text },
  catWarning: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.error, marginTop: 4 },

  goalCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  goalInfo: { flex: 1 },
  goalName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text },
  goalMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, marginTop: 2 },
  goalPercent: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.primary },

  addCatBtn: { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  addCatText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.primary },

  fab: { position: 'absolute', bottom: 90, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.md },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIcon: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: colors.text },
  emptySub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.text3, textAlign: 'center', maxWidth: 260, lineHeight: 21 },

  // Modal
  modalSafe: { flex: 1, backgroundColor: colors.card },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: colors.text },
  modalCancel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: colors.text3 },
  modalSave: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.primary },
  modalContent: { padding: spacing.md, gap: 16 },

  typeToggle: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 100, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 100, alignItems: 'center' },
  typeBtnExpense: { backgroundColor: colors.error },
  typeBtnIncome: { backgroundColor: colors.success },
  typeBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.text2 },

  amountWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  currencySymbol: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, color: colors.text3, marginRight: 4 },
  amountInput: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 56, minWidth: 120, textAlign: 'center' },

  inputLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.text2 },

  input: { backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.border, borderRadius: radius.sm, padding: 14, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: colors.text },
});