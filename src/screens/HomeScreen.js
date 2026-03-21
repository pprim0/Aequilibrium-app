import { View, Text } from 'react-native';
import { colors } from '../theme';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: colors.text }}>Home</Text>
    </View>
  );
}