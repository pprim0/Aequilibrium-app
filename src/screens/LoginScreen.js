import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { signIn } from '../services/authService';
import { getOnboardingDraft, applyOnboardingDraftToUser } from '../services/onboardingService';
import { useShake } from '../utils/animations';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { translateX, shake } = useShake();

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Preenche todos os campos.');
      shake();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn({ email: email.trim(), password });
      navigation.replace('Main');
    } catch (e) {
      setError('Email ou password incorretos.');
      shake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logo}>
              <Text style={{ fontSize: 36, color: '#fff' }}>▲</Text>
            </View>
            <Text style={styles.appName}>Momentum</Text>
            <Text style={styles.tagline}>Bem-vindo de volta</Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.form, { transform: [{ translateX }] }]}>

            {error.length > 0 && (
              <View style={styles.errorBar}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

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
                placeholder="A tua password"
                placeholderTextColor={colors.text3}
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Esqueceste a password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>Entrar →</Text>
              }
            </TouchableOpacity>

          </Animated.View>

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Ainda não tens conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Criar conta</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: spacing.lg, gap: 32, justifyContent: 'center' },

  logoWrap: { alignItems: 'center', gap: 8 },
  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  appName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: colors.text, letterSpacing: -1 },
  tagline: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: colors.text2 },

  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, borderRadius: radius.sm, padding: 14, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, color: colors.text },

  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.primary },

  btnPrimary: { backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnPrimaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#fff' },

  errorBar: { backgroundColor: colors.errorPale, borderRadius: radius.sm, padding: 12 },
  errorText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: colors.error, textAlign: 'center' },

  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: colors.text2 },
  registerLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.primary },
});
