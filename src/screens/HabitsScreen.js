import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';

// ── Dados de exemplo ──────────────────────────────────────

const WEEK = ['S', 'D', 'S', 'T', 'T', 'Q', 'S'];
const WEEK_DAYS = [10, 11, 12, 13, 14, 15, 16];
const TODAY_INDEX = 4;

const habits = [
  { id: 1, emoji: '💧', name: 'Beber 2L de água', time: '08:00', freq: 'Todos os dias', streak: 6, done: true, color: colors.primaryPale },
  { id: 2, emoji: '🍳', name: 'Cozinhar em casa', time: '12:30', freq: 'Seg–Sex', streak: 4, done: true, color: '#FEF3C7' },
  { id: 3, emoji: '🏃', name: 'Exercício', time: '18:00', freq: '5x/semana', streak: 3, done: false, color: '#FFE8E8' },
  { id: 4, emoji: '📚', name: 'Ler 10 minutos', time: '21:00', freq: 'Todos os dias', streak: 2, done: false, color: colors.infoPale },
  { id: 5, emoji: '🌙', name: 'Dormir antes das 23h', time: '23:00', freq: 'Todos os dias', streak: 6, done: false, color: '#F5F0FF' },
];

// ── Mini componentes ──────────────────────────────────────

function WeekStrip() {
  return (
    <View style={styles.weekStrip}>
      {WEEK_DAYS.map((day, i) => {
        const isToday = i === TODAY_INDEX;
        return (
          <View key={i} style={styles.weekDay}>
            <Text style={[styles.weekLabel, isToday && styles.weekLabelActive]}>{WEEK[i]}</Text>
            <View style={[styles.weekCircle, isToday && styles.weekCircleActive]}>
              <Text style={[styles.weekNum, isToday && styles.weekNumActive]}>{day}</Text>
            </View>
            <View style={[styles.weekDot, { backgroundColor: i < TODAY_INDEX ? colors.primary : i === TODAY_INDEX ? colors.border : 'transparent' }]} />
          </View>
        );
      })}
    </View>
  );
}

function SummaryBar({ total, done }) {
  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryStat}>
        <Text style={styles.summaryVal}>{done}/{total}</Text>
        <Text style={styles.summaryLabel}>Concluídos</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryStat}>
        <Text style={[styles.summaryVal, { color: colors.warning }]}>{Math.round((done / total) * 100)}%</Text>
        <Text style={styles.summaryLabel}>Consistência</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryStat}>
        <Text style={styles.summaryVal}>🔥 6</Text>
        <Text style={styles.summaryLabel}>Streak</Text>
      </View>
    </View>
  );
}

function HabitCard({ habit, onToggle }) {
  return (
    <TouchableOpacity
      style={[styles.habitCard, habit.done && styles.habitCardDone]}
      activeOpacity={0.8}
      onPress={() => onToggle(habit.id)}
    >
      <View style={[styles.habitEmoji, { backgroundColor: habit.done ? colors.primary : habit.color }]}>
        <Text style={{ fontSize: 22 }}>{habit.emoji}</Text>
      </View>
      <View style={styles.habitInfo}>
        <Text style={[styles.habitName, habit.done && styles.habitNameDone]}>{habit.name}</Text>
        <Text style={styles.habitMeta}>{habit.time} · {habit.freq}</Text>
      </View>
      <View style={styles.habitRight}>
        <Text style={styles.habitStreak}>🔥 {habit.streak}</Text>
        <View style={[styles.habitCheck, habit.done && styles.habitCheckDone]}>
          {habit.done && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen principal ──────────────────────────────────────

export default function HabitsScreen() {
  const [tab, setTab] = useState('Hoje');
  const [habitList, setHabitList] = useState(habits);

  const tabs = ['Hoje', 'Semana', 'Todos'];
  const done = habitList.filter(h => h.done).length;

  function toggleHabit(id) {
    setHabitList(prev =>
      prev.map(h => h.id === id ? { ...h, done: !h.done } : h)
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Hábitos</Text>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.7}>
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <SummaryBar total={habitList.length} done={done} />

        {/* Habit list */}
        <View style={styles.habitList}>
          {habitList.map(h => (
            <HabitCard key={h.id} habit={h} onToggle={toggleHabit} />
          ))}
        </View>

        {/* Add habit */}
        <TouchableOpacity style={styles.addHabitBtn} activeOpacity={0.7}>
          <View style={styles.addHabitIcon}>
            <Text style={{ color: colors.primary, fontSize: 20 }}>+</Text>
          </View>
          <Text style={styles.addHabitText}>Criar novo hábito</Text>
        </TouchableOpacity>

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

  // Summary
  summaryBar: { backgroundColor: colors.card, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', padding: spacing.md, ...shadow.sm },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.text },
  summaryLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },

  // Habit card
  habitList: { gap: 8 },
  habitCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow.sm },
  habitCardDone: { opacity: 0.7 },
  habitEmoji: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  habitInfo: { flex: 1 },
  habitName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text },
  habitNameDone: { textDecorationLine: 'line-through', color: colors.text3 },
  habitMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, marginTop: 2 },
  habitRight: { alignItems: 'center', gap: 6 },
  habitStreak: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.warning },
  habitCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  habitCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },

  // Add habit
  addHabitBtn: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  addHabitIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center' },
  addHabitText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.primary },
});