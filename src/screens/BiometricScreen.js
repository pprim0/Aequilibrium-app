import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { setBiometricEnabled, authenticateWithBiometrics } from '../utils/biometrics';

export default function BiometricScreen({ navigation }) {
  const [loading, setLoading] = useState(false);

  async function handleEnable() {
    setLoading(true);
    try {
      const success = await authenticateWithBiometrics();
      if (success) {
        await setBiometricEnabled(true);
        navigation.replace('Main');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await setBiometricEnabled(false);
    navigation.replace('Main');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>

        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔒</Text>
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>Ativar desbloqueio biométrico</Text>
          <Text style={styles.sub}>
            Usa o Face ID ou Touch ID para entrar no Momentum de forma rápida e segura.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.featureRow}>
            <Text style={{ fontSize: 20 }}>⚡</Text>
            <Text style={styles.featureText}>Acesso instantâneo sem password</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={{ fontSize: 20 }}>🛡️</Text>
            <Text style={styles.featureText}>Os teus dados ficam protegidos</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={{ fontSize: 20 }}>📱</Text>
            <Text style={styles.featureText}>Usa Face ID ou Touch ID do teu iPhone</Text>
          </View>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
            onPress={handleEnable}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>
              {loading ? 'A verificar...' : '🔒 Ativar Face ID / Touch ID'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSkip} onPress={handleSkip}>
            <Text style={styles.btnSkipText}>Agora não</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: 32 },

  iconWrap: { alignItems: 'center' },
  icon: { fontSize: 64 },

  textWrap: { gap: 10, alignItems: 'center' },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: colors.text, textAlign: 'center' },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: colors.text2, textAlign: 'center', lineHeight: 22 },

  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.text, flex: 1 },

  buttons: { gap: 12 },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#fff' },
  btnSkip: { paddingVertical: 12, alignItems: 'center' },
  btnSkipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: colors.text3 },
});
