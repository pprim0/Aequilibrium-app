import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui/card";
import { signUp } from "@/app/actions/auth";
import { t } from "@/i18n";

export const metadata = { title: `${t.auth.signUpTitle} · ${t.app.name}` };

export default function SignUpPage() {
  return (
    <Card className="p-6">
      <h1 className="mb-4 text-xl font-bold">{t.auth.signUpTitle}</h1>
      <AuthForm mode="signUp" action={signUp} />
    </Card>
  );
}
