import { useRef } from 'react';
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

  function handleDelete() {
    swipeableRef.current?.close();
    onDelete(habit.id);
  }

  const renderRightActions = (progress, dragX) => (
    <DeleteAction onDelete={handleDelete} dragX={dragX} />
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity
        style={[styles.card, habit.done && styles.cardDone]}
        activeOpacity={0.85}
        onPress={() => onToggle(habit.id)}
        onLongPress={() => onEdit(habit)}
        delayLongPress={400}
      >
        <View style={[styles.emojiBox, { backgroundColor: habit.done ? colors.primary : habit.color }]}>
          <Text style={{ fontSize: 22 }}>{habit.emoji}</Text>
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, habit.done && styles.nameDone]}>{habit.name}</Text>
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
          <View style={[styles.check, habit.done && styles.checkDone]}>
            {habit.done && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
          </View>
        </View>

        <View style={styles.editHint}>
          <Text style={styles.editHintText}>···</Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
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

  // Delete action
  deleteAction: { width: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.error, borderRadius: radius.md, marginLeft: 8 },
  deleteInner: { alignItems: 'center', gap: 4 },
  deleteIcon: { fontSize: 22 },
  deleteLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#fff' },
});