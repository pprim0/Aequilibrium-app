import { getDB } from './database';

export async function getTransactions(month) {
  const db = await getDB();
  // month formato: '2025-03'
  if (month) {
    return await db.getAllAsync(
      `SELECT * FROM transactions WHERE date LIKE ? ORDER BY date DESC`,
      [`${month}%`]
    );
  }
  return await db.getAllAsync('SELECT * FROM transactions ORDER BY date DESC');
}

export async function addTransaction(tx) {
  const db = await getDB();
  const result = await db.runAsync(
    `INSERT INTO transactions (type, amount, category, description, date, recurring, emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tx.type, tx.amount, tx.category, tx.description, tx.date, tx.recurring ? 1 : 0, tx.emoji]
  );
  return result.lastInsertRowId;
}

export async function deleteTransaction(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function getMonthSummary(month) {
  const db = await getDB();
  const rows = await db.getAllAsync(
    `SELECT type, SUM(amount) as total FROM transactions WHERE date LIKE ? GROUP BY type`,
    [`${month}%`]
  );

  let income = 0, expenses = 0;
  rows.forEach(r => {
    if (r.type === 'income') income = r.total;
    else expenses = r.total;
  });

  return { income, expenses, balance: income - expenses };
}

export async function getBudget() {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM budget ORDER BY id ASC');
}

export async function getSpentByCategory(month) {
  const db = await getDB();
  return await db.getAllAsync(
    `SELECT category, SUM(amount) as total FROM transactions
     WHERE type = 'expense' AND date LIKE ?
     GROUP BY category`,
    [`${month}%`]
  );
}