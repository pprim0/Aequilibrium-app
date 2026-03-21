import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function AnimatedProgressBar({ percent, color = colors.primary, height = 8, delay = 0 }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const safe = Math.min(Math.max(percent, 0), 100);
  const barColor = percent >= 90 ? colors.error : percent >= 70 ? colors.warning : color;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: safe,
      duration: 800,
      delay,
      useNativeDriver: false,
    }).start();
  }, [safe]);

  const width = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.track, { height }]}>
      <Animated.View style={[styles.fill, { width, backgroundColor: barColor, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.border, borderRadius: 100, overflow: 'hidden' },
  fill: { borderRadius: 100 },
});