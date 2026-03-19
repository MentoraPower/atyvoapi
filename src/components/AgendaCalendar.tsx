import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface BlockedSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  start_time: string;
  end_time: string;
}

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

export function AgendaCalendar() {
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggledCells, setToggledCells] = useState<Set<string>>(new Set());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Date-specific blocking
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateStartTime, setDateStartTime] = useState("08:00");
  const [dateEndTime, setDateEndTime] = useState("18:00");
  const [savingDate, setSavingDate] = useState(false);
  const [blockFullDay, setBlockFullDay] = useState(true);

  const fetchBlocked = useCallback(async () => {
    setLoading(true);
    const [slotsRes, datesRes] = await Promise.all([
      supabase.from("blocked_slots").select("*").order("day_of_week"),
      supabase.from("blocked_dates").select("*").order("blocked_date"),
    ]);
    const slots = (slotsRes.data || []) as BlockedSlot[];
    const dates = (datesRes.data || []) as BlockedDate[];
    setBlockedSlots(slots);
    setBlockedDates(dates);

    const cells = new Set<string>();
    slots.forEach((slot) => {
      const startH = parseInt(slot.start_time.split(":")[0]);
      const endH = parseInt(slot.end_time.split(":")[0]);
      for (let h = startH; h < endH; h++) {
        cells.add(`${slot.day_of_week}-${String(h).padStart(2, "0")}:00`);
      }
    });
    setToggledCells(cells);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBlocked();
  }, [fetchBlocked]);

  // Auto-sync to Google Calendar on mount
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (loading || hasSyncedRef.current) return;
    if (blockedSlots.length === 0) return;
    hasSyncedRef.current = true;

    const slots = blockedSlots.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
    }));

    supabase.functions.invoke("sync-blocked-slots", { body: { slots } })
      .then(({ error }) => {
        if (error) console.error("Auto-sync error:", error);
        else console.log("Auto-sync to Google Calendar completed");
      });
  }, [loading, blockedSlots]);

  const saveChanges = useCallback(async (cells: Set<string>) => {
    setSaving(true);
    try {
      const newSlots: { day_of_week: number; start_time: string; end_time: string }[] = [];

      for (let day = 0; day <= 6; day++) {
        const blocked = HOURS.filter((h) => cells.has(`${day}-${h}`))
          .map((h) => parseInt(h.split(":")[0]))
          .sort((a, b) => a - b);

        if (blocked.length === 0) continue;

        let start = blocked[0];
        let prev = blocked[0];
        for (let i = 1; i <= blocked.length; i++) {
          if (i < blocked.length && blocked[i] === prev + 1) {
            prev = blocked[i];
          } else {
            newSlots.push({
              day_of_week: day,
              start_time: `${String(start).padStart(2, "0")}:00`,
              end_time: `${String(prev + 1).padStart(2, "0")}:00`,
            });
            if (i < blocked.length) {
              start = blocked[i];
              prev = blocked[i];
            }
          }
        }
      }

      await supabase.from("blocked_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (newSlots.length > 0) {
        const { error } = await supabase.from("blocked_slots").insert(newSlots);
        if (error) throw error;
      }

      await supabase.functions.invoke("sync-blocked-slots", {
        body: { slots: newSlots },
      });

      toast.success("Agenda salva automaticamente");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  }, []);

  const toggleCell = (day: number, hour: string) => {
    const key = `${day}-${hour}`;
    setToggledCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveChanges(next), 1500);

      return next;
    });
  };

  const handleAddDateBlock = async () => {
    if (!selectedDate) {
      toast.error("Selecione uma data");
      return;
    }
    setSavingDate(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const startTime = blockFullDay ? "00:00" : dateStartTime;
      const endTime = blockFullDay ? "23:59" : dateEndTime;

      const { error } = await supabase.from("blocked_dates").insert({
        blocked_date: dateStr,
        start_time: startTime,
        end_time: endTime,
      });
      if (error) throw error;

      await supabase.functions.invoke("sync-date-block", {
        body: { action: "create", date: dateStr, start_time: startTime, end_time: endTime },
      });

      toast.success("Data bloqueada com sucesso");
      setDateDialogOpen(false);
      setSelectedDate(undefined);
      fetchBlocked();
    } catch (err: any) {
      toast.error("Erro ao bloquear data: " + (err.message || "Tente novamente"));
    } finally {
      setSavingDate(false);
    }
  };

  const handleDeleteDateBlock = async (block: BlockedDate) => {
    try {
      await supabase.from("blocked_dates").delete().eq("id", block.id);

      await supabase.functions.invoke("sync-date-block", {
        body: { action: "delete", date: block.blocked_date, start_time: block.start_time, end_time: block.end_time },
      });

      toast.success("Bloqueio removido");
      fetchBlocked();
    } catch (err: any) {
      toast.error("Erro ao remover: " + (err.message || "Tente novamente"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date-specific blocks */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Datas bloqueadas</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDateDialogOpen(true)}
            className="h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Adicionar
          </Button>
        </div>

        {blockedDates.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Nenhuma data bloqueada.</p>
        ) : (
          <div className="space-y-1.5">
            {blockedDates.map((block) => {
              const dateObj = new Date(block.blocked_date + "T12:00:00");
              const isFullDay = block.start_time === "00:00" && block.end_time === "23:59";
              return (
                <div
                  key={block.id}
                  className="flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarIcon className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <span className="text-sm text-foreground truncate">
                      {format(dateObj, "dd/MM/yyyy (EEE)", { locale: ptBR })}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {isFullDay ? "Dia inteiro" : `${block.start_time}–${block.end_time}`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteDateBlock(block)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recurring blocks grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Horários recorrentes</h3>
          {saving && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Salvando...
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left font-semibold text-foreground sticky left-0 bg-muted/30 z-10 min-w-[60px]">
                    Hora
                  </th>
                  {DAYS.map((day, i) => (
                    <th key={i} className="px-2 py-2 text-center font-semibold text-foreground min-w-[100px]">
                      {day.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-border/30">
                    <td className="px-3 py-0 font-medium text-muted-foreground sticky left-0 bg-card z-10 text-[11px]">
                      {hour}
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const key = `${dayIdx}-${hour}`;
                      const isBlocked = toggledCells.has(key);
                      return (
                        <td key={dayIdx} className="p-0">
                          <button
                            onClick={() => toggleCell(dayIdx, hour)}
                            className={`w-full h-8 transition-colors border-l border-border/20 ${
                              isBlocked
                                ? "bg-destructive/40 hover:bg-destructive/50"
                                : "hover:bg-muted/40"
                            }`}
                            title={`${DAYS[dayIdx]} ${hour} — ${isBlocked ? "Bloqueado" : "Disponível"}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Bloquear data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className={cn("p-3 pointer-events-auto mx-auto")}
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={blockFullDay}
                onChange={(e) => setBlockFullDay(e.target.checked)}
                className="rounded border-border"
              />
              Dia inteiro
            </label>

            {!blockFullDay && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Início</label>
                  <select
                    value={dateStartTime}
                    onChange={(e) => setDateStartTime(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                  <select
                    value={dateEndTime}
                    onChange={(e) => setDateEndTime(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDateDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAddDateBlock}
              disabled={!selectedDate || savingDate}
            >
              {savingDate && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
