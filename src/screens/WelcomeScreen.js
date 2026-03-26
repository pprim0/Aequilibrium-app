import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.bgCircle} />
        <View style={styles.logo}>
          <Text style={{ fontSize: 40, color: '#fff' }}>▲</Text>
        </View>
        <Text style={styles.headline}>Organiza a tua vida.{'\n'}Melhora as tuas finanças.</Text>
        <Text style={styles.sub}>O Momentum ajuda-te a construir hábitos, controlar gastos e perceber como um influencia o outro.</Text>

        {/* Mini preview */}
        <View style={styles.previewCard}>
          <View style={styles.previewRow}>
            <View style={styles.previewAvatar}>
              <Text style={{ fontSize: 18, color: '#fff', fontFamily: 'PlusJakartaSans_800ExtraBold' }}>M</Text>
            </View>
            <View>
              <Text style={styles.previewName}>Bom dia! 👋</Text>
              <Text style={styles.previewSub}>Streak de 7 dias 🔥</Text>
            </View>
          </View>
          <View style={styles.previewBar}>
            <View style={styles.previewFill} />
          </View>
          <View style={styles.previewFooter}>
            <Text style={styles.previewLabel}>Orçamento mensal</Text>
            <Text style={styles.previewValue}>720€ / 1.200€</Text>
          </View>
        </View>
      </View>

      {/* Botões */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Onboarding')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Começar →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>Já tenho conta</Text>
        </TouchableOpacity>
        <Text style={styles.disclaimer}>
          Sem ligação ao banco. Os teus dados ficam no teu dispositivo.
        </Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  hero: { flex: 1, backgroundColor: colors.primary, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative', overflow: 'hidden' },
  bgCircle: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -60, right: -60 },

  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

  headline: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, color: '#fff', textAlign: 'center', lineHeight: 34 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22, maxWidth: 280 },

  previewCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', gap: 12 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  previewName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#fff' },
  previewSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  previewBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  previewFill: { height: '100%', width: '60%', backgroundColor: colors.primaryLight, borderRadius: 3 },
  previewFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  previewLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  previewValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.primaryLight },

  buttons: { padding: spacing.lg, gap: 12 },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#fff' },
  btnSecondary: { borderRadius: 100, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: colors.border },
  btnSecondaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text2 },
  disclaimer: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, textAlign: 'center' },
});