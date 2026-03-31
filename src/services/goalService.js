import { supabase } from '../lib/supabase';

function toNumber(value) {
  return Number(value || 0);
}

function normalizeGoal(goal) {
  return {
    id: goal.id,
    name: goal.name,
    emoji: goal.emoji || '🎯',
    target: toNumber(goal.target_amount),
    current: toNumber(goal.current_amount),
    deadline: goal.deadline,
    notes: goal.notes || '',
    sortOrder: goal.sort_order || 0,
    archivedAt: goal.archived_at,
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

export async function getGoals({ includeArchived = false } = {}) {
  const userId = await getCurrentUserId();
  let query = supabase
    .from('financial_goals')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(normalizeGoal);
}

export async function createGoal(goal) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('financial_goals')
    .insert({
      user_id: userId,
      name: goal.name,
      emoji: goal.emoji || '🎯',
      target_amount: goal.target,
      current_amount: goal.current || 0,
      deadline: goal.deadline || null,
      notes: goal.notes || null,
    })
    .select()
    .single();

  if (error) throw error;

  return normalizeGoal(data);
}

export async function updateGoal(id, patch) {
  const payload = {};

  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.emoji !== undefined) payload.emoji = patch.emoji;
  if (patch.target !== undefined) payload.target_amount = patch.target;
  if (patch.current !== undefined) payload.current_amount = patch.current;
  if (patch.deadline !== undefined) payload.deadline = patch.deadline;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  if (patch.isArchived !== undefined) payload.is_archived = patch.isArchived;

  const { data, error } = await supabase
    .from('financial_goals')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return normalizeGoal(data);
}

export async function updateGoalProgress(id, amount) {
  const { data: currentGoal, error: fetchError } = await supabase
    .from('financial_goals')
    .select('current_amount')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const nextAmount = Math.max(0, toNumber(currentGoal.current_amount) + toNumber(amount));

  return updateGoal(id, { current: nextAmount });
}

export async function deleteGoal(id) {
  const { error } = await supabase
    .from('financial_goals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
