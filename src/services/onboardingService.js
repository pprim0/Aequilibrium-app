import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const DRAFT_KEY = 'onboarding_draft';

async function assertNoError(result, context) {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

export async function saveOnboardingDraft(draft) {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function getOnboardingDraft() {
  const raw = await AsyncStorage.getItem(DRAFT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearOnboardingDraft() {
  await AsyncStorage.removeItem(DRAFT_KEY);
}

export async function applyOnboardingDraftToUser(userId, draft) {
  // 1. Atualiza o perfil
  await assertNoError(
    await supabase
      .from('profiles')
      .upsert({
        id: userId,
        name: draft.name || 'Utilizador',
        primary_goal: draft.primaryGoal || null,
      }, { onConflict: 'id' }),
    'Falha ao atualizar perfil'
  );

  // 2. Cria categorias financeiras default
  const emojiMap = {
    'Casa': '🏠', 'Alimentação': '🛒', 'Transporte': '🚗',
    'Lazer': '🎭', 'Saúde': '❤️', 'Subscrições': '📱',
    'Compras': '🛍️', 'Outros': '📦',
  };

  const expenseCategories = (draft.selectedCategories || ['Alimentação', 'Casa', 'Transporte', 'Lazer']).map(name => ({
    user_id: userId,
    name,
    type: 'expense',
    emoji: emojiMap[name] || '📦',
    is_default: true,
  }));

  const incomeCategories = [
    { user_id: userId, name: 'Salário', type: 'income', emoji: '💼', is_default: true },
    { user_id: userId, name: 'Freelance', type: 'income', emoji: '💻', is_default: true },
    { user_id: userId, name: 'Outros rendimentos', type: 'income', emoji: '📦', is_default: true },
  ];

  const categories = await assertNoError(
    await supabase
      .from('finance_categories')
      .insert([...expenseCategories, ...incomeCategories])
      .select(),
    'Falha ao criar categorias financeiras'
  );

  // 3. Cria orçamento mensal se definido
  if (draft.monthlyBudget && categories) {
    const periodMonth = new Date();
    periodMonth.setDate(1);
    const period = periodMonth.toISOString().split('T')[0];

    const alimentacaoCat = categories.find(c => c.name === 'Alimentação');
    if (alimentacaoCat) {
      await assertNoError(
        await supabase.from('budgets').insert({
          user_id: userId,
          category_id: alimentacaoCat.id,
          period_month: period,
          amount: Math.round(draft.monthlyBudget * 0.3),
        }),
        'Falha ao criar orçamento inicial'
      );
    }
  }

  // 4. Cria hábitos iniciais
  if (draft.selectedHabits && draft.selectedHabits.length > 0) {
    const habitEmojiMap = {
      'Beber água': '💧', 'Exercício': '🏃', 'Ler': '📚',
      'Dormir cedo': '🌙', 'Meditar': '🧘', 'Cozinhar em casa': '🍳',
      'Registar despesas': '📝', 'Caminhar': '🚶', 'Estudar': '🎓',
      'Planear o dia': '📋',
    };

    const habits = draft.selectedHabits.map((h, i) => {
      const name = typeof h === 'string' ? h : h.name;
      return {
        user_id: userId,
        name,
        emoji: habitEmojiMap[name] || (typeof h === 'string' ? '✅' : (h.emoji || '✅')),
        color: '#E8F5EE',
        frequency_type: 'daily',
        sort_order: i,
      };
    });

    await assertNoError(
      await supabase.from('habits').insert(habits),
      'Falha ao criar hábitos iniciais'
    );
  }

  // 5. Cria meta financeira inicial
  if (draft.monthlySavingsTarget && draft.monthlySavingsTarget > 0) {
    await assertNoError(
      await supabase.from('financial_goals').insert({
        user_id: userId,
        name: 'Poupança mensal',
        emoji: '🏦',
        target_amount: draft.monthlySavingsTarget,
        current_amount: 0,
      }),
      'Falha ao criar meta financeira inicial'
    );
  }

  // 6. Cria preferências do utilizador
  await assertNoError(
    await supabase.from('user_preferences').upsert({
      user_id: userId,
      notifications_enabled: true,
      biometrics_enabled: false,
      dark_mode: false,
    }),
    'Falha ao guardar preferências do utilizador'
  );

  // 7. Marca onboarding como completo
  await assertNoError(
    await supabase.from('profiles').update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', userId),
    'Falha ao marcar onboarding como completo'
  );

  // 8. Limpa draft local
  await clearOnboardingDraft();
}
