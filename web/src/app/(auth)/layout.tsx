import { t } from "@/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="text-center">
        <p className="text-3xl font-extrabold tracking-tight text-primary">{t.app.name}</p>
        <p className="mt-1 text-sm text-text-2">{t.app.tagline}</p>
      </div>
      {children}
    </main>
  );
}
