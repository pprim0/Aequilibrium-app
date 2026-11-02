import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DataPanel } from "@/components/settings/data-panel";
import { EntityEditor } from "@/components/settings/entity-editor";
import { GeneralForm } from "@/components/settings/general-form";
import { SetupMissing } from "@/components/setup/require-setup";
import { getEntityRows, getFullSettings, getSettingsOptions, isSetUp } from "@/lib/data";
import { findEntity } from "@/lib/settings-entities";
import { t } from "@/i18n";

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <Link href="/definicoes" className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden /> {t.settings.back}
      </Link>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-1 text-sm text-text-2">{description}</p>
    </div>
  );
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  if (!(await isSetUp())) return <SetupMissing />;
  const { section } = await params;

  if (section === "geral") {
    const [settings, options] = await Promise.all([getFullSettings(), getSettingsOptions()]);
    return (
      <div className="flex flex-col gap-4">
        <Header title={t.settings.sections.general} description={t.settings.descriptions.general} />
        <GeneralForm settings={settings ?? {}} accounts={options.accounts} />
      </div>
    );
  }

  if (section === "dados") {
    return (
      <div className="flex flex-col gap-4">
        <Header title={t.settings.sections.data} description={t.settings.descriptions.data} />
        <DataPanel />
      </div>
    );
  }

  const entity = findEntity(section);
  if (!entity) notFound();
  const [rows, options] = await Promise.all([getEntityRows(entity.table, entity.orderBy), getSettingsOptions()]);
  return (
    <div className="flex flex-col gap-4">
      <Header title={entity.title} description={entity.description} />
      <EntityEditor entityKey={entity.key} rows={rows} options={options} />
    </div>
  );
}
