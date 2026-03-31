import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

async function deleteUserData(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: habits, error: habitsError } = await admin
    .from('habits')
    .select('id')
    .eq('user_id', userId);

  if (habitsError) {
    throw new Error(`Falha ao ler hábitos: ${habitsError.message}`);
  }

  const habitIds = (habits || []).map((habit) => habit.id);

  if (habitIds.length > 0) {
    const { error: logsError } = await admin
      .from('habit_logs')
      .delete()
      .or(`user_id.eq.${userId},habit_id.in.(${habitIds.join(',')})`);

    if (logsError) {
      throw new Error(`Falha ao apagar logs de hábitos: ${logsError.message}`);
    }

    const { error: scheduleError } = await admin
      .from('habit_schedule_days')
      .delete()
      .in('habit_id', habitIds);

    if (scheduleError) {
      throw new Error(`Falha ao apagar agendamentos de hábitos: ${scheduleError.message}`);
    }
  }

  const deletions = [
    ['orçamentos', () => admin.from('budgets').delete().eq('user_id', userId)],
    ['transações', () => admin.from('transactions').delete().eq('user_id', userId)],
    ['metas financeiras', () => admin.from('financial_goals').delete().eq('user_id', userId)],
    ['hábitos', () => admin.from('habits').delete().eq('user_id', userId)],
    ['categorias financeiras', () => admin.from('finance_categories').delete().eq('user_id', userId)],
    ['categorias de hábitos', () => admin.from('habit_categories').delete().eq('user_id', userId)],
    ['preferências', () => admin.from('user_preferences').delete().eq('user_id', userId)],
    ['perfil', () => admin.from('profiles').delete().eq('id', userId)],
  ];

  for (const [label, runDelete] of deletions) {
    const { error } = await runDelete();
    if (error) {
      throw new Error(`Falha ao apagar ${label}: ${error.message}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(500, { error: 'Variáveis de ambiente do Supabase em falta.' });
    }

    if (!authHeader) {
      return json(401, { error: 'Pedido sem autenticação.' });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json(401, { error: 'Sessão inválida.' });
    }

    await deleteUserData(adminClient, user.id);

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      throw new Error(`Falha ao apagar utilizador de autenticação: ${deleteAuthError.message}`);
    }

    return json(200, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao apagar conta.';
    return json(500, { error: message });
  }
});
