import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configuração de como as notificações aparecem quando a app está aberta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Pede permissão ao utilizador
export async function requestPermissions() {
  if (!Device.isDevice) {
    console.log('Notificações só funcionam em dispositivo físico');
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permissão de notificações negada');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('habits', {
      name: 'Lembretes de hábitos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: true,
    });
  }

  return true;
}

// Agenda lembrete diário para um hábito
export async function scheduleHabitReminder(habit) {
  // Cancela qualquer lembrete anterior deste hábito
  await cancelHabitReminder(habit.id);

  const [hours, minutes] = habit.time.split(':').map(Number);

  // Determina os dias da semana
  let weekdays;
  if (habit.frequency === 'daily') {
    weekdays = [1, 2, 3, 4, 5, 6, 7]; // todos os dias
  } else if (habit.frequency === 'weekdays') {
    weekdays = [2, 3, 4, 5, 6]; // seg-sex
  } else if (habit.frequency === 'weekends') {
    weekdays = [1, 7]; // sab-dom
  } else {
    weekdays = [2, 4, 6]; // 3x por semana (seg, qua, sex)
  }

  const ids = [];

  for (const weekday of weekdays) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${habit.emoji} ${habit.name}`,
        body: 'Está na hora do teu hábito! 💪',
        data: { habitId: habit.id },
      },
      trigger: {
        type: 'weekly',
        weekday,
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });
    ids.push(id);
  }

  return ids;
}

// Cancela lembretes de um hábito
export async function cancelHabitReminder(habitId) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter(n => n.content.data?.habitId === habitId);
  for (const n of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

// Cancela todos os lembretes
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Notificação imediata de teste
export async function sendTestNotification(habit) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${habit.emoji} ${habit.name}`,
      body: 'Teste de notificação do Momentum! 🌱',
    },
    trigger: { seconds: 3 },
  });
}