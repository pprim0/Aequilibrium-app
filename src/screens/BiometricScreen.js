import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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
      }
      navigation.replace('Main');
    } catch (error) {
      console.warn('Erro ao ativar biometria:', error);
      navigation.replace('Main');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setLoading(true);
    try {
      await setBiometricEnabled(false);
      navigation.replace('Main');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🔐</Text>
          </View>
          <Text style={styles.title}>Ativar biometria</Text>
          <Text style={styles.subtitle}>
            Entra no Momentum com Face ID ou Touch ID para um acesso mais rapido e seguro.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>O que vai acontecer</Text>
          <Text style={styles.cardText}>A app vai pedir autenticacao biometrica sempre que houver uma sessao ativa.</Text>
          <Text style={styles.cardText}>Podes alterar isto mais tarde nas definicoes.</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.disabledBtn]}
            onPress={handleEnable}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Ativar biometria</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, loading && styles.disabledBtn]}
            onPress={handleSkip}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>Agora nao</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: 32 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.primaryPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: { fontSize: 38 },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: colors.text2,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 10,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  cardText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: colors.text2,
    lineHeight: 21,
  },
  actions: { gap: 12, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  secondaryBtn: {
    backgroundColor: colors.card,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: colors.text2,
  },
  disabledBtn: { opacity: 0.7 },
});
