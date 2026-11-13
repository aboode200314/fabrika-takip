export interface WorkSchedule { id: string; gun: number; tatil: boolean; baslangic: string | null; bitis: string | null }
export interface WorkBreak { schedule_id: string | null; baslangic: string; bitis: string }
const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };

/** Full configured working days in an inclusive selected calendar range. */
export function plannedMinutes(from: string, to: string, schedules: WorkSchedule[], breaks: WorkBreak[]) {
  let total = 0;
  const day = new Date(`${from}T12:00:00Z`);
  const last = new Date(`${to}T12:00:00Z`);
  for (; day <= last; day.setUTCDate(day.getUTCDate() + 1)) {
    const sc = schedules.find(s => s.gun === day.getUTCDay());
    if (!sc || sc.tatil || !sc.baslangic || !sc.bitis) continue;
    const duration = minutes(sc.bitis) - minutes(sc.baslangic);
    const rest = breaks.filter(b => b.schedule_id === sc.id).reduce((sum, b) => sum + Math.max(0, minutes(b.bitis) - minutes(b.baslangic)), 0);
    total += Math.max(0, duration - rest);
  }
  return total;
}