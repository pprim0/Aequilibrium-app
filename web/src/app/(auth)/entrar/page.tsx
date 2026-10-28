import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui/card";
import { signIn } from "@/app/actions/auth";
import { t } from "@/i18n";

export const metadata = { title: `${t.auth.signInTitle} · ${t.app.name}` };

export default function SignInPage() {
  return (
    <Card className="p-6">
      <h1 className="mb-4 text-xl font-bold">{t.auth.signInTitle}</h1>
      <AuthForm mode="signIn" action={signIn} />
    </Card>
  );
}
