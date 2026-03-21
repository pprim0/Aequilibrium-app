import * as SQLite from 'expo-sqlite';

let db;

export async function getDB() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('momentum.db');
    await db.execAsync('PRAGMA journal_mode = WAL;');
  }
  return db;
}

export async function initDatabase() {
  const db = await getDB();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '✅',
      color TEXT DEFAULT '#E8F5EE',
      frequency TEXT DEFAULT 'daily',
      time TEXT DEFAULT '08:00',
      streak INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      UNIQUE(habit_id, date)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      date TEXT DEFAULT (date('now')),
      recurring INTEGER DEFAULT 0,
      emoji TEXT DEFAULT '💶'
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '🎯',
      target REAL NOT NULL,
      current REAL DEFAULT 0,
      deadline TEXT,
      created_at TEXT DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS budget (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      emoji TEXT DEFAULT '📦'
    );
  `);

  await seedDefaultData(db);
}

async function seedDefaultData(db) {
  // Só insere dados se as tabelas estiverem vazias
  const habits = await db.getAllAsync('SELECT id FROM habits LIMIT 1');
  if (habits.length > 0) return;

  await db.execAsync(`
    INSERT INTO habits (name, emoji, color, frequency, time, streak)
    VALUES
      ('Beber 2L de água', '💧', '#E8F5EE', 'daily', '08:00', 6),
      ('Cozinhar em casa', '🍳', '#FEF3C7', 'weekdays', '12:30', 4),
      ('Exercício', '🏃', '#FFE8E8', 'daily', '18:00', 3),
      ('Ler 10 minutos', '📚', '#E8F1FB', 'daily', '21:00', 2),
      ('Dormir antes das 23h', '🌙', '#F5F0FF', 'daily', '23:00', 6);

    INSERT INTO transactions (type, amount, category, description, date, recurring, emoji)
    VALUES
      ('expense', 28, 'Alimentação', 'Supermercado Continente', date('now'), 0, '🛒'),
      ('expense', 30, 'Transporte', 'Carregamento Andante', date('now', '-1 day'), 0, '🚇'),
      ('income', 1800, 'Receita', 'Salário Março', date('now', '-14 days'), 1, '💼'),
      ('expense', 24, 'Alimentação', 'Restaurante — Jantar', date('now', '-2 days'), 0, '🍕'),
      ('expense', 10, 'Subscrições', 'Spotify', date('now', '-4 days'), 1, '📱');

    INSERT INTO goals (name, emoji, target, current, deadline)
    VALUES
      ('Viagem', '✈️', 500, 180, date('now', '+3 months')),
      ('Fundo de emergência', '🛡️', 3000, 1680, date('now', '+9 months')),
      ('Novo portátil', '💻', 1000, 840, date('now', '+5 months'));

    INSERT INTO budget (category, amount, emoji)
    VALUES
      ('Alimentação', 250, '🛒'),
      ('Casa', 500, '🏠'),
      ('Transporte', 150, '🚗'),
      ('Lazer', 100, '🎭'),
      ('Subscrições', 80, '📱');
  `);
}