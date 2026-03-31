import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { updateMyProfile } from '../services/profileService';

export default function EditProfileModal({ visible, onClose, onSave, currentName, currentMotivation }) {
  const [name, setName] = useState(currentName || '');
  const [motivation, setMotivation] = useState(currentMotivation || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(currentName || '');
      setMotivation(currentMotivation || '');
    }
  }, [visible, currentName, currentMotivation]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const profile = await updateMyProfile({
        name: name.trim(),
        motivation: motivation.trim(),
      });
      onSave(profile);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelBtn}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Editar perfil</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving || !name.trim()}>
              <Text style={[styles.saveBtn, (!name.trim() || saving) && { opacity: 0.4 }]}>
                Guardar
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {name.trim() ? name.trim()[0].toUpperCase() : '?'}
                </Text>
              </View>
              <Text style={styles.avatarHint}>O avatar é gerado automaticamente</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>O teu nome</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ex: Pedro Ferreira"
                placeholderTextColor={colors.text3}
                autoFocus
                maxLength={40}
              />
              <Text style={styles.charCount}>{name.length}/40</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Frase motivacional</Text>
              <Text style={styles.fieldSub}>Aparece no teu perfil como inspiração diária.</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={motivation}
                onChangeText={setMotivation}
                placeholder='"Consistência vence intensidade."'
                placeholderTextColor={colors.text3}
                multiline
                maxLength={100}
              />
              <Text style={styles.charCount}>{motivation.length}/100</Text>
            </View>

            {name.trim().length > 0 && (
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Pré-visualização</Text>
                <View style={styles.previewRow}>
                  <View style={styles.previewAvatar}>
                    <Text style={styles.previewAvatarText}>
                      {name.trim()[0].toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.previewName}>{name.trim()}</Text>
                    {motivation.trim().length > 0 && (
                      <Text style={styles.previewMotivation}>{motivation.trim()}</Text>
                    )}
                  </View>
                </View>
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: colors.text },
  cancelBtn: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: colors.text3 },
  saveBtn: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.primary },

  content: { padding: spacing.md, gap: 24 },

  avatarWrap: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.primaryPale },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 32, color: '#fff' },
  avatarHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3 },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8 },
  fieldSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.text3, marginTop: -2 },
  input: { backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.border, borderRadius: radius.sm, padding: 14, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: colors.text },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  charCount: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, textAlign: 'right' },

  previewCard: { backgroundColor: colors.primaryPale, borderRadius: radius.md, padding: spacing.md, gap: 10 },
  previewLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  previewAvatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: '#fff' },
  previewName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.text },
  previewMotivation: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.primary, marginTop: 2, fontStyle: 'italic' },
});
