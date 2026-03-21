import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { colors, radius, shadow, spacing } from '../theme';

function DeleteAction({ onDelete, dragX }) {
  const scale = dragX.interpolate({
    inputRange: [-80, -40],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  return (
    <TouchableOpacity style={styles.deleteAction} onPress={onDelete} activeOpacity={0.8}>
      <Animated.View style={[styles.deleteInner, { transform: [{ scale }] }]}>
        <Text style={styles.deleteIcon}>🗑️</Text>
        <Text style={styles.deleteLabel}>Apagar</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function SwipeableHabitCard({ habit, onToggle, onEdit, onDelete }) {
  const swipeableRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(habit.done ? 1 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(16)).current;
  const [isDone, setIsDone] = useState(habit.done);

  // Fade in ao montar
  Animated.parallel([
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }),
    Animated.timing(translateYAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }),
  ]).start();

  function handleToggle() {
    const newDone = !isDone;
    setIsDone(newDone);

    // Spring no card
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        speed: 50,
        bounciness: 0,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        speed: 20,
        bounciness: 14,
        useNativeDriver: true,
      }),
    ]).start();

    // Animação do check
    Animated.spring(checkAnim, {
      toValue: newDone ? 1 : 0,
      speed: 30,
      bounciness: 12,
      useNativeDriver: true,
    }).start();

    onToggle(habit.id);
  }

  function handleDelete() {
    // Slide out antes de apagar
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      swipeableRef.current?.close();
      onDelete(habit.id);
    });
  }

  const checkScale = checkAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 1.2, 1],
  });

  const renderRightActions = (progress, dragX) => (
    <DeleteAction onDelete={handleDelete} dragX={dragX} />
  );

  return (
    <Animated.View style={{
      opacity: opacityAnim,
      transform: [{ translateY: translateYAnim }, { scale: scaleAnim }],
    }}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={[styles.card, isDone && styles.cardDone]}
          activeOpacity={0.9}
          onPress={handleToggle}
          onLongPress={() => onEdit(habit)}
          delayLongPress={400}
        >
          <Animated.View style={[
            styles.emojiBox,
            { backgroundColor: isDone ? colors.primary : habit.color },
          ]}>
            <Text style={{ fontSize: 22 }}>{habit.emoji}</Text>
          </Animated.View>

          <View style={styles.info}>
            <Text style={[styles.name, isDone && styles.nameDone]}>{habit.name}</Text>
            <Text style={styles.meta}>
              {habit.time} · {
                habit.frequency === 'daily' ? 'Todos os dias' :
                habit.frequency === 'weekdays' ? 'Seg–Sex' :
                habit.frequency === 'weekends' ? 'Fins de semana' :
                habit.frequency
              }
            </Text>
          </View>

          <View style={styles.right}>
            <Text style={styles.streak}>🔥 {habit.streak}</Text>
            <Animated.View style={[
              styles.check,
              isDone && styles.checkDone,
              { transform: [{ scale: checkScale }] },
            ]}>
              {isDone && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
            </Animated.View>
          </View>

          <View style={styles.editHint}>
            <Text style={styles.editHintText}>···</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow.sm },
  cardDone: { opacity: 0.65 },
  emojiBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text },
  nameDone: { textDecorationLine: 'line-through', color: colors.text3 },
  meta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, marginTop: 2 },
  right: { alignItems: 'center', gap: 6 },
  streak: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.warning },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  editHint: { position: 'absolute', top: 8, right: 12 },
  editHintText: { fontSize: 12, color: colors.text3, letterSpacing: 1 },
  deleteAction: { width: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.error, borderRadius: radius.md, marginLeft: 8 },
  deleteInner: { alignItems: 'center', gap: 4 },
  deleteIcon: { fontSize: 22 },
  deleteLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#fff' },
});