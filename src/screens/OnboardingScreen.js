import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOALS = [
  { emoji: '🌱', label: 'Criar melhores hábitos' },
  { emoji: '📅', label: 'Organizar a rotina' },
  { emoji: '💸', label: 'Controlar gastos' },
  { emoji: '🏦', label: 'Poupar mais' },
  { emoji: '🎯', label: 'Melhorar a disciplina' },
  { emoji: '🔭', label: 'Visão geral da vida' },
];

const HABIT_SUGGESTIONS = [
  { emoji: '💧', label: 'Beber água' },
  { emoji: '🏃', label: 'Exercício' },
  { emoji: '📚', label: 'Ler' },
  { emoji: '🌙', label: 'Dormir cedo' },
  { emoji: '🧘', label: 'Meditar' },
  { emoji: '🍳', label: 'Cozinhar em casa' },
  { emoji: '📝', label: 'Registar despesas' },
  { emoji: '🚶', label: 'Caminhar' },
  { emoji: '🎓', label: 'Estudar' },
  { emoji: '📋', label: 'Planear o dia' },
];

const CATEGORIES = [
  { emoji: '🏠', label: 'Casa' },
  { emoji: '🛒', label: 'Alimentação' },
  { emoji: '🚗', label: 'Transporte' },
  { emoji: '🎭', label: 'Lazer' },
  { emoji: '❤️', label: 'Saúde' },
  { emoji: '📱', label: 'Subscrições' },
];

function ProgressBar({ step, total }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.progressSegment, i < step && styles.progressSegmentActive]} />
      ))}
    </View>
  );
}

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const TOTAL = 4;

  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedHabits, setSelectedHabits] = useState([]);
  const [income, setIncome] = useState('');
  const [budget, setBudget] = useState('');
  const [savings, setSavings] = useState('');
  const [selectedCats, setSelectedCats] = useState(['Alimentação', 'Casa', 'Transporte']);

  function toggleHabit(label) {
    setSelectedHabits(prev =>
      prev.includes(label) ? prev.filter(h => h !== label) : [...prev, label]
    );
  }

  function toggleCat(label) {
    setSelectedCats(prev =>
      prev.includes(label) ? prev.filter(c => c !== label) : [...prev, label]
    );
  }

  async function finish() {
    await AsyncStorage.setItem('onboarding_done', 'true');
    navigation.replace('Login');
  }


  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={styles.header}>
        {step > 1 ? (
          <TouchableOpacity onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 32 }} />}
        <ProgressBar step={step} total={TOTAL} />
        <Text style={styles.stepLabel}>{step}/{TOTAL}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* STEP 1 — Objetivo */}
        {step === 1 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>O que queres melhorar?</Text>
            <Text style={styles.stepSub}>Escolhe o teu objetivo principal.</Text>
            <View style={styles.goalGrid}>
              {GOALS.map(g => (
                <TouchableOpacity
                  key={g.label}
                  style={[styles.goalCard, selectedGoal === g.label && styles.goalCardActive]}
                  onPress={() => setSelectedGoal(g.label)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.goalEmoji}>{g.emoji}</Text>
                  <Text style={[styles.goalLabel, selectedGoal === g.label && styles.goalLabelActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* STEP 2 — Hábitos */}
        {step === 2 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>Escolhe os teus hábitos</Text>
            <Text style={styles.stepSub}>Seleciona entre 3 e 5 para começar.</Text>
            <View style={styles.chipWrap}>
              {HABIT_SUGGESTIONS.map(h => (
                <TouchableOpacity
                  key={h.label}
                  style={[styles.chip, selectedHabits.includes(h.label) && styles.chipActive]}
                  onPress={() => toggleHabit(h.label)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16 }}>{h.emoji}</Text>
                  <Text style={[styles.chipLabel, selectedHabits.includes(h.label) && styles.chipLabelActive]}>
                    {h.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedHabits.length > 0 && (
              <View style={styles.selectedWrap}>
                <Text style={styles.selectedTitle}>Selecionados ({selectedHabits.length})</Text>
                <View style={styles.chipWrap}>
                  {selectedHabits.map(h => (
                    <View key={h} style={[styles.chip, styles.chipActive]}>
                      <Text style={styles.chipLabelActive}>{h}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* STEP 3 — Finanças */}
        {step === 3 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>Configura as tuas finanças</Text>
            <Text style={styles.stepSub}>Só o essencial. Podes ajustar depois.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Rendimento mensal</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputPrefix}>€</Text>
                <TextInput
                  style={styles.input}
                  value={income}
                  onChangeText={setIncome}
                  placeholder="1.800"
                  placeholderTextColor={colors.text3}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Orçamento mensal</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputPrefix}>€</Text>
                <TextInput
                  style={styles.input}
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="1.200"
                  placeholderTextColor={colors.text3}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Meta de poupança mensal</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputPrefix}>€</Text>
                <TextInput
                  style={styles.input}
                  value={savings}
                  onChangeText={setSavings}
                  placeholder="300"
                  placeholderTextColor={colors.text3}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={[styles.inputLabel, { marginBottom: 10 }]}>Categorias principais</Text>
            <View style={styles.chipWrap}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.label}
                  style={[styles.chip, selectedCats.includes(c.label) && styles.chipActive]}
                  onPress={() => toggleCat(c.label)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                  <Text style={[styles.chipLabel, selectedCats.includes(c.label) && styles.chipLabelActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* STEP 4 — Resumo */}
        {step === 4 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>O teu sistema está pronto! 🎉</Text>
            <Text style={styles.stepSub}>Aqui está o que configuraste.</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summarySection}>🎯 Objetivo</Text>
              <Text style={styles.summaryValue}>{selectedGoal || 'Não definido'}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summarySection}>✅ Hábitos ({selectedHabits.length})</Text>
              <View style={styles.chipWrap}>
                {selectedHabits.map(h => (
                  <View key={h} style={[styles.chip, styles.chipActive]}>
                    <Text style={styles.chipLabelActive}>{h}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summarySection}>💶 Finanças</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Orçamento</Text>
                <Text style={styles.summaryVal}>{budget || '0'}€/mês</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Meta de poupança</Text>
                <Text style={styles.summaryVal}>{savings || '0'}€/mês</Text>
              </View>
            </View>

            <View style={styles.motivationCard}>
              <Text style={styles.motivationText}>
                "A consistência é o caminho mais curto para o progresso."
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, step === 1 && !selectedGoal && styles.nextBtnDisabled]}
          onPress={step === TOTAL ? finish : () => setStep(s => s + 1)}
          disabled={step === 1 && !selectedGoal}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {step === TOTAL ? 'Entrar na app 🚀' : 'Continuar →'}
          </Text>
        </TouchableOpacity>
        {step < TOTAL && (
          <TouchableOpacity onPress={step === TOTAL ? finish : () => setStep(s => s + 1)}>
            <Text style={styles.skipBtn}>Saltar</Text>
          </TouchableOpacity>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md },
  backBtn: { fontSize: 22, color: colors.text2, width: 32 },
  progressRow: { flex: 1, flexDirection: 'row', gap: 6 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressSegmentActive: { backgroundColor: colors.primary },
  stepLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.text3 },

  content: { padding: spacing.md, paddingBottom: 32 },
  stepWrap: { gap: 20 },
  stepTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: colors.text },
  stepSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.text2, marginTop: -12 },

  // Goals
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalCard: { width: '47%', backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 8, borderWidth: 2, borderColor: colors.border },
  goalCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
  goalEmoji: { fontSize: 26 },
  goalLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.text, lineHeight: 18 },
  goalLabelActive: { color: colors.primary },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
  chipLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.text2 },
  chipLabelActive: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.primary },

  selectedWrap: { backgroundColor: colors.primaryPale, borderRadius: radius.md, padding: 14, gap: 10 },
  selectedTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Finance inputs
  inputGroup: { gap: 6 },
  inputLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 14 },
  inputPrefix: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: colors.text3, marginRight: 6 },
  input: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: colors.text, paddingVertical: 14 },

  // Summary
  summaryCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 10 },
  summarySection: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.text2 },
  summaryVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.text },
  summaryValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.primary },

  motivationCard: { backgroundColor: colors.primary, borderRadius: radius.md, padding: 20 },
  motivationText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 24, fontStyle: 'italic', textAlign: 'center' },

  // Footer
  footer: { padding: spacing.md, gap: 8 },
  nextBtn: { backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#fff' },
  skipBtn: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.text3, textAlign: 'center', paddingVertical: 4 },
});