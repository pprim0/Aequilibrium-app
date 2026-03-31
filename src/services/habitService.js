import { supabase } from '../lib/supabase';

function today() {
  return new Date().toISOString().split('T')[0];
}

function toTime(value) {
  return value ? String(value).slice(0, 5) : '08:00';
}

function mapFrequencyFromDb(habit) {
  const weekdays = (habit.habit_schedule_days || [])
    .map((day) => day.weekday)
    .sort((a, b) => a - b);

  if (habit.frequency_type === 'daily') {
    return 'daily';
  }

  if (habit.frequency_type === 'weekly' && habit.target_per_period === 3) {
    return '3x';
  }

  if (habit.frequency_type === 'specific_days') {
    if (JSON.stringify(weekdays) === JSON.stringify([1, 2, 3, 4, 5])) {
      return 'weekdays';
    }

    if (JSON.stringify(weekdays) === JSON.stringify([0, 6])) {
      return 'weekends';
    }
  }

  return 'daily';
}

function mapFrequencyToDb(frequency) {
  if (frequency === 'weekdays') {
    return { frequency_type: 'specific_days', target_per_period: 1, weekdays: [1, 2, 3, 4, 5] };
  }

  if (frequency === 'weekends') {
    return { frequency_type: 'specific_days', target_per_period: 1, weekdays: [0, 6] };
  }

  if (frequency === '3x') {
    return { frequency_type: 'weekly', target_per_period: 3, weekdays: [] };
  }

  return { frequency_type: 'daily', target_per_period: 1, weekdays: [] };
}

function isScheduledForWeekday(habit, weekday) {
  if (habit.frequency_type === 'daily') {
    return true;
  }

  if (habit.frequency_type === 'weekly') {
    return true;
  }

  const weekdays = (habit.habit_schedule_days || []).map((day) => day.weekday);
  return weekdays.includes(weekday);
}

function calculateStreak(habit, logsByDate) {
  let streak = 0;
  const cursor = new Date();

  for (let attempts = 0; attempts < 365; attempts += 1) {
    const dateString = cursor.toISOString().split('T')[0];
    const weekday = cursor.getDay();

    if (isScheduledForWeekday(habit, weekday)) {
      const status = logsByDate.get(dateString);

      if (status === 'done') {
        streak += 1;
      } else if (dateString !== today()) {
        break;
      }
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error('No user');

  return user.id;
}

async function fetchHabits() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('habits')
    .select(`
      *,
      habit_schedule_days (
        weekday
      )
    `)
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data || [];
}

async function fetchLogsForHabits(habitIds) {
  if (habitIds.length === 0) {
    return [];
  }

  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id, log_date, status')
    .eq('user_id', userId)
    .in('habit_id', habitIds)
    .gte('log_date', new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]);

  if (error) throw error;

  return data || [];
}

function normalizeHabit(habit, logs) {
  const logsByDate = new Map(
    logs.map((log) => [log.log_date, log.status])
  );
  const date = today();

  return {
    id: habit.id,
    name: habit.name,
    emoji: habit.emoji || '✅',
    color: habit.color || '#E8F5EE',
    frequency: mapFrequencyFromDb(habit),
    time: toTime(habit.time_of_day),
    streak: calculateStreak(habit, logsByDate),
    done: logsByDate.get(date) === 'done',
  };
}

export async function getAllHabits() {
  const habits = await fetchHabits();
  const logs = await fetchLogsForHabits(habits.map((habit) => habit.id));

  return habits.map((habit) =>
    normalizeHabit(
      habit,
      logs.filter((log) => log.habit_id === habit.id)
    )
  );
}

export async function getTodayHabits() {
  const habits = await fetchHabits();
  const todayWeekday = new Date().getDay();
  const scheduledToday = habits.filter((habit) => isScheduledForWeekday(habit, todayWeekday));
  const logs = await fetchLogsForHabits(scheduledToday.map((habit) => habit.id));

  return scheduledToday.map((habit) =>
    normalizeHabit(
      habit,
      logs.filter((log) => log.habit_id === habit.id)
    )
  );
}

export async function toggleHabit(habitId) {
  const userId = await getCurrentUserId();
  const date = today();

  const { data: existing, error: fetchError } = await supabase
    .from('habit_logs')
    .select('id, status')
    .eq('habit_id', habitId)
    .eq('log_date', date)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing?.status === 'done') {
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('id', existing.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('habit_logs')
    .upsert({
      habit_id: habitId,
      user_id: userId,
      log_date: date,
      status: 'done',
    }, { onConflict: 'habit_id,log_date' });

  if (error) throw error;
}

export async function createHabit(habit) {
  const userId = await getCurrentUserId();
  const frequency = mapFrequencyToDb(habit.frequency);

  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: userId,
      name: habit.name,
      emoji: habit.emoji || '✅',
      color: habit.color || '#E8F5EE',
      frequency_type: frequency.frequency_type,
      target_per_period: frequency.target_per_period,
      time_of_day: habit.time,
      reminder_enabled: true,
    })
    .select('id')
    .single();

  if (error) throw error;

  if (frequency.weekdays.length > 0) {
    const { error: scheduleError } = await supabase
      .from('habit_schedule_days')
      .insert(
        frequency.weekdays.map((weekday) => ({
          habit_id: data.id,
          weekday,
        }))
      );

    if (scheduleError) throw scheduleError;
  }

  return data.id;
}

export async function updateHabit(id, fields) {
  const frequency = mapFrequencyToDb(fields.frequency);

  const { error } = await supabase
    .from('habits')
    .update({
      name: fields.name,
      emoji: fields.emoji || '✅',
      color: fields.color || '#E8F5EE',
      frequency_type: frequency.frequency_type,
      target_per_period: frequency.target_per_period,
      time_of_day: fields.time,
      reminder_enabled: true,
    })
    .eq('id', id);

  if (error) throw error;

  const { error: deleteError } = await supabase
    .from('habit_schedule_days')
    .delete()
    .eq('habit_id', id);

  if (deleteError) throw deleteError;

  if (frequency.weekdays.length > 0) {
    const { error: insertError } = await supabase
      .from('habit_schedule_days')
      .insert(
        frequency.weekdays.map((weekday) => ({
          habit_id: id,
          weekday,
        }))
      );

    if (insertError) throw insertError;
  }
}

export async function deleteHabit(id) {
  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
