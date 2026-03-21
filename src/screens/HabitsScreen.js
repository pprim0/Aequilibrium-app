import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius, shadow } from '../theme';
import { getTodayHabits, toggleHabit } from '../store/habits';
import AddHabitModal from '../components/AddHabitModal';

// ── Helpers ───────────────────────────────────────────────

const WEEK_LABELS = ['S', 'D', 'S', 'T', 'T', 'Q', 'S'];

function getWeekDays() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - dayOfWeek + i);
        return { label: WEEK_LABELS[i], day: d.getDate(), isToday: i === dayOfWeek };
    });
}

// ── Mini componentes ──────────────────────────────────────

function WeekStrip() {
    const days = getWeekDays();
    return (
        <View style={styles.weekStrip}>
            {days.map((d, i) => (
                <View key={i} style={styles.weekDay}>
                    <Text style={[styles.weekLabel, d.isToday && styles.weekLabelActive]}>
                        {d.label}
                    </Text>
                    <View style={[styles.weekCircle, d.isToday && styles.weekCircleActive]}>
                        <Text style={[styles.weekNum, d.isToday && styles.weekNumActive]}>
                            {d.day}
                        </Text>
                    </View>
                    <View style={[
                        styles.weekDot,
                        { backgroundColor: d.isToday ? colors.border : i < days.findIndex(x => x.isToday) ? colors.primary : 'transparent' }
                    ]} />
                </View>
            ))}
        </View>
    );
}

function SummaryBar({ total, done }) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
        <View style={styles.summaryBar}>
            <View style={styles.summaryStat}>
                <Text style={styles.summaryVal}>{done}/{total}</Text>
                <Text style={styles.summaryLabel}>Concluídos</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
                <Text style={[styles.summaryVal, { color: pct >= 60 ? colors.primary : colors.warning }]}>
                    {pct}%
                </Text>
                <Text style={styles.summaryLabel}>Consistência</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
                <Text style={styles.summaryVal}>🔥 {done > 0 ? done : 0}</Text>
                <Text style={styles.summaryLabel}>Hoje</Text>
            </View>
        </View>
    );
}

function HabitCard({ habit, onToggle, onEdit }) {
    const [pressing, setPressing] = useState(false);

    return (
        <TouchableOpacity
            style={[styles.habitCard, habit.done && styles.habitCardDone, pressing && styles.habitCardPress]}
            activeOpacity={0.85}
            onPressIn={() => setPressing(true)}
            onPressOut={() => setPressing(false)}
            onPress={() => onToggle(habit.id)}
            onLongPress={() => onEdit(habit)}
            delayLongPress={400}
        >
            <View style={[styles.habitEmoji, { backgroundColor: habit.done ? colors.primary : habit.color }]}>
                <Text style={{ fontSize: 22 }}>{habit.emoji}</Text>
            </View>

            <View style={styles.habitInfo}>
                <Text style={[styles.habitName, habit.done && styles.habitNameDone]}>
                    {habit.name}
                </Text>
                <Text style={styles.habitMeta}>
                    {habit.time} · {habit.frequency === 'daily' ? 'Todos os dias' : habit.frequency === 'weekdays' ? 'Seg–Sex' : habit.frequency}
                </Text>
            </View>

            <View style={styles.habitRight}>
                <Text style={styles.habitStreak}>🔥 {habit.streak}</Text>
                <View style={[styles.habitCheck, habit.done && styles.habitCheckDone]}>
                    {habit.done && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                </View>
            </View>

            {/* Indicador de long press */}
            <View style={styles.editHint}>
                <Text style={styles.editHintText}>···</Text>
            </View>
        </TouchableOpacity>
    );
}

function EmptyState() {
    return (
        <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text style={styles.emptyTitle}>Ainda não tens hábitos</Text>
            <Text style={styles.emptySub}>Cria o primeiro para começares a construir a tua rotina.</Text>
        </View>
    );
}

// ── Screen principal ──────────────────────────────────────

export default function HabitsScreen() {
    const [tab, setTab] = useState('Hoje');
    const [habits, setHabits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingHabit, setEditingHabit] = useState(null);

    const tabs = ['Hoje', 'Semana', 'Todos'];

    // Recarrega sempre que o ecrã fica em foco
    useFocusEffect(
        useCallback(() => {
            loadHabits();
        }, [])
    );

    async function loadHabits() {
        try {
            setLoading(true);
            const data = await getTodayHabits();
            setHabits(data);
        } catch (e) {
            console.error('Erro ao carregar hábitos:', e);
        } finally {
            setLoading(false);
        }
    }

    async function handleToggle(id) {
        // Atualiza UI imediatamente (optimistic update)
        setHabits(prev =>
            prev.map(h => h.id === id ? { ...h, done: !h.done, streak: h.done ? h.streak - 1 : h.streak + 1 } : h)
        );
        // Persiste na base de dados
        try {
            await toggleHabit(id);
        } catch (e) {
            console.error('Erro ao atualizar hábito:', e);
            // Reverte se falhar
            loadHabits();
        }
    }

    const done = habits.filter(h => h.done).length;

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Hábitos</Text>
                <TouchableOpacity style={styles.addBtn} activeOpacity={0.7} onPress={() => setModalVisible(true)}>
                    <Text style={styles.addBtnText}>+ Novo</Text>
                </TouchableOpacity>
            </View>

            {/* Week strip */}
            <WeekStrip />

            {/* Tabs */}
            <View style={styles.tabRow}>
                {tabs.map(t => (
                    <TouchableOpacity key={t} style={styles.tabItem} onPress={() => setTab(t)}>
                        <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
                        {tab === t && <View style={styles.tabUnderline} />}
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Summary */}
                    <SummaryBar total={habits.length} done={done} />

                    {/* Habit list ou empty state */}
                    {habits.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <View style={styles.habitList}>
                            {habits.map(h => (
                                <HabitCard
                                    key={h.id}
                                    habit={h}
                                    onToggle={handleToggle}
                                    onEdit={(habit) => {
                                        setEditingHabit(habit);
                                        setModalVisible(true);
                                    }}
                                />
                            ))}
                        </View>
                    )}

                    {/* Add habit */}
                    <TouchableOpacity style={styles.addHabitBtn} activeOpacity={0.7} onPress={() => setModalVisible(true)}>
                        <View style={styles.addHabitIcon}>
                            <Text style={{ color: colors.primary, fontSize: 20 }}>+</Text>
                        </View>
                        <Text style={styles.addHabitText}>Criar novo hábito</Text>
                    </TouchableOpacity>

                </ScrollView>
            )}
            <AddHabitModal
                visible={modalVisible}
                onClose={() => {
                    setModalVisible(false);
                    setEditingHabit(null);
                }}
                onSave={() => {
                    setModalVisible(false);
                    setEditingHabit(null);
                    loadHabits();
                }}
                editHabit={editingHabit}
            />
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
    addBtn: { backgroundColor: colors.primaryPale, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8 },
    addBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.primary },

    // Week
    weekStrip: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: 12, gap: 4 },
    weekDay: { flex: 1, alignItems: 'center', gap: 4 },
    weekLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.text3 },
    weekLabelActive: { color: colors.primary },
    weekCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    weekCircleActive: { backgroundColor: colors.primary },
    weekNum: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.text3 },
    weekNumActive: { color: '#fff' },
    weekDot: { width: 6, height: 6, borderRadius: 3 },

    // Tabs
    tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabItem: { marginRight: 4, alignItems: 'center' },
    tabLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.text3, paddingHorizontal: 12, paddingVertical: 10 },
    tabLabelActive: { color: colors.primary },
    tabUnderline: { height: 2, backgroundColor: colors.primary, borderRadius: 2, width: '100%', marginTop: -2 },

    // Loading
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Summary
    summaryBar: { backgroundColor: colors.card, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', padding: spacing.md, ...shadow.sm },
    summaryStat: { flex: 1, alignItems: 'center' },
    summaryVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.text },
    summaryLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, marginTop: 2 },
    summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },

    // Habit card
    habitList: { gap: 8 },
    habitCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow.sm },
    habitCardDone: { opacity: 0.65 },
    habitCardPress: { transform: [{ scale: 0.98 }] },
    habitEmoji: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    habitInfo: { flex: 1 },
    habitName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text },
    habitNameDone: { textDecorationLine: 'line-through', color: colors.text3 },
    habitMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, marginTop: 2 },
    habitRight: { alignItems: 'center', gap: 6 },
    habitStreak: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.warning },
    habitCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    habitCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },

    // Add habit or edit habit
    addHabitBtn: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
    addHabitIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center' },
    addHabitText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.primary },
    editHint: { position: 'absolute', top: 8, right: 12 },
    editHintText: { fontSize: 12, color: colors.text3, letterSpacing: 1 },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
    emptyIcon: { fontSize: 52, marginBottom: 8 },
    emptyTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: colors.text },
    emptySub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.text3, textAlign: 'center', maxWidth: 260, lineHeight: 21 },
});