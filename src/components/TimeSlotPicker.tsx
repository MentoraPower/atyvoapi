import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TimeSlotPickerProps {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  selectedDate: Date | null;
}

const TimeSlotPicker = ({ selectedTime, onSelectTime, selectedDate }: TimeSlotPickerProps) => {
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setLoading(true);
      setError(null);
      try {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        const { data, error: fnError } = await supabase.functions.invoke("check-availability", {
          body: { date: dateStr },
        });

        if (fnError) throw fnError;
        setSlots(data.availableSlots || []);
      } catch (err: any) {
        console.error("Error fetching slots:", err);
        setError("Erro ao buscar horários");
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [selectedDate]);

  return (
    <div className="glass-card p-4 sm:p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Horários Disponíveis
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Consultando agenda...</span>
        </div>
      ) : error ? (
        <p className="text-sm text-destructive text-center py-4">{error}</p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum horário disponível nesta data
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {slots.map((slot) => (
            <button
              key={slot}
              onClick={() => onSelectTime(slot)}
              className={`time-slot text-base font-medium ${selectedTime === slot ? "time-slot-active" : ""}`}
            >
              {slot}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimeSlotPicker;
