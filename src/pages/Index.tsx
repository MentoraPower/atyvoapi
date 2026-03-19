import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Loader2, CalendarCheck, AlertCircle } from "lucide-react";
import ScheduleCalendar from "@/components/ScheduleCalendar";
import TimeSlotPicker from "@/components/TimeSlotPicker";
import ContactForm from "@/components/ContactForm";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface ExistingAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  calendar_event_id: string | null;
}

const Index = () => {
  const [contactData, setContactData] = useState<{ name: string; email: string; phone: string; instagram: string; faturamento: string; aluna_biteti: string; faz_curso: string; decisao_parceiro: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [dialogStep, setDialogStep] = useState<"idle" | "loading" | "done" | "already-booked" | "cancelled">("idle");
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [existingAppointment, setExistingAppointment] = useState<ExistingAppointment | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [bookingError, setBookingError] = useState(false);

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const hasFullSelection = selectedDate && selectedTime;

  const checkExistingAppointment = async (email: string, phone: string): Promise<ExistingAppointment | null> => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_time, calendar_event_id")
      .or(`email.eq.${email},phone.eq.${phone}`)
      .gte("appointment_date", today)
      .order("appointment_date", { ascending: true })
      .limit(1);

    return data && data.length > 0 ? data[0] : null;
  };

  const handleContactSubmit = async (data: typeof contactData) => {
    if (!data) return;

    // Check if disqualified by faturamento
    if (data.faturamento === "Até R$ 3.000") {
      setIsDisqualified(true);
      return;
    }

    // Check for existing future appointment
    const existing = await checkExistingAppointment(data.email, data.phone);
    if (existing) {
      setContactData(data);
      setExistingAppointment(existing);
      setDialogStep("already-booked");
      setDialogOpen(true);
      return;
    }

    setContactData(data);
    setIsRescheduling(false);
  };

  const handleReschedule = () => {
    setIsRescheduling(true);
    setDialogOpen(false);
    setDialogStep("idle");
    // contactData is already set, show calendar
  };

  const handleKeepAppointment = () => {
    setDialogOpen(false);
    setDialogStep("idle");
    setContactData(null);
    setExistingAppointment(null);
  };

  const handleCancelAppointment = async () => {
    if (!existingAppointment) return;
    setIsCancelling(true);
    setDialogStep("loading");
    try {
      // Delete from Google Calendar
      if (existingAppointment.calendar_event_id) {
        await supabase.functions.invoke("sync-single-appointment", {
          body: { appointment_id: existingAppointment.id, action: "cancel" },
        });
      }
      // Delete from DB
      await supabase.from("appointments").delete().eq("id", existingAppointment.id);
      setDialogStep("cancelled");
    } catch (err) {
      console.error("Erro ao cancelar:", err);
      setDialogStep("cancelled");
    }
  };

  const handleConfirm = async () => {
    if (!contactData || !selectedDate || !selectedTime) return;
    setDialogOpen(true);
    setDialogStep("loading");
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      if (isRescheduling && existingAppointment) {
        // Update existing appointment in DB
        const { error: updateError } = await supabase
          .from("appointments")
          .update({
            appointment_date: dateStr,
            appointment_time: selectedTime,
            name: contactData.name,
            email: contactData.email,
            phone: contactData.phone,
            instagram: contactData.instagram,
            faturamento: contactData.faturamento,
            aluna_biteti: contactData.aluna_biteti,
            faz_curso: contactData.faz_curso,
            decisao_parceiro: contactData.decisao_parceiro,
          })
          .eq("id", existingAppointment.id);

        if (updateError) {
          throw new Error(updateError.message || "Falha ao atualizar agendamento");
        }

        // Delete old event and create new on Google Calendar
        try {
          await supabase.functions.invoke("sync-single-appointment", {
            body: {
              appointment_id: existingAppointment.id,
              action: "reschedule",
            },
          });
        } catch (syncErr) {
          console.error("Erro ao sincronizar com Google Calendar:", syncErr);
        }
      } else {
        // Create new appointment in DB
        const { data: newAppt, error: insertError } = await supabase.from("appointments").insert({
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          instagram: contactData.instagram,
          faturamento: contactData.faturamento,
          aluna_biteti: contactData.aluna_biteti,
          faz_curso: contactData.faz_curso,
          decisao_parceiro: contactData.decisao_parceiro,
          appointment_date: dateStr,
          appointment_time: selectedTime,
        }).select("id").single();

        if (insertError || !newAppt?.id) {
          throw new Error(insertError?.message || "Falha ao salvar agendamento");
        }

        // Create event on Google Calendar
        if (newAppt?.id) {
          try {
            await supabase.functions.invoke("sync-single-appointment", {
              body: {
                appointment_id: newAppt.id,
                action: "create",
              },
            });
          } catch (syncErr) {
            console.error("Erro ao sincronizar com Google Calendar:", syncErr);
          }
        }
      }

      setDialogOpen(false);
      setDialogStep("idle");
      setBookingComplete(true);
    } catch (err) {
      console.error("Erro ao salvar agendamento:", err);
      setDialogOpen(false);
      setDialogStep("idle");
      setBookingError(true);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setDialogStep("idle");
  };

  return (
    <div style={{ paddingLeft: '1.35em', paddingRight: '1.35em' }} className={`min-h-screen bg-background sm:px-4 flex flex-col ${!contactData || bookingComplete || isDisqualified ? 'justify-center' : 'py-8 sm:py-12'}`}>
      <div className="max-w-4xl mx-auto space-y-6 w-full">

        {bookingComplete ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 space-y-6 animate-fade-in max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <CalendarCheck className="w-10 h-10 text-foreground" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-foreground">
                {isRescheduling ? "Reagendamento Realizado!" : "Agendamento Realizado!"}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Você recebeu no e-mail a confirmação<br />do seu agendamento.
              </p>
              {selectedDate && selectedTime && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm font-medium text-foreground">
                  <CalendarCheck className="w-4 h-4" />
                  {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedTime}
                </div>
              )}
            </div>
          </div>
        ) : isDisqualified ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 space-y-6 animate-fade-in max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-bold text-foreground">
                Entendemos! 💛
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                A gente entende que esse não é o momento ideal para você agendar essa consultoria individual. Quando sentir que é a hora certa, estaremos aqui te esperando!
              </p>
            </div>
          </div>
        ) : bookingError ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 space-y-6 animate-fade-in max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-bold text-foreground">
                Ops, algo deu errado 😕
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Não foi possível concluir seu agendamento. Por favor, tente novamente.
              </p>
            </div>
            <button
              onClick={() => {
                setBookingError(false);
                setContactData(null);
                setSelectedDate(null);
                setSelectedTime(null);
              }}
              className="w-full max-w-[200px] h-12 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Tentar novamente
            </button>
          </div>
        ) : !contactData ? (
          <div className="max-w-2xl mx-auto w-full">
            <ContactForm onSubmit={handleContactSubmit} />
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                {isRescheduling ? "Reagendar horário" : "Agendar seu horário"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isRescheduling
                  ? "Escolha a nova data e horário para o seu atendimento"
                  : "Escolha a melhor data e horário para o seu atendimento"}
              </p>
            </div>

            {!selectedDate ? (
              <div className="max-w-md mx-auto w-full">
                <ScheduleCalendar selectedDate={selectedDate} onSelectDate={handleSelectDate} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <ScheduleCalendar selectedDate={selectedDate} onSelectDate={handleSelectDate} />
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center md:text-left">
                    Horários para{" "}
                    <span className="text-foreground font-medium">
                      {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                    </span>
                  </p>
                  <TimeSlotPicker
                    selectedTime={selectedTime}
                    onSelectTime={setSelectedTime}
                    selectedDate={selectedDate}
                  />
                </div>
              </div>
            )}

            {hasFullSelection && (
              <button
                onClick={handleConfirm}
                className="w-full max-w-md mx-auto h-14 rounded-xl bg-foreground text-background font-semibold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity animate-fade-in"
              >
                <CheckCircle2 className="w-5 h-5" />
                {isRescheduling ? "Reagendar" : "Confirmar"} —{" "}
                {format(selectedDate!, "dd/MM/yyyy", { locale: ptBR })} às {selectedTime}
              </button>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md border-2 border-border rounded-2xl shadow-2xl p-0 overflow-hidden w-[calc(100%-2rem)]">
          {/* Already booked popup */}
          {dialogStep === "already-booked" && existingAppointment && (
            <div className="flex flex-col items-center justify-center py-12 px-8 space-y-5 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-foreground">Você já está agendado</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Seu atendimento está marcado para
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm font-medium text-foreground">
                  <CalendarCheck className="w-4 h-4" />
                  {format(new Date(existingAppointment.appointment_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} às {existingAppointment.appointment_time}
                </div>
              </div>
              <div className="w-full space-y-2.5 pt-2">
                <button
                  onClick={handleReschedule}
                  className="w-full h-12 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Quero reagendar
                </button>
                <button
                  onClick={handleCancelAppointment}
                  className="w-full h-12 rounded-xl border border-destructive text-destructive font-medium text-sm hover:bg-destructive/10 transition-colors"
                >
                  Quero cancelar
                </button>
                <button
                  onClick={handleKeepAppointment}
                  className="w-full h-12 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors"
                >
                  Manter agendamento
                </button>
              </div>
            </div>
          )}

          {dialogStep === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 px-8 space-y-6 animate-fade-in">
              <div className="w-20 h-20 rounded-full border-4 border-muted flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-foreground animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">
                  {isCancelling ? "Cancelando seu agendamento..." : isRescheduling ? "Reagendando..." : "Agendando no sistema..."}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Com a Consultora Mentora<br />
                  <span className="font-semibold text-foreground">Beauty Geissa</span>
                </p>
              </div>
            </div>
          )}



          {dialogStep === "cancelled" && (
            <div className="flex flex-col items-center justify-center py-16 px-8 space-y-6 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">Agendamento Cancelado</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Seu agendamento foi cancelado com sucesso.
                </p>
              </div>
              <button
                onClick={() => {
                  setDialogOpen(false);
                  setDialogStep("idle");
                  setContactData(null);
                  setExistingAppointment(null);
                }}
                className="w-full max-w-[200px] h-12 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Ok, entendi!
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
