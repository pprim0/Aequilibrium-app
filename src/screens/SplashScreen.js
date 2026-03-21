import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Welcome');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.logo}>
        <Text style={styles.logoIcon}>▲</Text>
      </View>
      <Text style={styles.name}>Momentum</Text>
      <Text style={styles.tagline}>Os teus hábitos moldam{'\n'}a tua vida e o teu dinheiro.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 0 },
  bgCircle1: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -80, left: -80 },
  bgCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: 60, right: -40 },
  logo: { width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 24 },
  logoIcon: { fontSize: 40, color: '#fff' },
  name: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 36, color: '#fff', letterSpacing: -1 },
  tagline: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginTop: 12, maxWidth: 240 },
});