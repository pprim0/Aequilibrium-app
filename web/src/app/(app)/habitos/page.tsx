import { HabitList } from "@/components/habits/habit-list";
import { SetupMissing } from "@/components/setup/require-setup";
import { getHabits, isSetUp } from "@/lib/data";
import { t } from "@/i18n";

export const metadata = { title: `${t.habits.title} · ${t.app.name}` };

export default async function HabitsPage() {
  if (!(await isSetUp())) return <SetupMissing />;
  return <HabitList habits={await getHabits()} />;
}
