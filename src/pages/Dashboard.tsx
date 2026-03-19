import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MoreHorizontal, Download, Search, X, CalendarIcon, FileCode, Copy, Check, Palette, LogOut, Settings } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, PieChart, Pie, AreaChart, Area } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { generateFormHTML, generateLeadFormHTML } from "@/lib/generateFormHTML";


type FilterType = "maximo" | "hoje" | "ontem" | "7dias" | "30dias" | "personalizado";
type TabType = "dashboard" | "contatos" | "configuracoes" | "formulario";
type SettingsTab = "conta" | "integracoes";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  calendar_event_id: string | null;
  name: string;
  email: string;
  phone: string;
  instagram: string | null;
  created_at: string;
  faturamento: string | null;
  aluna_biteti: string | null;
  faz_curso: string | null;
  decisao_parceiro: string | null;
}

interface FormSubmission {
  id: string;
  form_id: string | null;
  product: string | null;
  owner_id: string;
  name: string;
  email: string;
  phone: string;
  faturamento: string | null;
  area_beleza?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  created_at: string;
}

const Dashboard = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<FilterType>(() => (localStorage.getItem("dash_filter") as FilterType) || "hoje");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsAppointment, setActionsAppointment] = useState<Appointment | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelAppointment, setCancelAppointment] = useState<Appointment | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [blockedRanges, setBlockedRanges] = useState<{ start_time: string; end_time: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => {
    const saved = localStorage.getItem("dash_customRange");
    if (!saved) return undefined;
    try {
      const parsed = JSON.parse(saved);
      return {
        from: parsed.from ? new Date(parsed.from) : undefined,
        to: parsed.to ? new Date(parsed.to) : undefined,
      };
    } catch { return undefined; }
  });
  const [tab, setTab] = useState<TabType>(() => (localStorage.getItem("dash_tab") as TabType) || "dashboard");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(() => (localStorage.getItem("dash_settingsTab") as SettingsTab) || "conta");
  const [formGenName, setFormGenName] = useState("");
  const [formGenProduct, setFormGenProduct] = useState("");
  const [formGenCode, setFormGenCode] = useState("");
  const [formGenCopied, setFormGenCopied] = useState(false);
  const [formBgColor, setFormBgColor] = useState("#fafafa");
  const [formTextColor, setFormTextColor] = useState("#111111");
  const [formSaving, setFormSaving] = useState(false);
  const [savedForms, setSavedForms] = useState<{ id: string; name: string; product: string; bg_color: string; text_color: string; html_code: string; created_at: string }[]>([]);
  const [savedFormsLoading, setSavedFormsLoading] = useState(false);
  const [deleteFormId, setDeleteFormId] = useState<string | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
  const [formSubmissionsLoading, setFormSubmissionsLoading] = useState(false);
  const [ebookFilter, setEbookFilter] = useState<string>("todos");
  const [contactsPage, setContactsPage] = useState(1);
  const CONTACTS_PER_PAGE = 50;
  const isMobile = useIsMobile();

  const ALLOWED_EMAIL = "bergehpatrick@gmail.com";
  const isFormAllowed = userEmail === ALLOWED_EMAIL;

  // Persist state to localStorage
  useEffect(() => { localStorage.setItem("dash_filter", filter); }, [filter]);
  useEffect(() => { localStorage.setItem("dash_tab", tab); }, [tab]);
  useEffect(() => { localStorage.setItem("dash_settingsTab", settingsTab); }, [settingsTab]);
  useEffect(() => {
    if (customRange?.from) {
      localStorage.setItem("dash_customRange", JSON.stringify({ from: customRange.from.toISOString(), to: customRange.to?.toISOString() }));
    } else {
      localStorage.removeItem("dash_customRange");
    }
  }, [customRange]);

  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/acesso", { replace: true });
      } else {
        setUserEmail(session.user?.email ?? null);
        setUserId(session.user?.id ?? null);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/acesso", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!isFormAllowed) return;
    const fetchSavedForms = async () => {
      setSavedFormsLoading(true);
      const { data } = await supabase
        .from("saved_forms")
        .select("id, name, product, bg_color, text_color, html_code, created_at")
        .order("created_at", { ascending: false });
      setSavedForms(data || []);
      setSavedFormsLoading(false);
    };
    fetchSavedForms();
  }, [isFormAllowed]);

  // Busca respostas dos formulários (apenas para bergehpatrick@gmail.com) + realtime
  useEffect(() => {
    if (!isFormAllowed) return;

    // Carga inicial
    const fetchSubmissions = async () => {
      setFormSubmissionsLoading(true);
      const { data } = await supabase
        .from("form_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      setFormSubmissions((data as unknown as FormSubmission[]) || []);
      setFormSubmissionsLoading(false);
    };
    fetchSubmissions();

    // Realtime — merge silencioso (sem piscar)
    const channel = supabase
      .channel("form-submissions-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "form_submissions" },
        (payload) => {
          setFormSubmissions((prev) => [
            payload.new as unknown as FormSubmission,
            ...prev,
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "form_submissions" },
        (payload) => {
          setFormSubmissions((prev) =>
            prev.map((s) =>
              s.id === (payload.new as FormSubmission).id
                ? (payload.new as unknown as FormSubmission)
                : s
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "form_submissions" },
        (payload) => {
          setFormSubmissions((prev) =>
            prev.filter((s) => s.id !== (payload.old as FormSubmission).id)
          );
        }
      )
      .subscribe((status) => {
        console.log("[realtime form_submissions]", status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [isFormAllowed]);

  useEffect(() => {
    const fetchAppointments = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: false });
      setAppointments(data || []);
    };
    fetchAppointments();

    // Realtime — merge silencioso (sem piscar)
    const channel = supabase
      .channel("appointments-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        (payload) => {
          setAppointments((prev) => [payload.new as typeof prev[0], ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments" },
        (payload) => {
          setAppointments((prev) =>
            prev.map((a) =>
              a.id === (payload.new as typeof a).id
                ? (payload.new as typeof a)
                : a
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "appointments" },
        (payload) => {
          setAppointments((prev) =>
            prev.filter((a) => a.id !== (payload.old as typeof a).id)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getSaoPauloDate = (daysOffset = 0) => {
    const [year, month, day] = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .split("-")
      .map(Number);

    const base = new Date(Date.UTC(year, month - 1, day));
    base.setUTCDate(base.getUTCDate() + daysOffset);
    return base.toISOString().slice(0, 10);
  };

  const toSaoPauloDateFromTimestamp = (timestamp: string | null | undefined): string | null => {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  };

  const filteredAppointments = useMemo(() => {
    const today = getSaoPauloDate();
    const yesterdayStr = getSaoPauloDate(-1);
    const sevenDaysAgo = getSaoPauloDate(-6);
    const thirtyDaysAgo = getSaoPauloDate(-29);

    return appointments.filter((a) => {
      const createdDate = toSaoPauloDateFromTimestamp(a.created_at);
      if (!createdDate) return false;
      switch (filter) {
        case "maximo":
          return true;
        case "hoje":
          return createdDate === today;
        case "ontem":
          return createdDate === yesterdayStr;
        case "7dias":
          return createdDate >= sevenDaysAgo && createdDate <= today;
        case "30dias":
          return createdDate >= thirtyDaysAgo && createdDate <= today;
        case "personalizado":
          if (!customRange?.from) return true;
          const from = format(customRange.from, "yyyy-MM-dd");
          const to = format(customRange.to || customRange.from, "yyyy-MM-dd");
          return createdDate >= from && createdDate <= to;
        default:
          return true;
      }
    });
  }, [appointments, filter, customRange]);

  const filteredCount = filteredAppointments.length;

  const faturamentoData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAppointments.forEach((a) => {
      const key = a.faturamento || "Não informado";
      counts[key] = (counts[key] || 0) + 1;
    });
    const order = ["Até R$ 3.000", "R$ 3.000 a R$ 10.000", "R$ 10.000 a R$ 30.000", "Acima de R$ 30.000"];
    return order.map((name) => ({ name, value: counts[name] || 0 }));
  }, [filteredAppointments]);

  const barColors = ["hsl(var(--foreground))", "hsl(var(--muted-foreground))", "hsl(var(--foreground) / 0.6)", "hsl(var(--muted-foreground) / 0.4)"];

  const cursoData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAppointments.forEach((a) => {
      if (a.faz_curso) counts[a.faz_curso] = (counts[a.faz_curso] || 0) + 1;
    });
    const order = ["Online", "Presencial", "Não faço"];
    return order.map((name) => ({ name, value: counts[name] || 0 }));
  }, [filteredAppointments]);

  const decisaoData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAppointments.forEach((a) => {
      const key = a.decisao_parceiro || "Não informado";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredAppointments]);

  const decisaoColors = ["hsl(var(--foreground))", "hsl(var(--muted-foreground))", "hsl(var(--foreground) / 0.4)", "hsl(var(--muted-foreground) / 0.6)"];

  const pieColors = ["hsl(var(--foreground))", "hsl(var(--muted-foreground))", "hsl(var(--foreground) / 0.4)"];

  const horarioData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAppointments.forEach((a) => {
      if (a.appointment_time) counts[a.appointment_time] = (counts[a.appointment_time] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredAppointments]);
  const diaSemanaData = useMemo(() => {
    const diasPt = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const counts: Record<string, number> = { Domingo: 0, Segunda: 0, Terça: 0, Quarta: 0, Quinta: 0, Sexta: 0, Sábado: 0 };
    filteredAppointments.forEach((a) => {
      const d = new Date(a.appointment_date + "T12:00:00");
      counts[diasPt[d.getDay()]] = (counts[diasPt[d.getDay()]] || 0) + 1;
    });
    return diasPt.map((name) => ({ name, value: counts[name] }));
  }, [filteredAppointments]);


  const exportContacts = (type: "csv" | "excel") => {
    const headers = ["Nome", "Email", "Telefone", "Instagram", "Data Agendada", "Horário", "Faturamento", "Aluna Biteti", "Curso", "Decisão Parceiro", "Criado em"];
    const rows = appointments.map((a) => [
      a.name,
      a.email,
      a.phone,
      a.instagram || "",
      format(new Date(a.appointment_date + "T12:00:00"), "dd/MM/yyyy"),
      a.appointment_time,
      a.faturamento || "",
      a.aluna_biteti || "",
      a.faz_curso || "",
      a.decisao_parceiro || "",
      format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    ]);

    if (type === "csv") {
      const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contatos_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado com sucesso");
    } else {
      // Excel-compatible XML
      const xmlRows = rows.map((r) =>
        `<Row>${r.map((c) => `<Cell><Data ss:Type="String">${c.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>`).join("")}</Row>`
      ).join("");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Contatos"><Table>
<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join("")}</Row>
${xmlRows}
</Table></Worksheet></Workbook>`;
      const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contatos_${format(new Date(), "yyyy-MM-dd")}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exportado com sucesso");
    }
  };

  const handleCancelAppointment = async (appointment: Appointment) => {
    setCancelAppointment(appointment);
    setCancelConfirmOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelAppointment) return;
    setCancelConfirmOpen(false);
    setActionLoading(cancelAppointment.id);
    try {
      // Delete from Google Calendar via edge function
      if (cancelAppointment.calendar_event_id) {
        await supabase.functions.invoke("sync-single-appointment", {
          body: { appointment_id: cancelAppointment.id, action: "cancel" },
        });
      }
      const { error } = await supabase.from("appointments").delete().eq("id", cancelAppointment.id);
      if (error) throw error;
      toast.success("Agendamento cancelado com sucesso");
    } catch (err: any) {
      toast.error("Erro ao cancelar: " + (err.message || "Tente novamente"));
    } finally {
      setActionLoading(null);
    }
  };

  const openReschedule = (appointment: Appointment) => {
    setRescheduleAppointment(appointment);
    setRescheduleDate(undefined);
    setRescheduleTime("");
    setAvailableSlots([]);
    setRescheduleOpen(true);
  };

  const fetchAvailableSlots = async (date: Date) => {
    setSlotsLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayOfWeek = date.getDay();
      const [slotsRes, bookedRes, blockedRes] = await Promise.all([
        supabase.functions.invoke("check-availability", { body: { date: dateStr } }),
        supabase.from("appointments").select("appointment_time").eq("appointment_date", dateStr),
        supabase.from("blocked_slots").select("start_time, end_time").eq("day_of_week", dayOfWeek),
      ]);
      setAvailableSlots(slotsRes.data?.availableSlots || []);
      setBookedTimes((bookedRes.data || []).map((a: { appointment_time: string }) => a.appointment_time));
      setBlockedRanges((blockedRes.data || []) as { start_time: string; end_time: string }[]);
    } catch {
      setAvailableSlots([]);
      setBookedTimes([]);
      setBlockedRanges([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleRescheduleDateSelect = (date: Date | undefined) => {
    setRescheduleDate(date);
    setRescheduleTime("");
    if (date) fetchAvailableSlots(date);
    else setAvailableSlots([]);
  };

  const handleReschedule = async () => {
    if (!rescheduleAppointment || !rescheduleDate || !rescheduleTime.trim()) {
      toast.error("Selecione a data e informe o horário");
      return;
    }
    // Check if typed time is already booked (exclude current appointment)
    const isBooked = bookedTimes.includes(rescheduleTime.trim()) &&
      rescheduleAppointment.appointment_time !== rescheduleTime.trim();
    if (isBooked) {
      toast.error("Esse horário já está preenchido. Escolha outro horário.");
      return;
    }
    setActionLoading(rescheduleAppointment.id);
    try {
      const newDate = format(rescheduleDate, "yyyy-MM-dd");
      // Save reschedule history
      await supabase.from("reschedule_history").insert({
        appointment_id: rescheduleAppointment.id,
        old_date: rescheduleAppointment.appointment_date,
        old_time: rescheduleAppointment.appointment_time,
        new_date: newDate,
        new_time: rescheduleTime.trim(),
      });
      // Update appointment with new date/time
      const { error } = await supabase
        .from("appointments")
        .update({ appointment_date: newDate, appointment_time: rescheduleTime.trim(), calendar_event_id: null })
        .eq("id", rescheduleAppointment.id);
      if (error) throw error;
      // Sync to Google Calendar (reschedule deletes old + creates new)
      await supabase.functions.invoke("sync-single-appointment", {
        body: { appointment_id: rescheduleAppointment.id, action: "reschedule" },
      });
      toast.success("Reagendamento realizado com sucesso");
      setRescheduleOpen(false);
    } catch (err: any) {
      toast.error("Erro ao reagendar: " + (err.message || "Tente novamente"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateForm = () => {
    try {
      if (!formGenName.trim()) return;

      // Fallback: lê o email/id diretamente do localStorage se o estado ainda não foi populado
      const ALLOWED = "bergehpatrick@gmail.com";
      let effectiveEmail = userEmail;
      let effectiveUserId = userId;
      if (!effectiveEmail || !effectiveUserId) {
        try {
          const key = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
          if (key) {
            const parsed = JSON.parse(localStorage.getItem(key) ?? "{}");
            effectiveEmail = parsed?.user?.email ?? effectiveEmail;
            effectiveUserId = parsed?.user?.id ?? effectiveUserId;
          }
        } catch { /* ignora */ }
      }

      const allowed = effectiveEmail === ALLOWED;

      if (allowed) {
        const uid = effectiveUserId ?? "";
        const tempId = ([1e7] as unknown as string + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: string) =>
          (parseInt(c) ^ (Math.random() * 16 >> parseInt(c) / 4)).toString(16)
        );
        const productLabel = formGenProduct.trim() || "Qualificação de Leads";
        const html = generateLeadFormHTML(formGenName, productLabel, formBgColor, formTextColor, uid, tempId);
        setFormGenCode(html);
      } else {
        if (!formGenProduct.trim()) return;
        const html = generateFormHTML(formGenName, formGenProduct, formBgColor, formTextColor);
        setFormGenCode(html);
      }
    } catch (err) {
      console.error("handleGenerateForm error:", err);
      toast.error("Erro ao gerar o código. Verifique o console.");
    }
  };





  const handleSaveForm = async () => {
    if (!formGenCode || !formGenName.trim()) return;
    setFormSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      if (editingFormId) {
        // Modo edição: atualiza registro existente
        const finalHTML = isFormAllowed
          ? generateLeadFormHTML(formGenName, formGenProduct, formBgColor, formTextColor, user.id, editingFormId)
          : formGenCode;
        const { error } = await supabase.from("saved_forms").update({
          name: formGenName.trim(),
          product: formGenProduct.trim(),
          bg_color: formBgColor,
          text_color: formTextColor,
          html_code: finalHTML,
        }).eq("id", editingFormId);
        if (error) throw error;
        setFormGenCode(finalHTML);
        setSavedForms(prev => prev.map(f => f.id === editingFormId ? { ...f, name: formGenName.trim(), product: formGenProduct.trim(), bg_color: formBgColor, text_color: formTextColor, html_code: finalHTML } : f));
        toast.success("Formulário atualizado!");
      } else {
        // Modo criação: insere novo
        if (isFormAllowed) {
          const { data: inserted, error } = await supabase.from("saved_forms").insert({
            user_id: user.id,
            name: formGenName.trim(),
            product: formGenProduct.trim(),
            bg_color: formBgColor,
            text_color: formTextColor,
            html_code: "temp",
          }).select("id").single();
          if (error) throw error;
          const realId = inserted?.id ?? "";
          const finalHTML = generateLeadFormHTML(formGenName, formGenProduct, formBgColor, formTextColor, user.id, realId);
          await supabase.from("saved_forms").update({ html_code: finalHTML }).eq("id", realId);
          setFormGenCode(finalHTML);
        } else {
          const { error } = await supabase.from("saved_forms").insert({
            user_id: user.id,
            name: formGenName.trim(),
            product: formGenProduct.trim(),
            bg_color: formBgColor,
            text_color: formTextColor,
            html_code: formGenCode,
          });
          if (error) throw error;
        }
        toast.success("Formulário salvo!");
        // Recarrega lista
        const { data } = await supabase
          .from("saved_forms")
          .select("id, name, product, bg_color, text_color, html_code, created_at")
          .order("created_at", { ascending: false });
        setSavedForms(data || []);
      }
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteForm = async (id: string) => {
    setDeleteFormId(null);
    const { error } = await supabase.from("saved_forms").delete().eq("id", id);
    if (error) { toast.error("Erro ao deletar"); return; }
    setSavedForms(prev => prev.filter(f => f.id !== id));
    if (editingFormId === id) {
      setEditingFormId(null);
      setFormGenName("");
      setFormGenProduct("");
      setFormGenCode("");
    }
    toast.success("Formulário deletado");
  };

  const handleOpenEdit = (form: typeof savedForms[0]) => {
    setFormGenName(form.name);
    setFormGenProduct(form.product);
    setFormBgColor(form.bg_color);
    setFormTextColor(form.text_color);
    setFormGenCode(form.html_code);
    setEditingFormId(form.id);
    // Scrolla pro topo do painel
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyFormCode = async () => {
    try {
      await navigator.clipboard.writeText(formGenCode);
      setFormGenCopied(true);
      setTimeout(() => setFormGenCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = formGenCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setFormGenCopied(true);
      setTimeout(() => setFormGenCopied(false), 2500);
    }
  };


  const dashboardData = useMemo(() => {
    const fs = ebookFilter === "todos" ? formSubmissions : formSubmissions.filter(s => s.product === ebookFilter);
    const totalLeads = fs.length;
    const highRevenue = fs.filter(s => s.faturamento === "Acima de R$ 10.000").length;
    const medRevenue = fs.filter(s => s.faturamento === "De R$ 5.000 a R$ 10.000").length;

    // Tendência – leads por dia (últimos 14 dias)
    const today = new Date();
    const trendData = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (13 - i));
      const label = format(d, "dd/MM", { locale: ptBR });
      const count = fs.filter(s => {
        const sd = new Date(s.created_at);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth() && sd.getDate() === d.getDate();
      }).length;
      return { name: label, value: count };
    });

    // Donut – Faturamento
    const fatColors = ["#e5e7eb", "#9ca3af", "#6b7280", "#1a1a1a"];
    const fatKeys = ["Até R$ 3.000", "De R$ 3.000 a R$ 5.000", "De R$ 5.000 a R$ 10.000", "Acima de R$ 10.000"];
    const fatMap: Record<string, number> = {};
    fs.forEach(s => { if (s.faturamento) fatMap[s.faturamento] = (fatMap[s.faturamento] || 0) + 1; });
    const fatDonut = fatKeys.map((k, i) => ({ name: k, value: fatMap[k] || 0, color: fatColors[i] }));
    const fatTotal = fatDonut.reduce((a, b) => a + b.value, 0) || 1;

    // Barras horizontais – Área de atuação
    const areaOrder = ["Cílios", "Sobrancelhas", "Maquiagem", "Estética", "Cabelos", "Unhas", "HOF (harmonização)", "Outro"];
    const areaMap: Record<string, number> = {};
    fs.forEach(s => { if (s.area_beleza) areaMap[s.area_beleza] = (areaMap[s.area_beleza] || 0) + 1; });
    const areaData = areaOrder
      .map(k => ({ name: k, value: areaMap[k] || 0 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const areaMax = areaData[0]?.value || 1;

    // Donut – Área (top 5)
    const areaColors = ["#1a1a1a", "#374151", "#6b7280", "#9ca3af", "#d1d5db"];
    const areaDonut = areaData.slice(0, 5).map((d, i) => ({ ...d, color: areaColors[i] }));

    // Ebook options e leads por formulário
    const ebookOptions = ["todos", ...Array.from(new Set(formSubmissions.map(s => s.product).filter(Boolean) as string[]))];
    const ebookCounts = ebookOptions.filter(e => e !== "todos")
      .map(eb => ({ name: eb, value: formSubmissions.filter(s => s.product === eb).length }))
      .sort((a, b) => b.value - a.value);
    const ebookMax = ebookCounts[0]?.value || 1;

    return { fs, totalLeads, highRevenue, medRevenue, trendData, fatDonut, fatTotal, areaData, areaMax, areaDonut, ebookOptions, ebookCounts, ebookMax };
  }, [formSubmissions, ebookFilter]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "maximo", label: "Máximo" },
    { key: "hoje", label: "Hoje" },
    { key: "ontem", label: "Ontem" },
    { key: "7dias", label: "7 dias" },
    { key: "30dias", label: "30 dias" },
    { key: "personalizado", label: "Personalizado" },
  ];

  const settingsTabs: { key: SettingsTab; label: string }[] = [
    { key: "conta", label: "Conta" },
    { key: "integracoes", label: "Integrações" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar activeTab={tab} onTabChange={(t) => setTab(t as TabType)} />

      <div className={`${isMobile ? "pb-20" : "md:pl-[76px]"} px-4 py-8`}>
        <div className="w-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-foreground shrink-0">
              {tab === "dashboard" ? "Dashboard" : tab === "contatos" ? "Contatos" : tab === "formulario" ? "Criar Formulário" : "Configurações"}
            </h1>
            {tab === "contatos" && (
              <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Pesquisar por nome, email ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0">
                      <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => exportContacts("csv")} className="cursor-pointer">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportContacts("excel")} className="cursor-pointer">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Dashboard Content */}
          {tab === "dashboard" && (
            isFormAllowed ? (
              /* Dashboard ultra-moderno de leads */
              (() => {
                const { totalLeads, highRevenue, medRevenue, trendData, fatDonut, fatTotal, areaData, areaMax, areaDonut, ebookOptions, ebookCounts, ebookMax } = dashboardData;
                return (
                  <div className="space-y-4">

                    {/* Filtro por ebook/formulário */}
                    {ebookOptions.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {ebookOptions.map(opt => (
                          <button
                            key={opt}
                            onClick={() => setEbookFilter(opt)}
                            className={`h-8 px-4 rounded-full text-sm font-medium transition-all ${ebookFilter === opt
                              ? "bg-[#1a1a1a] text-white shadow"
                              : "bg-white border border-[#e5e5e5] text-[#555] hover:border-[#aaa]"
                              }`}
                          >
                            {opt === "todos" ? "Todos" : opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* ── Row 1: KPI Cards ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Total Leads */}
                      <div className="rounded-2xl bg-[#1a1a1a] text-white p-5 flex flex-col gap-2">
                        <span className="text-[11px] uppercase tracking-widest text-white/50">Total de Leads</span>
                        <span className="text-5xl font-black leading-none">{totalLeads}</span>
                        <span className="text-[11px] text-white/40 mt-auto">{ebookFilter === "todos" ? "todos os formulários" : ebookFilter}</span>
                      </div>
                      {/* Faturamento Alto */}
                      <div className="rounded-2xl bg-white border border-[#ebebeb] p-5 flex flex-col gap-2 shadow-sm">
                        <span className="text-[11px] uppercase tracking-widest text-[#aaa]">Fat. Alto</span>
                        <span className="text-5xl font-black leading-none text-[#1a1a1a]">{highRevenue}</span>
                        <span className="text-[11px] text-[#ccc] mt-auto">acima de R$ 20k</span>
                      </div>
                      {/* Faturamento Médio */}
                      <div className="rounded-2xl bg-white border border-[#ebebeb] p-5 flex flex-col gap-2 shadow-sm">
                        <span className="text-[11px] uppercase tracking-widest text-[#aaa]">Fat. Médio</span>
                        <span className="text-5xl font-black leading-none text-[#1a1a1a]">{medRevenue}</span>
                        <span className="text-[11px] text-[#ccc] mt-auto">R$5k – R$10k</span>
                      </div>
                    </div>

                    {/* ── Row 2: Tendência (area) + Faturamento (donut) ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Gráfico de área – tendência 14 dias */}
                      <div className="md:col-span-2 rounded-2xl bg-white border border-[#ebebeb] shadow-sm overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-start justify-between px-6 pt-5 pb-3">
                          <div>
                            <p className="text-xs text-[#aaa] uppercase tracking-widest mb-0.5">Tendência</p>
                            <p className="text-sm font-semibold text-[#1a1a1a]">Leads — últimos 14 dias</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-[#1a1a1a] leading-none">{trendData.reduce((a, b) => a + b.value, 0)}</p>
                            <p className="text-[11px] text-[#ccc] mt-0.5">no período</p>
                          </div>
                        </div>
                        {/* Gráfico — flex-1 preenche o restante do card */}
                        <div className="flex-1 min-h-0" style={{ height: 160 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={trendData}
                              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#1a1a1a" stopOpacity={0.08} />
                                  <stop offset="100%" stopColor="#1a1a1a" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 9, fill: "#d1d5db" }}
                                axisLine={false}
                                tickLine={false}
                                interval={1}
                                height={22}
                              />
                              {/* domínio alto = linha fica sempre na base */}
                              <YAxis
                                hide
                                domain={[0, (dataMax: number) => Math.max(dataMax, 1) * 10]}
                              />
                              <Tooltip
                                contentStyle={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, fontSize: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
                                formatter={(v: number) => [v, "leads"]}
                                labelStyle={{ color: "#888", fontWeight: 600 }}
                                cursor={{ stroke: "#f0f0f0", strokeWidth: 1 }}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#1a1a1a"
                                strokeWidth={2.5}
                                fill="url(#leadGrad)"
                                dot={false}
                                activeDot={{ r: 4, fill: "#1a1a1a", strokeWidth: 0 }}
                                isAnimationActive={true}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      {/* Donut – Faturamento */}
                      <div className="rounded-2xl bg-white border border-[#ebebeb] p-6 shadow-sm flex flex-col">
                        <p className="text-sm font-semibold text-[#1a1a1a] mb-4">Faturamento</p>
                        <div className="flex-1 flex items-center justify-center">
                          <div className="relative w-56 h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={fatDonut.every(d => d.value === 0) ? [{ name: "vazio", value: 1, color: "#f2f2f2" }] : fatDonut}
                                  dataKey="value" cx="50%" cy="50%" innerRadius={54} outerRadius={84} strokeWidth={0} paddingAngle={fatDonut.some(d => d.value > 0) ? 3 : 0}>
                                  {(fatDonut.every(d => d.value === 0) ? [{ color: "#f2f2f2" }] : fatDonut).map((e, i) => (
                                    <Cell key={i} fill={e.color} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, fontSize: 12 }}
                                  formatter={(v: number) => [v, "leads"]} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-2xl font-black text-[#1a1a1a]">{fatTotal}</span>
                              <span className="text-[9px] text-[#aaa] uppercase tracking-wide">total</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 mt-3">
                          {fatDonut.map((d, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="text-[11px] text-[#888] truncate flex-1">{d.name.replace("De R$ ", "").replace("Até R$ ", "≤ R$").replace("Acima de R$ ", "> R$")}</span>
                              <span className="text-[11px] font-semibold text-[#1a1a1a]">{Math.round((d.value / fatTotal) * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ── Row 3: Área de atuação (barras) + Donut área + Leads por form ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Barras – Área de Atuação */}
                      <div className="md:col-span-1 rounded-2xl bg-white border border-[#ebebeb] p-6 shadow-sm">
                        <p className="text-sm font-semibold text-[#1a1a1a] mb-4">Área de Atuação</p>
                        {areaData.length === 0 ? (
                          <p className="text-[#ccc] text-sm text-center py-8">Sem dados</p>
                        ) : (
                          <div className="space-y-3">
                            {areaData.map(d => (
                              <div key={d.name}>
                                <div className="flex justify-between items-baseline mb-1">
                                  <span className="text-xs text-[#777]">{d.name}</span>
                                  <span className="text-xs font-bold text-[#1a1a1a]">{d.value}</span>
                                </div>
                                <div className="h-7 rounded-full bg-[#f2f2f2] overflow-hidden">
                                  <div className="h-full rounded-full bg-[#1a1a1a] transition-all duration-700"
                                    style={{ width: `${Math.round((d.value / areaMax) * 100)}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Donut – Área de Atuação (top 5) */}
                      <div className="rounded-2xl bg-white border border-[#ebebeb] p-6 shadow-sm flex flex-col">
                        <p className="text-sm font-semibold text-[#1a1a1a] mb-4">Distribuição por Área</p>
                        <div className="flex-1 flex items-center justify-center">
                          <div className="relative w-56 h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={areaDonut.length > 0 ? areaDonut : [{ name: "vazio", value: 1, color: "#f2f2f2" }]}
                                  dataKey="value" cx="50%" cy="50%" innerRadius={54} outerRadius={84} strokeWidth={0}
                                  paddingAngle={areaDonut.some(d => d.value > 0) ? 3 : 0}
                                >
                                  {(areaDonut.length > 0 ? areaDonut : [{ color: "#f2f2f2" }]).map((e, i) => (
                                    <Cell key={i} fill={e.color} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, fontSize: 12 }}
                                  formatter={(v: number) => [v, "leads"]} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-2xl font-black text-[#1a1a1a]">{areaDonut.reduce((a, b) => a + b.value, 0) || 0}</span>
                              <span className="text-[9px] text-[#aaa] uppercase tracking-wide">total</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 mt-3">
                          {areaDonut.map((d, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="text-[11px] text-[#888] truncate flex-1">{d.name}</span>
                              <span className="text-[11px] font-semibold text-[#1a1a1a]">{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Leads por Formulário */}
                      <div className="rounded-2xl bg-white border border-[#ebebeb] p-6 shadow-sm">
                        <p className="text-sm font-semibold text-[#1a1a1a] mb-4">Leads por Formulário</p>
                        {ebookCounts.length === 0 ? (
                          <p className="text-[#ccc] text-sm text-center py-8">Sem dados</p>
                        ) : (
                          <div className="space-y-3">
                            {ebookCounts.map(d => (
                              <div key={d.name}>
                                <div className="flex justify-between items-baseline mb-1">
                                  <span className="text-xs text-[#777] truncate max-w-[70%]">{d.name}</span>
                                  <span className="text-xs font-bold text-[#1a1a1a]">{d.value}</span>
                                </div>
                                <div className="h-7 rounded-full bg-[#f2f2f2] overflow-hidden">
                                  <div className="h-full rounded-full bg-[#374151] transition-all duration-700"
                                    style={{ width: `${Math.round((d.value / ebookMax) * 100)}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })()

            ) : (
              <div className="space-y-8">
                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  {filters.map((f) =>
                    f.key === "personalizado" ? (
                      <Popover key={f.key}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={() => setFilter("personalizado")}
                            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${filter === "personalizado"
                              ? "bg-foreground text-background"
                              : "bg-muted text-foreground hover:bg-muted/80"
                              }`}
                          >
                            {filter === "personalizado" && customRange?.from
                              ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${customRange.to ? format(customRange.to, "dd/MM", { locale: ptBR }) : "..."}`
                              : f.label}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={customRange}
                            onSelect={(range) => {
                              setCustomRange(range);
                              setFilter("personalizado");
                            }}
                            locale={ptBR}
                            numberOfMonths={1}
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${filter === f.key
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground hover:bg-muted/80"
                          }`}
                      >
                        {f.label}
                      </button>
                    )
                  )}
                </div>

                {/* Counter + Faturamento side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Counter Card */}
                  <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center justify-center space-y-1">
                    <p className="text-7xl font-bold text-foreground">{filteredCount}</p>
                    <p className="text-sm text-muted-foreground">
                      {filteredCount === 1 ? "agendamento" : "agendamentos"}
                    </p>
                  </div>

                  {/* Faturamento Chart */}
                  <div className="rounded-2xl border border-border bg-card p-6 flex flex-col space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Faturamento</h3>
                    <div className="flex-1 min-h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={faturamentoData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
                          <XAxis type="number" hide allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={180}
                            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 12,
                              fontSize: 13,
                            }}
                            formatter={(value: number) => [value, "Agendamentos"]}
                          />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={36} background={{ fill: "hsl(var(--muted) / 0.3)", radius: 6 }}>
                            {faturamentoData.map((_, i) => (
                              <Cell key={i} fill={faturamentoData[i].value === 0 ? "transparent" : barColors[i % barColors.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Curso Chart */}
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Curso</h3>
                    <div className="flex items-center justify-center gap-8">
                      <div className="relative w-[280px] h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={cursoData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={130}
                              paddingAngle={cursoData.some(d => d.value > 0) ? 4 : 0}
                              cornerRadius={6}
                              strokeWidth={0}
                            >
                              {cursoData.map((entry, i) => (
                                <Cell key={i} fill={entry.value === 0 ? "hsl(var(--muted) / 0.15)" : pieColors[i % pieColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 12,
                                fontSize: 13,
                                boxShadow: "0 8px 30px -8px hsl(var(--foreground) / 0.1)",
                              }}
                              formatter={(value: number) => [value, "Agendamentos"]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-3xl font-bold text-foreground">
                            {cursoData.reduce((sum, d) => sum + d.value, 0)}
                          </span>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">total</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3">
                        {cursoData.map((entry, i) => {
                          const total = cursoData.reduce((sum, d) => sum + d.value, 0);
                          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                          return (
                            <div key={entry.name} className="flex items-center gap-2.5">
                              <div
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: entry.value === 0 ? "hsl(var(--muted) / 0.15)" : pieColors[i % pieColors.length] }}
                              />
                              <span className="text-sm text-muted-foreground">{entry.name}</span>
                              <span className="text-sm font-semibold text-foreground">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Decisão do Parceiro Chart */}
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Decisão do Parceiro</h3>
                    <div className="flex items-center justify-center gap-8">
                      <div className="relative w-[280px] h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={decisaoData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={130}
                              paddingAngle={decisaoData.some(d => d.value > 0) ? 4 : 0}
                              cornerRadius={6}
                              strokeWidth={0}
                            >
                              {decisaoData.map((entry, i) => (
                                <Cell key={i} fill={entry.value === 0 ? "hsl(var(--muted) / 0.15)" : decisaoColors[i % decisaoColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 12,
                                fontSize: 13,
                                boxShadow: "0 8px 30px -8px hsl(var(--foreground) / 0.1)",
                              }}
                              formatter={(value: number) => [value, "Agendamentos"]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-3xl font-bold text-foreground">
                            {decisaoData.reduce((sum, d) => sum + d.value, 0)}
                          </span>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">total</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3">
                        {decisaoData.map((entry, i) => {
                          const total = decisaoData.reduce((sum, d) => sum + d.value, 0);
                          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                          return (
                            <div key={entry.name} className="flex items-center gap-2.5">
                              <div
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: entry.value === 0 ? "hsl(var(--muted) / 0.15)" : decisaoColors[i % decisaoColors.length] }}
                              />
                              <span className="text-sm text-muted-foreground">{entry.name}</span>
                              <span className="text-sm font-semibold text-foreground">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Horários mais agendados */}
                  <div className="rounded-2xl border border-border bg-card p-6 flex flex-col space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Horários mais agendados</h3>
                    <div className="h-[250px]">
                      {horarioData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={horarioData} margin={{ left: 0, right: 24, top: 8, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 13, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                            <YAxis hide allowDecimals={false} />
                            <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 13 }} formatter={(value: number) => [value, "Agendamentos"]} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={64}>
                              {horarioData.map((_, i) => (
                                <Cell key={i} fill={i === 0 ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground) / 0.5)"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum dado para o período selecionado</div>
                      )}
                    </div>
                  </div>

                  {/* Dias da semana mais agendados */}
                  <div className="rounded-2xl border border-border bg-card p-6 flex flex-col space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Dias da semana mais agendados</h3>
                    <div className="flex-1 flex items-center justify-center">
                      {diaSemanaData.some(d => d.value > 0) ? (
                        <div className="grid grid-cols-7 gap-2 w-full">
                          {diaSemanaData.map((entry) => {
                            const maxVal = Math.max(...diaSemanaData.map(d => d.value));
                            const intensity = maxVal > 0 ? entry.value / maxVal : 0;
                            return (
                              <div key={entry.name} className="flex flex-col items-center gap-2">
                                <div
                                  className="w-full aspect-square rounded-xl flex items-center justify-center transition-colors"
                                  style={{
                                    backgroundColor: entry.value === 0
                                      ? "hsl(var(--muted) / 0.15)"
                                      : `hsl(var(--foreground) / ${0.15 + intensity * 0.85})`,
                                  }}
                                >
                                  <span
                                    className="text-lg font-bold"
                                    style={{
                                      color: intensity > 0.5
                                        ? "hsl(var(--background))"
                                        : "hsl(var(--foreground))",
                                    }}
                                  >
                                    {entry.value}
                                  </span>
                                </div>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                  {entry.name.slice(0, 3)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Nenhum dado para o período selecionado</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Contatos Content */}
          {tab === "contatos" && (
            <div className="w-full">
              {isFormAllowed ? (
                /* Leads de formulário para bergehpatrick@gmail.com */
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  {formSubmissionsLoading && formSubmissions.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Nome</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Email</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">WhatsApp</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Faturamento</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground">Área da Beleza</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Formulário</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Origem</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Mídia</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Campanha</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Recebido em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formSubmissions.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="text-center py-12 text-muted-foreground">
                                Nenhum lead recebido ainda. Gere e publique seu formulário!
                              </td>
                            </tr>
                          ) : (
                            formSubmissions
                              .filter((s) => {
                                if (!searchTerm.trim()) return true;
                                const term = searchTerm.toLowerCase();
                                return s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || s.phone.toLowerCase().includes(term);
                              })
                              .slice((contactsPage - 1) * CONTACTS_PER_PAGE, contactsPage * CONTACTS_PER_PAGE)
                              .map((s) => (
                                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors animate-[fadeIn_0.3s_ease]">
                                  <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">{s.name}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{s.email || "—"}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{s.phone || "—"}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{s.faturamento || "—"}</td>
                                  <td className="px-4 py-3 text-muted-foreground max-w-xs" title={s.area_beleza || ""}>
                                    {s.area_beleza ? (s.area_beleza.length > 60 ? s.area_beleza.slice(0, 60) + "…" : s.area_beleza) : "—"}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                    {s.product ? (
                                      <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">{s.product}</span>
                                    ) : "—"}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {s.utm_source ? (
                                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">{s.utm_source}</span>
                                    ) : <span className="text-muted-foreground">-</span>}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {s.utm_medium ? (
                                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">{s.utm_medium}</span>
                                    ) : <span className="text-muted-foreground">-</span>}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {s.utm_campaign ? (
                                      <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-100">{s.utm_campaign}</span>
                                    ) : <span className="text-muted-foreground">-</span>}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                    {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* Paginação */}
                  {(() => {
                    const filtered = formSubmissions.filter((s) => {
                      if (!searchTerm.trim()) return true;
                      const term = searchTerm.toLowerCase();
                      return s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term) || s.phone.toLowerCase().includes(term);
                    });
                    const totalPages = Math.ceil(filtered.length / CONTACTS_PER_PAGE);
                    if (totalPages <= 1) return null;
                    return (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          {((contactsPage - 1) * CONTACTS_PER_PAGE) + 1}–{Math.min(contactsPage * CONTACTS_PER_PAGE, filtered.length)} de {filtered.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setContactsPage(p => Math.max(1, p - 1))}
                            disabled={contactsPage === 1}
                            className="px-2 py-1 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >‹</button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              onClick={() => setContactsPage(page)}
                              className={`w-7 h-7 text-xs rounded-lg font-medium transition-colors ${page === contactsPage
                                ? "bg-[#1a1a1a] text-white"
                                : "border border-border hover:bg-muted text-foreground"
                                }`}
                            >{page}</button>
                          ))}
                          <button
                            onClick={() => setContactsPage(p => Math.min(totalPages, p + 1))}
                            disabled={contactsPage === totalPages}
                            className="px-2 py-1 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >›</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              ) : (
                /* Agendamentos para outras contas */
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-center px-4 py-3 font-semibold text-foreground whitespace-nowrap">Ações</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Nome</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Email</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Telefone</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Instagram</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Data Agendada</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Horário</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Faturamento</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Aluna Biteti</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Curso</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Decisão Parceiro</th>
                          <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Criado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filtered = appointments.filter((a) => {
                            if (!searchTerm.trim()) return true;
                            const term = searchTerm.toLowerCase();
                            return a.name.toLowerCase().includes(term) || a.email.toLowerCase().includes(term) || a.phone.toLowerCase().includes(term);
                          });
                          return filtered.length === 0 ? (
                            <tr>
                              <td colSpan={12} className="text-center py-8 text-muted-foreground">
                                Nenhum contato encontrado
                              </td>
                            </tr>
                          ) : (
                            filtered.map((a) => (
                              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  {actionLoading === a.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                                  ) : (
                                    <button
                                      onClick={() => { setActionsAppointment(a); setActionsOpen(true); }}
                                      className="p-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted transition-colors"
                                    >
                                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-foreground font-medium">{a.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.email}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.phone}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.instagram || "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                  {format(new Date(a.appointment_date + "T12:00:00"), "dd/MM/yyyy")}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.appointment_time}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.faturamento || "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.aluna_biteti || "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.faz_curso || "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.decisao_parceiro || "—"}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                  {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </td>
                              </tr>
                            ))
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
          }

          {/* Criar Formulário Content */}
          {
            tab === "formulario" && (
              !isFormAllowed ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                    <FileCode className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">Acesso restrito</p>
                    <p className="text-sm text-muted-foreground mt-1">Esta funcionalidade não está disponível para sua conta.</p>
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex gap-6 items-start">
                    {/* LEFT: Config + Code */}
                    <div className="flex-1 min-w-0 space-y-4">
                      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                        <div className="flex items-center gap-3 pb-2 border-b border-border">
                          <FileCode className="w-5 h-5 text-foreground" />
                          <div>
                            <h2 className="text-base font-semibold text-foreground">Criar Formulário Embedável</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Gere um código HTML para colar no Elementor / WordPress</p>
                          </div>
                        </div>

                        {editingFormId && (
                          <div className="flex items-center justify-between px-3 py-2 bg-muted/60 rounded-lg border border-border text-xs">
                            <span className="text-muted-foreground font-medium">Editando formulário salvo</span>
                            <button
                              className="text-muted-foreground hover:text-foreground underline"
                              onClick={() => { setEditingFormId(null); setFormGenName(""); setFormGenProduct(""); setFormGenCode(""); }}
                            >Cancelar</button>
                          </div>
                        )}

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                              Identificação do formulário
                              <span className="ml-2 text-xs font-normal text-muted-foreground">(uso interno, não aparece no formulário)</span>
                            </label>
                            <Input
                              value={formGenName}
                              onChange={(e) => setFormGenName(e.target.value)}
                              placeholder="Ex: Formulário Site Principal"
                              className="h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Produto / Curso</label>
                            <Input
                              value={formGenProduct}
                              onChange={(e) => setFormGenProduct(e.target.value)}
                              placeholder="Ex: Nutrição Online, Mentoria..."
                              className="h-11"
                            />
                          </div>

                          {/* Color pickers */}
                          <div className="flex gap-3">
                            <div className="flex-1 space-y-2">
                              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5" />
                                Cor do fundo
                              </label>
                              <div className="flex items-center gap-2 h-11 border border-border rounded-xl px-3 bg-background">
                                <input
                                  type="color"
                                  value={formBgColor}
                                  onChange={(e) => setFormBgColor(e.target.value)}
                                  className="w-7 h-7 rounded-lg border-none cursor-pointer bg-transparent"
                                />
                                <span className="text-sm font-mono text-muted-foreground">{formBgColor}</span>
                              </div>
                            </div>
                            <div className="flex-1 space-y-2">
                              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5" />
                                Cor do texto
                              </label>
                              <div className="flex items-center gap-2 h-11 border border-border rounded-xl px-3 bg-background">
                                <input
                                  type="color"
                                  value={formTextColor}
                                  onChange={(e) => setFormTextColor(e.target.value)}
                                  className="w-7 h-7 rounded-lg border-none cursor-pointer bg-transparent"
                                />
                                <span className="text-sm font-mono text-muted-foreground">{formTextColor}</span>
                              </div>
                            </div>
                          </div>

                          <Button
                            onClick={handleGenerateForm}
                            disabled={isFormAllowed ? !formGenName.trim() : (!formGenName.trim() || !formGenProduct.trim())}
                            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
                          >
                            <FileCode className="w-4 h-4 mr-2" />
                            {editingFormId ? "Atualizar Código" : "Gerar Código HTML"}
                          </Button>
                        </div>

                        {formGenCode && (
                          <div className="space-y-3 pt-2 border-t border-border">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">Código gerado</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleSaveForm}
                                  disabled={formSaving}
                                  className="h-8 gap-2 text-xs"
                                >
                                  {formSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  {editingFormId ? "Atualizar" : "Salvar"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={copyFormCode}
                                  className="h-8 gap-2 text-xs"
                                >
                                  {formGenCopied ? (
                                    <><Check className="w-3.5 h-3.5 text-green-500" />Copiado!</>
                                  ) : (
                                    <><Copy className="w-3.5 h-3.5" />Copiar código</>
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="relative">
                              <textarea
                                readOnly
                                value={formGenCode}
                                className="w-full h-40 text-xs font-mono bg-muted border border-border rounded-xl p-3 resize-none text-muted-foreground focus:outline-none"
                              />
                            </div>
                            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-2">
                              <p className="text-xs font-semibold text-foreground">Como usar no Elementor / WordPress:</p>
                              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                                <li>Copie o código acima</li>
                                <li>No Elementor, adicione o widget <strong>HTML</strong></li>
                                <li>Cole o código dentro do widget</li>
                                <li>Salve e publique a página</li>
                              </ol>
                            </div>
                          </div>
                        )}

                        {/* Lista de formulários salvos */}
                        {(savedForms.length > 0 || savedFormsLoading) && (
                          <div className="pt-4 border-t border-border space-y-3">
                            <h3 className="text-sm font-semibold text-foreground">Formulários salvos</h3>
                            {savedFormsLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {savedForms.map((form) => (
                                  <div key={form.id} className={`rounded-xl border bg-muted/20 overflow-hidden transition-colors ${editingFormId === form.id ? "border-foreground/30 bg-muted/40" : "border-border"}`}>
                                    <div className="flex items-center justify-between p-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{form.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{form.product || ""}</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{format(new Date(form.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                                      </div>
                                      <div className="flex gap-2 ml-3 shrink-0">
                                        {editingFormId === form.id ? (
                                          <span className="text-[10px] text-muted-foreground px-2">editando...</span>
                                        ) : (
                                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleOpenEdit(form)}>Editar</Button>
                                        )}
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/30" onClick={() => setDeleteFormId(form.id)}>Deletar</Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: Live Preview */}
                    <div className="w-[420px] flex-shrink-0 sticky top-6">
                      <div className="rounded-2xl border border-border bg-card overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                          <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-400" />
                            <div className="w-3 h-3 rounded-full bg-yellow-400" />
                            <div className="w-3 h-3 rounded-full bg-green-400" />
                          </div>
                          <span className="text-xs text-muted-foreground font-medium ml-1">Preview do Formulário</span>
                        </div>
                        {formGenCode ? (
                          <iframe
                            srcDoc={formGenCode}
                            className="w-full"
                            style={{ height: "620px", border: "none" }}
                            title="Preview do formulário"
                            sandbox="allow-scripts allow-same-origin"
                          />
                        ) : (
                          <div
                            className="flex flex-col items-center justify-center gap-3 text-center"
                            style={{ height: "620px" }}
                          >
                            <div
                              className="w-14 h-14 rounded-2xl flex items-center justify-center"
                              style={{ background: formBgColor }}
                            >
                              <FileCode className="w-7 h-7" style={{ color: formTextColor }} />
                            </div>
                            <p className="text-sm text-muted-foreground">Preencha os campos e clique em<br /><strong className="text-foreground">Gerar Código HTML</strong></p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )
          }

          {/* Configurações Content */}
          {
            tab === "configuracoes" && (
              <div className="max-w-lg space-y-4">
                <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-border">
                    <Settings className="w-5 h-5 text-foreground" />
                    <div>
                      <h2 className="text-base font-semibold text-foreground">Conta</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Informações da sua conta</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">E-mail</p>
                        <p className="text-sm text-muted-foreground">{userEmail ?? "—"}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <Button
                        variant="outline"
                        className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-2"
                        onClick={async () => {
                          await supabase.auth.signOut({ scope: "global" });
                          window.location.replace("/acesso");
                        }}
                      >
                        <LogOut className="w-4 h-4" />
                        Sair da conta
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          }

        </div >
      </div >

      {/* Delete Form Confirmation Dialog */}
      < AlertDialog open={!!deleteFormId} onOpenChange={(open) => { if (!open) setDeleteFormId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar formulário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este formulário? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFormId && handleDeleteForm(deleteFormId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog >

      {/* Cancel Confirmation Dialog */}
      < AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen} >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o agendamento de <span className="font-semibold">{cancelAppointment?.name}</span>? Essa ação não pode ser desfeita e o evento será removido do Google Calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog >

      {/* Actions Dialog */}
      < Dialog open={actionsOpen} onOpenChange={setActionsOpen} >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{actionsAppointment?.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {actionsAppointment && format(new Date(actionsAppointment.appointment_date + "T12:00:00"), "dd/MM/yyyy")} às {actionsAppointment?.appointment_time}
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="outline"
              className="w-full h-14 justify-start gap-3 text-base"
              onClick={() => {
                setActionsOpen(false);
                if (actionsAppointment) openReschedule(actionsAppointment);
              }}
            >
              <CalendarIcon className="w-5 h-5" />
              Reagendar
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 justify-start gap-3 text-base text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => {
                setActionsOpen(false);
                if (actionsAppointment) handleCancelAppointment(actionsAppointment);
              }}
            >
              <X className="w-5 h-5" />
              Cancelar agendamento
            </Button>
          </div>
        </DialogContent>
      </Dialog >

      {/* Reschedule Dialog */}
      < Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reagendar — {rescheduleAppointment?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-6 py-2">
            <div className="flex-shrink-0">
              <label className="text-sm font-medium text-foreground mb-2 block">Nova data</label>
              <Calendar
                mode="single"
                selected={rescheduleDate}
                onSelect={handleRescheduleDateSelect}
                disabled={(date) => date < new Date()}
                className="rounded-xl border border-border pointer-events-auto"
                locale={ptBR}
              />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Novo horário</label>
                <input
                  type="text"
                  placeholder="00:00"
                  value={rescheduleTime}
                  maxLength={5}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "");
                    if (v.length >= 3) v = v.slice(0, 2) + ":" + v.slice(2, 4);
                    setRescheduleTime(v);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                {rescheduleTime.match(/^\d{2}:\d{2}$/) && rescheduleDate && !slotsLoading && (() => {
                  const hour = parseInt(rescheduleTime.split(":")[0]);
                  const isBooked = bookedTimes.includes(rescheduleTime) && rescheduleAppointment?.appointment_time !== rescheduleTime;
                  const isBlocked = blockedRanges.some((b) => {
                    const s = parseInt(b.start_time.split(":")[0]);
                    const e = parseInt(b.end_time.split(":")[0]);
                    return hour >= s && hour < e;
                  });
                  if (isBooked) return <p className="text-xs text-destructive mt-1 font-medium">⛔ Não disponível — esse horário já está preenchido</p>;
                  if (isBlocked) return <p className="text-xs text-destructive mt-1 font-medium">⛔ Não disponível — esse horário está bloqueado</p>;
                  return <p className="text-xs text-green-600 mt-1 font-medium">✓ Disponível</p>;
                })()}
              </div>
              {rescheduleDate && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Horários disponíveis</label>
                  {slotsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                      <Loader2 className="w-4 h-4 animate-spin" /> Consultando agenda...
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setRescheduleTime(slot)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${rescheduleTime === slot
                            ? "bg-foreground text-background border-foreground"
                            : "border-border bg-muted/30 text-foreground hover:bg-muted"
                            }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">Nenhum horário disponível nesta data</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancelar</Button>
            <Button onClick={handleReschedule} disabled={!rescheduleDate || !rescheduleTime.match(/^\d{2}:\d{2}$/) || (bookedTimes.includes(rescheduleTime) && rescheduleAppointment?.appointment_time !== rescheduleTime) || blockedRanges.some((b) => { const h = parseInt(rescheduleTime.split(":")[0]); return h >= parseInt(b.start_time.split(":")[0]) && h < parseInt(b.end_time.split(":")[0]); }) || actionLoading !== null} className="bg-foreground text-background hover:bg-foreground/90">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </div >
  );
};

export default Dashboard;
