import { getDB } from './database';

export async function getGoals() {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM goals ORDER BY id ASC');
}

export async function createGoal(goal) {
  const db = await getDB();
  const result = await db.runAsync(
    'INSERT INTO goals (name, emoji, target, current, deadline) VALUES (?, ?, ?, ?, ?)',
    [goal.name, goal.emoji, goal.target, goal.current || 0, goal.deadline]
  );
  return result.lastInsertRowId;
}

export async function updateGoalProgress(id, amount) {
  const db = await getDB();
  await db.runAsync(
    'UPDATE goals SET current = current + ? WHERE id = ?',
    [amount, id]
  );
}

export async function deleteGoal(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}