import { supabase } from '../lib/supabase';
import { clearOnboardingDraft } from './onboardingService';
import { setBiometricEnabled } from '../utils/biometrics';

export async function deleteMyAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: {},
  });

  if (error) {
    throw new Error(error.message || 'Falha ao apagar conta.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  await clearOnboardingDraft();
  await setBiometricEnabled(false);
}
