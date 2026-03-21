import { getDB } from './database';

const today = () => new Date().toISOString().split('T')[0];

export async function getAllHabits() {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM habits ORDER BY id ASC');
}

export async function getTodayHabits() {
  const db = await getDB();
  const date = today();

  const habits = await db.getAllAsync('SELECT * FROM habits ORDER BY id ASC');

  return Promise.all(habits.map(async (h) => {
    const log = await db.getFirstAsync(
      'SELECT done FROM habit_logs WHERE habit_id = ? AND date = ?',
      [h.id, date]
    );
    return { ...h, done: log ? log.done === 1 : false };
  }));
}

export async function toggleHabit(habitId) {
  const db = await getDB();
  const date = today();

  const existing = await db.getFirstAsync(
    'SELECT id, done FROM habit_logs WHERE habit_id = ? AND date = ?',
    [habitId, date]
  );

  if (existing) {
    const newDone = existing.done === 1 ? 0 : 1;
    await db.runAsync(
      'UPDATE habit_logs SET done = ? WHERE id = ?',
      [newDone, existing.id]
    );
    // Atualiza streak
    await db.runAsync(
      `UPDATE habits SET streak = streak + ? WHERE id = ?`,
      [newDone === 1 ? 1 : -1, habitId]
    );
  } else {
    await db.runAsync(
      'INSERT INTO habit_logs (habit_id, date, done) VALUES (?, ?, 1)',
      [habitId, date]
    );
    await db.runAsync(
      'UPDATE habits SET streak = streak + 1 WHERE id = ?',
      [habitId]
    );
  }
}

export async function createHabit(habit) {
  const db = await getDB();
  const result = await db.runAsync(
    'INSERT INTO habits (name, emoji, color, frequency, time) VALUES (?, ?, ?, ?, ?)',
    [habit.name, habit.emoji, habit.color, habit.frequency, habit.time]
  );
  return result.lastInsertRowId;
}

export async function deleteHabit(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM habits WHERE id = ?', [id]);
}

export async function updateHabit(id, fields) {
  const db = await getDB();
  await db.runAsync(
    `UPDATE habits SET name = ?, emoji = ?, color = ?, frequency = ?, time = ? WHERE id = ?`,
    [fields.name, fields.emoji, fields.color, fields.frequency, fields.time, id]
  );
}