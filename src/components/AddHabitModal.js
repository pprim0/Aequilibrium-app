import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import { createHabit } from '../store/habits';

// ── Opções ────────────────────────────────────────────────

const EMOJIS = ['💧','🏃','📚','🍳','🌙','🧘','🚶','🎓','📝','💪','🥗','☕','🎯','🌱','❤️','🎨','🎵','💊'];

const COLORS = [
  { bg: '#E8F5EE', label: 'Verde' },
  { bg: '#FEF3C7', label: 'Amarelo' },
  { bg: '#FFE8E8', label: 'Rosa' },
  { bg: '#E8F1FB', label: 'Azul' },
  { bg: '#F5F0FF', label: 'Roxo' },
  { bg: '#FFF0E8', label: 'Laranja' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Todos os dias' },
  { value: 'weekdays', label: 'Seg – Sex' },
  { value: 'weekends', label: 'Fins de semana' },
  { value: '3x', label: '3x por semana' },
];

const TIMES = ['06:00','07:00','08:00','09:00','12:00','13:00','17:00','18:00','19:00','20:00','21:00','22:00'];

const SUGGESTIONS = [
  { name: 'Beber 2L de água', emoji: '💧', color: '#E8F5EE' },
  { name: 'Exercício', emoji: '🏃', color: '#FFE8E8' },
  { name: 'Ler 10 minutos', emoji: '📚', color: '#E8F1FB' },
  { name: 'Cozinhar em casa', emoji: '🍳', color: '#FEF3C7' },
  { name: 'Meditar', emoji: '🧘', color: '#F5F0FF' },
  { name: 'Dormir cedo', emoji: '🌙', color: '#E8F5EE' },
];

// ── Componentes internos ──────────────────────────────────

function StepIndicator({ current, total }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.stepDot, i < current && styles.stepDotActive, i === current - 1 && styles.stepDotCurrent]}
        />
      ))}
    </View>
  );
}

function OptionChip({ label, selected, onPress, emoji }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {emoji && <Text style={{ fontSize: 14 }}>{emoji}</Text>}
      <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Modal principal ───────────────────────────────────────

export default function AddHabitModal({ visible, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 3;

  // Campos
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✅');
  const [color, setColor] = useState('#E8F5EE');
  const [frequency, setFrequency] = useState('daily');
  const [time, setTime] = useState('08:00');
  const [saving, setSaving] = useState(false);

  function reset() {
    setStep(1);
    setName('');
    setEmoji('✅');
    setColor('#E8F5EE');
    setFrequency('daily');
    setTime('08:00');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function applySuggestion(s) {
    setName(s.name);
    setEmoji(s.emoji);
    setColor(s.color);
  }

  function canAdvance() {
    if (step === 1) return name.trim().length > 0;
    return true;
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createHabit({ name: name.trim(), emoji, color, frequency, time });
      onSave();
      handleClose();
    } catch (e) {
      console.error('Erro ao criar hábito:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.cancelBtn}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Novo hábito</Text>
            <StepIndicator current={step} total={TOTAL_STEPS} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── STEP 1 — Nome e emoji ── */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Como se chama o hábito?</Text>
                <Text style={styles.stepSub}>Dá um nome claro e direto.</Text>

                {/* Preview */}
                <View style={[styles.preview, { backgroundColor: color }]}>
                  <Text style={styles.previewEmoji}>{emoji}</Text>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {name || 'O teu hábito'}
                  </Text>
                </View>

                {/* Input nome */}
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex: Beber 2L de água"
                  placeholderTextColor={colors.text3}
                  autoFocus
                  maxLength={40}
                />
                <Text style={styles.charCount}>{name.length}/40</Text>

                {/* Sugestões */}
                <Text style={styles.sectionLabel}>Sugestões</Text>
                <View style={styles.suggestionsGrid}>
                  {SUGGESTIONS.map(s => (
                    <TouchableOpacity
                      key={s.name}
                      style={[styles.suggestionCard, { backgroundColor: s.color }]}
                      onPress={() => applySuggestion(s)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
                      <Text style={styles.suggestionLabel}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Picker emoji */}
                <Text style={styles.sectionLabel}>Ícone</Text>
                <View style={styles.emojiGrid}>
                  {EMOJIS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
                      onPress={() => setEmoji(e)}
                    >
                      <Text style={{ fontSize: 22 }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Picker cor */}
                <Text style={styles.sectionLabel}>Cor</Text>
                <View style={styles.colorRow}>
                  {COLORS.map(c => (
                    <TouchableOpacity
                      key={c.bg}
                      style={[styles.colorDot, { backgroundColor: c.bg }, color === c.bg && styles.colorDotActive]}
                      onPress={() => setColor(c.bg)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* ── STEP 2 — Frequência ── */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Com que frequência?</Text>
                <Text style={styles.stepSub}>Escolhe a regularidade do hábito.</Text>

                {/* Preview */}
                <View style={[styles.preview, { backgroundColor: color }]}>
                  <Text style={styles.previewEmoji}>{emoji}</Text>
                  <Text style={styles.previewName}>{name}</Text>
                </View>

                <View style={styles.optionList}>
                  {FREQUENCIES.map(f => (
                    <TouchableOpacity
                      key={f.value}
                      style={[styles.optionRow, frequency === f.value && styles.optionRowActive]}
                      onPress={() => setFrequency(f.value)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionRadio}>
                        {frequency === f.value && <View style={styles.optionRadioDot} />}
                      </View>
                      <Text style={[styles.optionLabel, frequency === f.value && styles.optionLabelActive]}>
                        {f.label}
                      </Text>
                      {frequency === f.value && <Text style={{ color: colors.primary }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── STEP 3 — Hora ── */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>A que horas?</Text>
                <Text style={styles.stepSub}>Escolhe a hora do lembrete.</Text>

                {/* Preview */}
                <View style={[styles.preview, { backgroundColor: color }]}>
                  <Text style={styles.previewEmoji}>{emoji}</Text>
                  <View>
                    <Text style={styles.previewName}>{name}</Text>
                    <Text style={styles.previewMeta}>
                      {FREQUENCIES.find(f => f.value === frequency)?.label} · {time}
                    </Text>
                  </View>
                </View>

                {/* Time grid */}
                <Text style={styles.sectionLabel}>Hora do lembrete</Text>
                <View style={styles.timeGrid}>
                  {TIMES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.timeChip, time === t && styles.timeChipActive]}
                      onPress={() => setTime(t)}
                    >
                      <Text style={[styles.timeChipLabel, time === t && styles.timeChipLabelActive]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Resumo final */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Resumo do hábito</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Nome</Text>
                    <Text style={styles.summaryValue}>{name}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Frequência</Text>
                    <Text style={styles.summaryValue}>{FREQUENCIES.find(f => f.value === frequency)?.label}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Hora</Text>
                    <Text style={styles.summaryValue}>{time}</Text>
                  </View>
                </View>
              </View>
            )}

          </ScrollView>

          {/* Footer com botões */}
          <View style={styles.footer}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setStep(s => s - 1)}
              >
                <Text style={styles.backBtnText}>← Voltar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.nextBtn, !canAdvance() && styles.nextBtnDisabled]}
              onPress={step === TOTAL_STEPS ? handleSave : () => setStep(s => s + 1)}
              disabled={!canAdvance() || saving}
              activeOpacity={0.8}
            >
              <Text style={styles.nextBtnText}>
                {saving ? 'A guardar...' : step === TOTAL_STEPS ? '🌱 Criar hábito' : 'Continuar →'}
              </Text>
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: colors.text },
  cancelBtn: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: colors.text3 },

  // Step indicator
  stepRow: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 20, height: 4, borderRadius: 2, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.primaryLight },
  stepDotCurrent: { backgroundColor: colors.primary },

  // Content
  content: { padding: spacing.md, paddingBottom: 32 },
  stepContent: { gap: 16 },
  stepTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: colors.text },
  stepSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.text2, marginTop: -8 },

  // Preview
  preview: { borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewEmoji: { fontSize: 32 },
  previewName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.text, flex: 1 },
  previewMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text2, marginTop: 2 },

  // Input
  input: { backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.border, borderRadius: radius.sm, padding: 14, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: colors.text },
  charCount: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, textAlign: 'right', marginTop: -8 },

  sectionLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Suggestions
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionCard: { borderRadius: radius.sm, padding: 12, alignItems: 'center', gap: 6, width: '30%' },
  suggestionLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: colors.text, textAlign: 'center' },

  // Emoji picker
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderWidth: 2, borderColor: 'transparent' },
  emojiBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },

  // Color picker
  colorRow: { flexDirection: 'row', gap: 12 },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'transparent' },
  colorDotActive: { borderColor: colors.primary },

  // Frequency options
  optionList: { gap: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: radius.sm, padding: 16, borderWidth: 2, borderColor: 'transparent' },
  optionRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
  optionRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: colors.text2, flex: 1 },
  optionLabelActive: { color: colors.primary },

  // Chip genérico
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
  chipLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.text2 },
  chipLabelActive: { color: colors.primary },

  // Time grid
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: colors.bg, borderWidth: 2, borderColor: 'transparent' },
  timeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
  timeChipLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.text2 },
  timeChipLabelActive: { color: colors.primary },

  // Summary
  summaryCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, gap: 10 },
  summaryTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.text2 },
  summaryValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.text },

  // Footer
  footer: { flexDirection: 'row', gap: 10, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  backBtn: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 100, backgroundColor: colors.bg },
  backBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text2 },
  nextBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#fff' },
});