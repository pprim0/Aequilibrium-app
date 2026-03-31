import { supabase } from '../lib/supabase';

async function getAuthenticatedUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session?.user || null;
}

export async function getMyProfile() {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(patch) {
  const user = await getAuthenticatedUser();
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
  const user = await getAuthenticatedUser();
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
