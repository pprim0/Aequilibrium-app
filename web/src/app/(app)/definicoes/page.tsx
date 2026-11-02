import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SetupMissing } from "@/components/setup/require-setup";
import { isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export const metadata = { title: `${t.settings.title} · ${t.app.name}` };

const s = t.settings.sections;
const d = t.settings.descriptions;

type Item = { key: string; title: string; description: string };

const essential: Item[] = [
  { key: "geral", title: s.general, description: d.general },
  { key: "rendimentos", title: s.income, description: d.income },
  { key: "plano", title: s.plan, description: d.plan },
  { key: "grupos", title: s.groups, description: d.groups },
  { key: "categorias", title: s.categories, description: d.categories },
  { key: "dados", title: s.data, description: d.data },
];

const advanced: Item[] = [
  { key: "metodos", title: s.methods, description: d.methods },
  { key: "atalhos", title: s.shortcuts, description: d.shortcuts },
  { key: "regra", title: s.rule, description: d.rule },
  { key: "conquistas", title: t.progress.achievements, description: d.achievements },
];

function ItemList({ items, descriptions }: { items: Item[]; descriptions?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.key}>
          <Link href={`/definicoes/${item.key}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{item.title}</span>
              {descriptions && <span className="block text-xs text-text-2">{item.description}</span>}
            </span>
            <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function SettingsPage() {
  if (!(await isSetUp())) return <SetupMissing />;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t.settings.title}</h1>
      <Card className="p-0">
        <ItemList items={essential} />
      </Card>
      <details className="rounded-[var(--radius-md)] border border-border bg-card">
        <summary className="flex min-h-14 cursor-pointer items-center px-4 font-semibold">{t.settings.groups.advanced}</summary>
        <div className="border-t border-border">
          <ItemList items={advanced} descriptions />
        </div>
      </details>
    </div>
  );
}
