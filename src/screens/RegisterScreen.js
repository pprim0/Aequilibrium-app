import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { signUp, getSession } from '../services/authService';
import { getOnboardingDraft, applyOnboardingDraftToUser } from '../services/onboardingService';
import { setBiometricEnabled, isBiometricAvailable } from '../utils/biometrics';
import { useShake } from '../utils/animations';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { translateX, shake } = useShake();

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Preenche todos os campos.');
      shake();
      return;
    }
    if (password !== confirmPassword) {
      setError('As passwords não coincidem.');
      shake();
      return;
    }
    if (password.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres.');
      shake();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signUp({ email: email.trim(), password, name: name.trim() });
      const biometricAvailable = await isBiometricAvailable();
      if (biometricAvailable) {
        navigation.replace('BiometricSetup');
      } else {
        navigation.replace('Main');
      }
    } catch (e) {
      setError(e.message || 'Erro ao criar conta. Tenta novamente.');
      shake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <View style={styles.logoWrap}>
              <View style={styles.logo}>
                <Text style={{ fontSize: 28, color: '#fff' }}>▲</Text>
              </View>
              <Text style={styles.appName}>Criar conta</Text>
              <Text style={styles.tagline}>Começa a tua jornada no Momentum</Text>
            </View>
          </View>

          <Animated.View style={[styles.form, { transform: [{ translateX }] }]}>

            {error.length > 0 && (
              <View style={styles.errorBar}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>O teu nome</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Pedro Ferreira"
                placeholderTextColor={colors.text3}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="o.teu@email.com"
                placeholderTextColor={colors.text3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.text3}
                secureTextEntry
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Confirmar password</Text>
              <TextInput
                style={[
                  styles.input,
                  confirmPassword.length > 0 && password !== confirmPassword && styles.inputError
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repete a password"
                placeholderTextColor={colors.text3}
                secureTextEntry
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={styles.fieldError}>As passwords não coincidem</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>Criar conta →</Text>
              }
            </TouchableOpacity>

          </Animated.View>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Já tens conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Entrar</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: spacing.lg, gap: 24 },

  header: { gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 20, color: colors.text2 },
  logoWrap: { alignItems: 'center', gap: 6 },
  logo: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  appName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: colors.text, letterSpacing: -0.5 },
  tagline: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.text2 },

  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, borderRadius: radius.sm, padding: 14, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, color: colors.text },
  inputError: { borderColor: colors.error },
  fieldError: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.error },

  btnPrimary: { backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnPrimaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#fff' },

  errorBar: { backgroundColor: colors.errorPale, borderRadius: radius.sm, padding: 12 },
  errorText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.error, textAlign: 'center' },

  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.text2 },
  loginLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.primary },
});
