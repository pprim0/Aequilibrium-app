import { supabase } from '../lib/supabase';

export async function getMyProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(patch) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No user');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function ensureMyProfile(name) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No user');

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!existing) {
    const { error } = await supabase
      .from('profiles')
      .insert({ id: user.id, name: name || 'Utilizador' });
    if (error) throw error;
  }
}

export async function getAppBootstrapState() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .single();

  return { session, profile };
}