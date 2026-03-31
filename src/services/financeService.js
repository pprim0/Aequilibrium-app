import { supabase } from '../lib/supabase';

function monthStart(month) {
  return `${month}-01`;
}

function monthEnd(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = new Date(year, monthNumber, 1);
  return nextMonth.toISOString().split('T')[0];
}

function toNumber(value) {
  return Number(value || 0);
}

function normalizeCategory(category, fallbackType = 'expense') {
  return {
    id: category?.id || null,
    name: category?.name || (fallbackType === 'income' ? 'Receita' : 'Outros'),
    type: category?.type || fallbackType,
    emoji: category?.emoji || (fallbackType === 'income' ? '💼' : '📦'),
    color: category?.color || null,
  };
}

function normalizeTransaction(row) {
  const category = normalizeCategory(row.finance_categories, row.type);

  return {
    id: row.id,
    categoryId: row.category_id,
    type: row.type,
    amount: toNumber(row.amount),
    category: category.name,
    description: row.description || category.name,
    date: row.transaction_date,
    recurring: row.recurring ? 1 : 0,
    emoji: category.emoji,
    notes: row.notes || '',
  };
}

function normalizeBudget(row) {
  const category = normalizeCategory(row.finance_categories);

  return {
    id: row.id,
    categoryId: row.category_id,
    category: category.name,
    amount: toNumber(row.amount),
    emoji: category.emoji,
    color: category.color,
    periodMonth: row.period_month,
  };
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

export async function getFinanceCategories(type) {
  const userId = await getCurrentUserId();
  let query = supabase
    .from('finance_categories')
    .select('*')
    .eq('user_id', userId)
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((category) => normalizeCategory(category));
}

export async function createFinanceCategory({ name, type, emoji, color, isDefault = false }) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('finance_categories')
    .insert({
      user_id: userId,
      name,
      type,
      emoji: emoji || (type === 'income' ? '💼' : '📦'),
      color: color || null,
      is_default: isDefault,
    })
    .select()
    .single();

  if (error) throw error;

  return normalizeCategory(data, type);
}

async function ensureCategory({ categoryId, category, type, emoji }) {
  if (categoryId) {
    return categoryId;
  }

  const categories = await getFinanceCategories(type);
  const existing = categories.find((item) => item.name === category);
  if (existing) {
    return existing.id;
  }

  const created = await createFinanceCategory({ name: category, type, emoji });
  return created.id;
}

export async function getTransactions(month) {
  const userId = await getCurrentUserId();
  let query = supabase
    .from('transactions')
    .select(`
      id,
      category_id,
      type,
      amount,
      description,
      transaction_date,
      recurring,
      notes,
      finance_categories (
        id,
        name,
        type,
        emoji,
        color
      )
    `)
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (month) {
    query = query
      .gte('transaction_date', monthStart(month))
      .lt('transaction_date', monthEnd(month));
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(normalizeTransaction);
}

export async function createTransaction(tx) {
  const userId = await getCurrentUserId();
  const categoryId = await ensureCategory(tx);

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      category_id: categoryId,
      type: tx.type,
      amount: tx.amount,
      description: tx.description || null,
      transaction_date: tx.date,
      recurring: !!tx.recurring,
      notes: tx.notes || null,
    })
    .select(`
      id,
      category_id,
      type,
      amount,
      description,
      transaction_date,
      recurring,
      notes,
      finance_categories (
        id,
        name,
        type,
        emoji,
        color
      )
    `)
    .single();

  if (error) throw error;

  return normalizeTransaction(data);
}

export async function updateTransaction(id, tx) {
  const categoryId = await ensureCategory(tx);

  const { data, error } = await supabase
    .from('transactions')
    .update({
      category_id: categoryId,
      type: tx.type,
      amount: tx.amount,
      description: tx.description || null,
      transaction_date: tx.date,
      recurring: !!tx.recurring,
      notes: tx.notes || null,
    })
    .eq('id', id)
    .select(`
      id,
      category_id,
      type,
      amount,
      description,
      transaction_date,
      recurring,
      notes,
      finance_categories (
        id,
        name,
        type,
        emoji,
        color
      )
    `)
    .single();

  if (error) throw error;

  return normalizeTransaction(data);
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getMonthSummary(month) {
  const transactions = await getTransactions(month);

  return transactions.reduce((summary, tx) => {
    if (tx.type === 'income') {
      summary.income += tx.amount;
    } else {
      summary.expenses += tx.amount;
    }

    summary.balance = summary.income - summary.expenses;
    return summary;
  }, { income: 0, expenses: 0, balance: 0 });
}

export async function getBudget(month) {
  const userId = await getCurrentUserId();
  let query = supabase
    .from('budgets')
    .select(`
      id,
      category_id,
      period_month,
      amount,
      finance_categories (
        id,
        name,
        type,
        emoji,
        color
      )
    `)
    .eq('user_id', userId)
    .order('period_month', { ascending: false });

  if (month) {
    query = query.eq('period_month', monthStart(month));
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(normalizeBudget);
}

export async function getSpentByCategory(month) {
  const transactions = await getTransactions(month);
  const spentMap = new Map();

  transactions
    .filter((tx) => tx.type === 'expense')
    .forEach((tx) => {
      spentMap.set(tx.category, (spentMap.get(tx.category) || 0) + tx.amount);
    });

  return Array.from(spentMap.entries()).map(([category, total]) => ({
    category,
    total,
  }));
}
