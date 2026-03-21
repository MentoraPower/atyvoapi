import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { Document, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, Packer, HeadingLevel } from "docx";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, FileCode, Copy, Check, Palette, LogOut, Settings, SlidersHorizontal, ChevronDown, Download, Bookmark, X, Folder, MoreHorizontal, Trash2, Zap, ChevronRight, Code2, Eye, EyeOff } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, PieChart, Pie, AreaChart, Area } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { generateLeadFormHTML } from "@/lib/generateFormHTML";
import { FormFieldsBuilder } from "@/components/FormFieldsBuilder";
import { FieldsConfig, defaultConfig } from "@/lib/formBuilderTypes";

type TabType = "dashboard" | "contatos" | "configuracoes" | "formulario";

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
  guru_purchased?: boolean | null;
  guru_checked_at?: string | null;
}

interface GuruIntegration {
  id: string;
  name: string;
  api_token: string;
  product_id: string;
  form_id: string | null;
  active: boolean;
  created_at: string;
}

const Dashboard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<TabType>(() => {
    const urlTab = new URLSearchParams(window.location.search).get("tab") as TabType;
    if (["dashboard","contatos","configuracoes","formulario"].includes(urlTab)) return urlTab;
    return (localStorage.getItem("dash_tab") as TabType) || "dashboard";
  });
  const [formGenName, setFormGenName] = useState("");
  const [formGenProduct, setFormGenProduct] = useState("");
  const [formGenCode, setFormGenCode] = useState("");
  const [formGenCopied, setFormGenCopied] = useState(false);
  const [formBgColor, setFormBgColor] = useState("#fafafa");
  const [formTextColor, setFormTextColor] = useState("#111111");
  const [formSaving, setFormSaving] = useState(false);
  const [savedForms, setSavedForms] = useState<{ id: string; name: string; product: string; bg_color: string; text_color: string; html_code: string; no_save: boolean; webhook_url: string; hide_faturamento: boolean; hide_area: boolean; no_redirect: boolean; redirect_url: string; no_email: boolean; fields_config: FieldsConfig | null; created_at: string }[]>([]);
  const [pixelModalFormId, setPixelModalFormId] = useState<string | null>(null);
  const [pixelEditPixelId, setPixelEditPixelId] = useState("");
  const [pixelEditCapiToken, setPixelEditCapiToken] = useState("");
  const [pixelCapiVisible, setPixelCapiVisible] = useState(false);
  const [pixelSaving, setPixelSaving] = useState(false);
  const [savedFormsLoading, setSavedFormsLoading] = useState(false);
  const [deleteFormId, setDeleteFormId] = useState<string | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [contactMenuOpen, setContactMenuOpen] = useState<string | null>(null);
  const [contactMenuPos, setContactMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formNoSave, setFormNoSave] = useState(false);
  const [formWebhook, setFormWebhook] = useState(false);
  const [formWebhookUrl, setFormWebhookUrl] = useState("");
  const [formHideFaturamento, setFormHideFaturamento] = useState(false);
  const [formHideArea, setFormHideArea] = useState(false);
  const [formRedirectMode, setFormRedirectMode] = useState<"default" | "none" | "custom">("default");
  const [formRedirectUrl, setFormRedirectUrl] = useState("");
  const [formNoEmail, setFormNoEmail] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [formFieldsConfig, setFormFieldsConfig] = useState<FieldsConfig | null>(null);
  // Guru integrations
  const [guruIntegrations, setGuruIntegrations] = useState<GuruIntegration[]>([]);
  const [guruModalOpen, setGuruModalOpen] = useState(false);
  const [guruEditId, setGuruEditId] = useState<string | null>(null);
  const [guruEditName, setGuruEditName] = useState("Guru");
  const [guruEditToken, setGuruEditToken] = useState("");
  const [guruEditTokenVisible, setGuruEditTokenVisible] = useState(false);
  const [guruEditProductId, setGuruEditProductId] = useState("");
  const [guruEditFormId, setGuruEditFormId] = useState<string>("");
  const [guruSaving, setGuruSaving] = useState(false);
  const [guruChecking, setGuruChecking] = useState<Set<string>>(new Set());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
  const [formSubmissionsLoading, setFormSubmissionsLoading] = useState(false);
  const [ebookFilter, setEbookFilter] = useState<string>("todos");
  const [contactsPage, setContactsPage] = useState(1);
  const CONTACTS_PER_PAGE = 50;
  const [dateFilter, setDateFilter] = useState<"todos" | "hoje" | "ontem" | "7dias" | "30dias" | "custom">("todos");
  const [filterOpen, setFilterOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const filterRef = useRef<HTMLDivElement>(null);
  const [contactsDateFilter, setContactsDateFilter] = useState<"todos" | "hoje" | "ontem" | "7dias" | "30dias" | "custom">("todos");
  const [contactsFilterOpen, setContactsFilterOpen] = useState(false);
  const [contactsCustomRange, setContactsCustomRange] = useState<DateRange | undefined>(undefined);
  const contactsFilterRef = useRef<HTMLDivElement>(null);
  const [utmFilter, setUtmFilter] = useState<{ field: "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term"; value: string } | null>(null);
  const [utmFilterOpen, setUtmFilterOpen] = useState(false);
  const utmFilterRef = useRef<HTMLDivElement>(null);
  const [utmSearchField, setUtmSearchField] = useState<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term">("utm_source");
  const [utmSearchValue, setUtmSearchValue] = useState("");
  const [formFilter, setFormFilter] = useState<string | null>(null);
  const [formFilterOpen, setFormFilterOpen] = useState(false);
  const formFilterRef = useRef<HTMLDivElement>(null);
  const [selectedFormFolder, setSelectedFormFolder] = useState<string | null>(() => {
    const f = new URLSearchParams(window.location.search).get("folder");
    if (!f || f === "all") return null;
    if (f === "none") return "__none__";
    return f;
  });
  const [inFolderView, setInFolderView] = useState(() =>
    new URLSearchParams(window.location.search).has("folder")
  );
  const [folderSearch, setFolderSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [savedContactFilters, setSavedContactFilters] = useState<Array<{ id: string; name: string; utmFilter: { field: "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term"; value: string } | null; formFilter: string | null }>>(() => {
    try { return JSON.parse(localStorage.getItem("saved_contact_filters") || "[]"); } catch { return []; }
  });
  const [saveFilterInputOpen, setSaveFilterInputOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");
  const isMobile = useIsMobile();
  const [settingsSection, setSettingsSection] = useState<"conta" | "integracoes">("conta");

  useEffect(() => {
    localStorage.setItem("dash_tab", tab);
    if (tab !== "contatos") {
      setInFolderView(false);
      setSelectedFormFolder(null);
      setContactsPage(1);
    }
  }, [tab]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "dashboard") params.set("tab", tab);
    if (tab === "contatos" && inFolderView) {
      params.set("folder", selectedFormFolder === null ? "all" : selectedFormFolder === "__none__" ? "none" : selectedFormFolder);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [tab, inFolderView, selectedFormFolder]);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  useEffect(() => {
    if (!contactsFilterOpen) return;
    const handler = (e: MouseEvent) => {
      if (contactsFilterRef.current && !contactsFilterRef.current.contains(e.target as Node)) setContactsFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contactsFilterOpen]);

  useEffect(() => {
    if (!utmFilterOpen) return;
    const handler = (e: MouseEvent) => {
      if (utmFilterRef.current && !utmFilterRef.current.contains(e.target as Node)) setUtmFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [utmFilterOpen]);

  useEffect(() => {
    if (!formFilterOpen) return;
    const handler = (e: MouseEvent) => {
      if (formFilterRef.current && !formFilterRef.current.contains(e.target as Node)) setFormFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [formFilterOpen]);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

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
    const fetchSavedForms = async () => {
      setSavedFormsLoading(true);
      const { data } = await supabase
        .from("saved_forms")
        .select("id, name, product, bg_color, text_color, html_code, no_save, webhook_url, hide_faturamento, hide_area, no_redirect, redirect_url, no_email, fields_config, created_at")
        .order("created_at", { ascending: false });
      setSavedForms((data || []) as typeof savedForms);
      setSavedFormsLoading(false);
    };
    fetchSavedForms();
  }, []);

  useEffect(() => {
    const fetchSubmissions = async () => {
      setFormSubmissionsLoading(true);
      const allData: FormSubmission[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("form_submissions")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        allData.push(...(data as unknown as FormSubmission[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setFormSubmissions(allData);
      setFormSubmissionsLoading(false);
    };
    fetchSubmissions();

    const channel = supabase
      .channel("form-submissions-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "form_submissions" }, (payload) => {
        setFormSubmissions((prev) => [payload.new as unknown as FormSubmission, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "form_submissions" }, (payload) => {
        setFormSubmissions((prev) =>
          prev.map((s) => s.id === (payload.new as FormSubmission).id ? (payload.new as unknown as FormSubmission) : s)
        );
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "form_submissions" }, (payload) => {
        setFormSubmissions((prev) => prev.filter((s) => s.id !== (payload.old as FormSubmission).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Carrega integrações Guru
  useEffect(() => {
    if (!userId) return;
    supabase.from("guru_integrations").select("*").eq("user_id", userId).order("created_at").then(({ data }) => {
      if (data) setGuruIntegrations(data as GuruIntegration[]);
    });
  }, [userId]);

  // Verifica leads não checados contra Guru API
  useEffect(() => {
    if (guruIntegrations.length === 0 || formSubmissions.length === 0) return;
    const activeIntegrations = guruIntegrations.filter(g => g.active);
    if (activeIntegrations.length === 0) return;
    const unchecked = formSubmissions.filter(s =>
      s.guru_purchased == null &&
      s.guru_checked_at == null &&
      activeIntegrations.some(g => g.form_id === null || g.form_id === s.form_id)
    );
    if (unchecked.length === 0) return;
    const verify = async () => {
      for (const s of unchecked) {
        const integration = activeIntegrations.find(g => g.form_id === null || g.form_id === s.form_id);
        if (!integration) continue;
        setGuruChecking(prev => new Set(prev).add(s.id));
        try {
          // Guru Manager API — verifica se o contato comprou o produto
          const res = await fetch(
            `https://api.guru.manager/v1/purchases?contact_email=${encodeURIComponent(s.email)}&product_id=${encodeURIComponent(integration.product_id)}&limit=1`,
            { headers: { "Authorization": `Bearer ${integration.api_token}`, "Content-Type": "application/json" } }
          );
          let purchased = false;
          if (res.ok) {
            const json = await res.json();
            const items: any[] = Array.isArray(json) ? json : (json.data ?? json.items ?? []);
            purchased = items.some((p: any) => ["approved", "paid", "active", "completed"].includes(p.status ?? p.payment_status ?? ""));
          }
          await supabase.from("form_submissions").update({ guru_purchased: purchased, guru_checked_at: new Date().toISOString() }).eq("id", s.id);
          setFormSubmissions(prev => prev.map(x => x.id === s.id ? { ...x, guru_purchased: purchased, guru_checked_at: new Date().toISOString() } : x));
        } catch (_) {
          // silencia erros de rede / CORS — tenta novamente na próxima sessão
        } finally {
          setGuruChecking(prev => { const n = new Set(prev); n.delete(s.id); return n; });
        }
      }
    };
    verify();
  }, [guruIntegrations, formSubmissions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateForm = () => {
    try {
      if (!formGenName.trim()) return;
      const uid = userId ?? "";
      const tempId = ([1e7] as unknown as string + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: string) =>
        (parseInt(c) ^ (Math.random() * 16 >> parseInt(c) / 4)).toString(16)
      );
      const productLabel = formGenProduct.trim() || "Qualificação de Leads";
      const redirectUrl = formRedirectMode === "none" ? "none" : formRedirectMode === "custom" ? formRedirectUrl : "";
      const html = generateLeadFormHTML(formGenName, productLabel, formBgColor, formTextColor, uid, tempId, formNoSave, formWebhook ? formWebhookUrl : "", formHideFaturamento, formHideArea, redirectUrl, formNoEmail, "", "", formFieldsConfig);
      setFormGenCode(html);
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

      const redirectUrl = formRedirectMode === "none" ? "none" : formRedirectMode === "custom" ? formRedirectUrl : "";
      if (editingFormId) {
        const finalHTML = generateLeadFormHTML(formGenName, formGenProduct, formBgColor, formTextColor, user.id, editingFormId, formNoSave, formWebhook ? formWebhookUrl : "", formHideFaturamento, formHideArea, redirectUrl, formNoEmail, "", "", formFieldsConfig);
        const { error } = await supabase.from("saved_forms").update({
          name: formGenName.trim(),
          product: formGenProduct.trim(),
          bg_color: formBgColor,
          text_color: formTextColor,
          html_code: finalHTML,
          no_save: formNoSave,
          webhook_url: formWebhook ? formWebhookUrl : "",
          hide_faturamento: formHideFaturamento,
          hide_area: formHideArea,
          no_redirect: formRedirectMode === "none",
          redirect_url: redirectUrl,
          no_email: formNoEmail,
          fields_config: formFieldsConfig,
        }).eq("id", editingFormId);
        if (error) throw error;
        setFormGenCode(finalHTML);
        setSavedForms(prev => prev.map(f => f.id === editingFormId ? { ...f, name: formGenName.trim(), product: formGenProduct.trim(), bg_color: formBgColor, text_color: formTextColor, html_code: finalHTML, no_save: formNoSave, webhook_url: formWebhook ? formWebhookUrl : "", hide_faturamento: formHideFaturamento, hide_area: formHideArea, no_redirect: formRedirectMode === "none", redirect_url: redirectUrl, no_email: formNoEmail, fields_config: formFieldsConfig } : f));
        toast.success("Formulário atualizado!");
      } else {
        const { data: inserted, error } = await supabase.from("saved_forms").insert({
          user_id: user.id,
          name: formGenName.trim(),
          product: formGenProduct.trim(),
          bg_color: formBgColor,
          text_color: formTextColor,
          html_code: "temp",
          no_save: formNoSave,
          webhook_url: formWebhook ? formWebhookUrl : "",
          hide_faturamento: formHideFaturamento,
          hide_area: formHideArea,
          no_redirect: formRedirectMode === "none",
          redirect_url: redirectUrl,
          no_email: formNoEmail,
          fields_config: formFieldsConfig,
        }).select("id").single();
        if (error) throw error;
        const realId = inserted?.id ?? "";
        const finalHTML = generateLeadFormHTML(formGenName, formGenProduct, formBgColor, formTextColor, user.id, realId, formNoSave, formWebhook ? formWebhookUrl : "", formHideFaturamento, formHideArea, redirectUrl, formNoEmail, "", "", formFieldsConfig);
        await supabase.from("saved_forms").update({ html_code: finalHTML }).eq("id", realId);
        setFormGenCode(finalHTML);
        toast.success("Formulário salvo!");
        const { data } = await supabase
          .from("saved_forms")
          .select("id, name, product, bg_color, text_color, html_code, no_save, webhook_url, hide_faturamento, hide_area, no_redirect, redirect_url, no_email, fields_config, created_at")
          .order("created_at", { ascending: false });
        setSavedForms((data || []) as typeof savedForms);
      }
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setFormSaving(false);
    }
  };


  const handleDeleteContact = async (id: string) => {
    setDeleteContactId(null);
    const { error } = await supabase.from("form_submissions").delete().eq("id", id);
    if (error) { toast.error("Erro ao apagar contato"); return; }
    setFormSubmissions(prev => prev.filter(s => s.id !== id));
    toast.success("Contato apagado");
  };

  const handleOpenPixel = async (form: typeof savedForms[0]) => {
    setPixelEditPixelId("");
    setPixelEditCapiToken("");
    setPixelCapiVisible(false);
    setPixelModalFormId(form.id);
    const { data } = await supabase
      .from("saved_forms")
      .select("meta_pixel_id, meta_capi_token")
      .eq("id", form.id)
      .maybeSingle();
    if (data) {
      setPixelEditPixelId((data as any).meta_pixel_id ?? "");
      setPixelEditCapiToken((data as any).meta_capi_token ?? "");
    }
  };

  const handleSavePixel = async () => {
    if (!pixelModalFormId) return;
    setPixelSaving(true);
    const { error } = await supabase
      .from("saved_forms")
      .update({ meta_pixel_id: pixelEditPixelId.trim() || null, meta_capi_token: pixelEditCapiToken.trim() || null })
      .eq("id", pixelModalFormId);
    setPixelSaving(false);
    if (error) { toast.error("Erro ao salvar pixel"); return; }
    toast.success("Pixel salvo");
    setPixelModalFormId(null);
  };

  const handleOpenGuruNew = () => {
    setGuruEditId(null); setGuruEditName("Guru"); setGuruEditToken(""); setGuruEditProductId(""); setGuruEditFormId(""); setGuruEditTokenVisible(false);
    setGuruModalOpen(true);
  };

  const handleOpenGuruEdit = (g: GuruIntegration) => {
    setGuruEditId(g.id); setGuruEditName(g.name); setGuruEditToken(g.api_token); setGuruEditProductId(g.product_id); setGuruEditFormId(g.form_id ?? ""); setGuruEditTokenVisible(false);
    setGuruModalOpen(true);
  };

  const handleSaveGuru = async () => {
    if (!userId || !guruEditToken.trim() || !guruEditProductId.trim()) { toast.error("Preencha o token e o ID do produto"); return; }
    setGuruSaving(true);
    const payload = { user_id: userId, name: guruEditName.trim() || "Guru", api_token: guruEditToken.trim(), product_id: guruEditProductId.trim(), form_id: guruEditFormId || null };
    if (guruEditId) {
      const { error } = await supabase.from("guru_integrations").update(payload).eq("id", guruEditId);
      if (!error) setGuruIntegrations(prev => prev.map(g => g.id === guruEditId ? { ...g, ...payload } : g));
      else toast.error("Erro ao salvar");
    } else {
      const { data, error } = await supabase.from("guru_integrations").insert(payload).select().single();
      if (!error && data) setGuruIntegrations(prev => [...prev, data as GuruIntegration]);
      else toast.error("Erro ao salvar");
    }
    setGuruSaving(false);
    setGuruModalOpen(false);
    toast.success("Integração salva");
  };

  const handleDeleteGuru = async (id: string) => {
    await supabase.from("guru_integrations").delete().eq("id", id);
    setGuruIntegrations(prev => prev.filter(g => g.id !== id));
    toast.success("Integração removida");
  };

  const handleToggleGuru = async (g: GuruIntegration) => {
    const active = !g.active;
    await supabase.from("guru_integrations").update({ active }).eq("id", g.id);
    setGuruIntegrations(prev => prev.map(x => x.id === g.id ? { ...x, active } : x));
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
    setFormGenCode("");
    setEditingFormId(form.id);
    setFormNoSave(form.no_save ?? false);
    setFormWebhook(!!(form.webhook_url));
    setFormWebhookUrl(form.webhook_url ?? "");
    setFormHideFaturamento(form.hide_faturamento ?? false);
    setFormHideArea(form.hide_area ?? false);
    const ru = form.redirect_url ?? "";
    if (ru === "none" || (form.no_redirect && !ru)) {
      setFormRedirectMode("none");
      setFormRedirectUrl("");
    } else if (ru && ru !== "none") {
      setFormRedirectMode("custom");
      setFormRedirectUrl(ru);
    } else {
      setFormRedirectMode("default");
      setFormRedirectUrl("");
    }
    setFormNoEmail(form.no_email ?? false);
    setAdvancedOpen(!!(form.no_save || form.webhook_url || form.hide_faturamento || form.hide_area || form.no_redirect || form.redirect_url || form.no_email));
    setFormFieldsConfig(form.fields_config ?? null);
    setFormModalOpen(true);
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

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const applyDateFilter = (subs: FormSubmission[]) => {
      if (dateFilter === "hoje") {
        const end = new Date(todayStart); end.setDate(end.getDate() + 1);
        return subs.filter(s => { const d = new Date(s.created_at); return d >= todayStart && d < end; });
      }
      if (dateFilter === "ontem") {
        const start = new Date(todayStart); start.setDate(start.getDate() - 1);
        return subs.filter(s => { const d = new Date(s.created_at); return d >= start && d < todayStart; });
      }
      if (dateFilter === "7dias") {
        const start = new Date(todayStart); start.setDate(start.getDate() - 6);
        return subs.filter(s => new Date(s.created_at) >= start);
      }
      if (dateFilter === "30dias") {
        const start = new Date(todayStart); start.setDate(start.getDate() - 29);
        return subs.filter(s => new Date(s.created_at) >= start);
      }
      if (dateFilter === "custom" && customRange?.from) {
        const start = customRange.from;
        const end = customRange.to
          ? new Date(customRange.to.getTime() + 86400000)
          : new Date(customRange.from.getTime() + 86400000);
        return subs.filter(s => { const d = new Date(s.created_at); return d >= start && d < end; });
      }
      return subs;
    };

    const filtered = applyDateFilter(fs);

    const totalLeads = filtered.length;
    const sqlLeads = filtered.filter(s => s.faturamento === "De R$ 5.000 a R$ 10.000").length;
    const sqlRate = totalLeads > 0 ? Math.round((sqlLeads / totalLeads) * 100) : 0;

    let trendData: { name: string; value: number }[];
    let trendInterval: number;

    if (dateFilter === "hoje" || dateFilter === "ontem") {
      const targetDay = dateFilter === "hoje"
        ? todayStart
        : new Date(todayStart.getTime() - 86400000);
      trendData = Array.from({ length: 24 }, (_, h) => ({
        name: `${String(h).padStart(2, "0")}h`,
        value: filtered.filter(s => {
          const sd = new Date(s.created_at);
          return sd.getFullYear() === targetDay.getFullYear()
            && sd.getMonth() === targetDay.getMonth()
            && sd.getDate() === targetDay.getDate()
            && sd.getHours() === h;
        }).length,
      }));
      trendInterval = 3; // exibe 00h, 04h, 08h, 12h, 16h, 20h
    } else {
      const days =
        dateFilter === "7dias" ? 7
        : dateFilter === "30dias" ? 30
        : dateFilter === "custom" && customRange?.from && customRange?.to
          ? Math.min(Math.round((customRange.to.getTime() - customRange.from.getTime()) / 86400000) + 1, 60)
          : 14;

      const startDay = dateFilter === "custom" && customRange?.from
        ? customRange.from
        : (() => { const d = new Date(todayStart); d.setDate(d.getDate() - (days - 1)); return d; })();

      trendData = Array.from({ length: days }, (_, i) => {
        const d = new Date(startDay.getTime() + i * 86400000);
        return {
          name: format(d, "dd/MM"),
          value: filtered.filter(s => {
            const sd = new Date(s.created_at);
            return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth() && sd.getDate() === d.getDate();
          }).length,
        };
      });

      trendInterval = days <= 7 ? 0 : days <= 14 ? 1 : 2;
    }

    const fatColors = ["#e5e7eb", "#9ca3af", "#6b7280", "#1a1a1a"];
    const fatKeys = ["Até R$ 3.000", "De R$ 3.000 a R$ 5.000", "De R$ 5.000 a R$ 10.000", "Acima de R$ 10.000"];
    const fatMap: Record<string, number> = {};
    filtered.forEach(s => { if (s.faturamento) fatMap[s.faturamento] = (fatMap[s.faturamento] || 0) + 1; });
    const fatDonut = fatKeys.map((k, i) => ({ name: k, value: fatMap[k] || 0, color: fatColors[i] }));
    const fatTotal = fatDonut.reduce((a, b) => a + b.value, 0) || 1;

    const areaOrder = ["Cílios", "Sobrancelhas", "Maquiagem", "Estética", "Cabelos", "Unhas", "HOF (harmonização)", "Outro"];
    const areaMap: Record<string, number> = {};
    filtered.forEach(s => { if (s.area_beleza) areaMap[s.area_beleza] = (areaMap[s.area_beleza] || 0) + 1; });
    const areaData = areaOrder
      .map(k => ({ name: k, value: areaMap[k] || 0 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const areaMax = areaData[0]?.value || 1;

    const areaColors = ["#1a1a1a", "#374151", "#6b7280", "#9ca3af", "#d1d5db"];
    const areaDonut = areaData.slice(0, 5).map((d, i) => ({ ...d, color: areaColors[i] }));

    const ebookOptions = ["todos", ...Array.from(new Set(formSubmissions.map(s => s.product).filter(Boolean) as string[]))];
    const ebookCounts = ebookOptions.filter(e => e !== "todos")
      .map(eb => ({ name: eb, value: filtered.filter(s => s.product === eb).length }))
      .sort((a, b) => b.value - a.value);
    const ebookMax = ebookCounts[0]?.value || 1;

    return { totalLeads, sqlLeads, sqlRate, trendData, trendInterval, fatDonut, fatTotal, areaData, areaMax, areaDonut, ebookOptions, ebookCounts, ebookMax };
  }, [formSubmissions, ebookFilter, dateFilter, customRange]);

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    const trimmed = phone.trim();
    if (trimmed.startsWith("+")) return trimmed;
    return "+55" + trimmed.replace(/^\+?55/, "");
  };

  const getFilteredContacts = useCallback(() =>
    formSubmissions.filter(s => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        if (!s.name.toLowerCase().includes(term) && !s.email.toLowerCase().includes(term) && !s.phone.toLowerCase().includes(term)) return false;
      }
      if (utmFilter && s[utmFilter.field] !== utmFilter.value) return false;
      if (formFilter && s.product !== formFilter) return false;
      if (selectedFormFolder === "__none__") { if (s.form_id !== null) return false; }
      else if (selectedFormFolder !== null) { if (s.form_id !== selectedFormFolder) return false; }
      return true;
    }),
  [formSubmissions, searchTerm, utmFilter, formFilter, selectedFormFolder]);

  const exportCSV = useCallback(() => {
    const data = getFilteredContacts();
    const headers = ["Nome", "Email", "WhatsApp", "Faturamento", "Área da Beleza", "Formulário", "Origem", "Mídia", "Campanha", "Recebido em"];
    const rows = data.map(s => [
      s.name, s.email, formatPhone(s.phone), s.faturamento || "", s.area_beleza || "",
      s.product || "", s.utm_source || "", s.utm_medium || "", s.utm_campaign || "",
      format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "contatos.csv"; a.click();
  }, [getFilteredContacts]);

  const exportExcel = useCallback(() => {
    const data = getFilteredContacts();
    const rows = data.map(s => ({
      Nome: s.name, Email: s.email, WhatsApp: formatPhone(s.phone), Faturamento: s.faturamento || "",
      "Área da Beleza": s.area_beleza || "", Formulário: s.product || "",
      Origem: s.utm_source || "", Mídia: s.utm_medium || "", Campanha: s.utm_campaign || "",
      "Recebido em": format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contatos");
    XLSX.writeFile(wb, "contatos.xlsx");
  }, [getFilteredContacts]);

  const exportDOCX = useCallback(async () => {
    const data = getFilteredContacts();
    const headers = ["Nome", "Email", "WhatsApp", "Faturamento", "Formulário", "Origem", "Mídia", "Campanha"];
    const colW = [2000, 2500, 1800, 2000, 2000, 1500, 1500, 2000];
    const makeCell = (text: string, bold = false) => new TableCell({
      width: { size: 1200, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text, bold, size: 18 })] })],
    });
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: "Contatos Exportados", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Total: ${data.length} registro(s)`, children: [new TextRun({ text: `Total: ${data.length} registro(s)`, size: 20, color: "888888" })] }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: headers.map(h => makeCell(h, true)), tableHeader: true }),
              ...data.map(s => new TableRow({
                children: [
                  s.name, s.email, formatPhone(s.phone), s.faturamento || "—",
                  s.product || "—", s.utm_source || "—", s.utm_medium || "—", s.utm_campaign || "—",
                ].map(v => makeCell(v)),
              })),
            ],
          }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "contatos.docx"; a.click();
  }, [getFilteredContacts]);

  const saveCurrentFilter = useCallback(() => {
    if (!saveFilterName.trim()) return;
    const newFilter = { id: Date.now().toString(), name: saveFilterName.trim(), utmFilter, formFilter };
    const updated = [...savedContactFilters, newFilter];
    setSavedContactFilters(updated);
    localStorage.setItem("saved_contact_filters", JSON.stringify(updated));
    setSaveFilterName(""); setSaveFilterInputOpen(false);
    toast.success("Filtro salvo!");
  }, [saveFilterName, utmFilter, formFilter, savedContactFilters]);

  const deleteSavedFilter = useCallback((id: string) => {
    const updated = savedContactFilters.filter(f => f.id !== id);
    setSavedContactFilters(updated);
    localStorage.setItem("saved_contact_filters", JSON.stringify(updated));
  }, [savedContactFilters]);

  const livePreviewCode = useMemo(() => {
    if (!userId) return "";
    return generateLeadFormHTML(
      formGenName || "Preview",
      formGenProduct.trim() || "Qualificação de Leads",
      formBgColor,
      formTextColor,
      userId,
      "preview-temp",
      false,
      "",
      formHideFaturamento,
      formHideArea,
      "",
      formNoEmail,
      "",
      "",
      formFieldsConfig,
      true // previewMode — skip external fonts/scripts
    );
  }, [formGenName, formGenProduct, formBgColor, formTextColor, userId, formHideFaturamento, formHideArea, formNoEmail, formFieldsConfig]);

  const utmOptions = useMemo(() => ({
    utm_source: [...new Set(formSubmissions.map(s => s.utm_source).filter(Boolean) as string[])],
    utm_medium: [...new Set(formSubmissions.map(s => s.utm_medium).filter(Boolean) as string[])],
    utm_campaign: [...new Set(formSubmissions.map(s => s.utm_campaign).filter(Boolean) as string[])],
    utm_content: [...new Set(formSubmissions.map(s => s.utm_content).filter(Boolean) as string[])],
    utm_term: [...new Set(formSubmissions.map(s => s.utm_term).filter(Boolean) as string[])],
  }), [formSubmissions]);

  const formOptions = useMemo(() =>
    [...new Set(formSubmissions.map(s => s.product).filter(Boolean) as string[])],
  [formSubmissions]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let noFormCount = 0;
    formSubmissions.forEach(s => {
      if (s.form_id) { counts[s.form_id] = (counts[s.form_id] || 0) + 1; }
      else { noFormCount++; }
    });
    return { counts, noFormCount };
  }, [formSubmissions]);

  useEffect(() => { setContactsPage(1); }, [selectedFormFolder]);

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
            {tab === "formulario" && (
              <Button
                onClick={() => {
                  setEditingFormId(null);
                  setFormGenName("");
                  setFormGenProduct("");
                  setFormGenCode("");
                  setFormBgColor("#fafafa");
                  setFormTextColor("#111111");
                  setFormNoSave(false);
                  setFormWebhook(false);
                  setFormWebhookUrl("");
                  setFormHideFaturamento(false);
                  setFormHideArea(false);
                  setFormRedirectMode("default"); setFormRedirectUrl("");
                  setFormNoEmail(false);
                  setAdvancedOpen(false);
                  setFormModalOpen(true);
                }}
                className="h-9 px-4 text-sm bg-foreground text-background hover:bg-foreground/90 gap-2"
              >
                <FileCode className="w-4 h-4" />
                Criar Formulário
              </Button>
            )}
            {tab === "dashboard" && (
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setFilterOpen(o => !o)}
                  className={`flex items-center gap-2 h-9 px-4 rounded-full border text-sm font-medium transition-all ${filterOpen || dateFilter !== "todos" ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white border-[#e5e5e5] text-[#555] hover:border-[#aaa]"}`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>
                    {dateFilter === "todos" && "Filtrar"}
                    {dateFilter === "hoje" && "Hoje"}
                    {dateFilter === "ontem" && "Ontem"}
                    {dateFilter === "7dias" && "7 Dias"}
                    {dateFilter === "30dias" && "30 Dias"}
                    {dateFilter === "custom" && (
                      customRange?.from && customRange?.to
                        ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}`
                        : customRange?.from
                          ? format(customRange.from, "dd/MM")
                          : "Personalizado"
                    )}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
                </button>

                {filterOpen && (
                  <div className="absolute right-0 top-11 z-50 bg-white border border-[#ebebeb] rounded-2xl shadow-xl p-4 w-80 space-y-4">
                    {/* Presets */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: "todos", label: "Todos" },
                        { key: "hoje", label: "Hoje" },
                        { key: "ontem", label: "Ontem" },
                        { key: "7dias", label: "7 Dias" },
                        { key: "30dias", label: "30 Dias" },
                      ].map(p => (
                        <button
                          key={p.key}
                          onClick={() => { setDateFilter(p.key as typeof dateFilter); if (p.key !== "custom") setFilterOpen(false); }}
                          className={`h-8 px-4 rounded-full text-xs font-medium border transition-all ${dateFilter === p.key ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white border-[#e5e5e5] text-[#555] hover:border-[#aaa]"}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Divisor */}
                    <div className="border-t border-[#f0f0f0]" />

                    {/* Calendário visual de range */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#bbb]">Período personalizado</p>
                      {customRange?.from && (
                        <div className="flex items-center justify-between text-xs px-1">
                          <span className="text-[#999]">
                            {format(customRange.from, "dd/MM/yyyy")}
                            {customRange.to ? ` – ${format(customRange.to, "dd/MM/yyyy")}` : " → …"}
                          </span>
                          <button
                            onClick={() => { setCustomRange(undefined); setDateFilter("todos"); }}
                            className="text-[#ccc] hover:text-[#888] transition-colors text-[10px]"
                          >
                            limpar
                          </button>
                        </div>
                      )}
                      <Calendar
                        mode="range"
                        selected={customRange}
                        onSelect={(range) => {
                          setCustomRange(range);
                          setDateFilter("custom");
                        }}
                        locale={ptBR}
                        disabled={{ after: new Date() }}
                        className="rounded-xl border border-[#f0f0f0] p-0"
                      />
                      {customRange?.from && customRange?.to && (
                        <button
                          onClick={() => setFilterOpen(false)}
                          className="w-full h-9 rounded-xl bg-[#1a1a1a] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          Aplicar período
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {tab === "contatos" && inFolderView && (
              <div className="flex items-center gap-2 flex-1 justify-end">
                {/* Search */}
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>

                {/* Date Filter */}
                <div className="relative shrink-0" ref={contactsFilterRef}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setContactsFilterOpen(o => !o)}
                      className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-all whitespace-nowrap ${contactsDateFilter !== "todos" ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white border-border text-muted-foreground hover:border-[#aaa]"}`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {contactsDateFilter === "todos" ? "Data" : contactsDateFilter === "hoje" ? "Hoje" : contactsDateFilter === "ontem" ? "Ontem" : contactsDateFilter === "7dias" ? "7 Dias" : contactsDateFilter === "30dias" ? "30 Dias" : contactsCustomRange?.from ? `${format(contactsCustomRange.from, "dd/MM")}${contactsCustomRange.to ? ` – ${format(contactsCustomRange.to, "dd/MM")}` : ""}` : "Período"}
                    </button>
                    {contactsDateFilter !== "todos" && (
                      <button
                        onClick={() => { setContactsDateFilter("todos"); setContactsCustomRange(undefined); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-white text-muted-foreground hover:text-foreground hover:border-[#aaa] transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {contactsFilterOpen && (
                    <div className="absolute right-0 top-11 z-50 bg-white border border-[#ebebeb] rounded-2xl shadow-xl p-4 w-80 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {([
                          { key: "todos", label: "Todos" },
                          { key: "hoje", label: "Hoje" },
                          { key: "ontem", label: "Ontem" },
                          { key: "7dias", label: "7 Dias" },
                          { key: "30dias", label: "30 Dias" },
                        ] as const).map(p => (
                          <button
                            key={p.key}
                            onClick={() => { setContactsDateFilter(p.key); if (p.key !== "custom") { setContactsCustomRange(undefined); setContactsFilterOpen(false); } }}
                            className={`h-8 px-4 rounded-full text-xs font-medium border transition-all ${contactsDateFilter === p.key ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white border-[#e5e5e5] text-[#555] hover:border-[#aaa]"}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-[#f0f0f0]" />
                      <div className="space-y-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#bbb]">Período personalizado</p>
                        {contactsCustomRange?.from && (
                          <div className="flex items-center justify-between text-xs px-1">
                            <span className="text-[#999]">
                              {format(contactsCustomRange.from, "dd/MM/yyyy")}
                              {contactsCustomRange.to ? ` – ${format(contactsCustomRange.to, "dd/MM/yyyy")}` : " → …"}
                            </span>
                            <button
                              onClick={() => { setContactsCustomRange(undefined); setContactsDateFilter("todos"); }}
                              className="text-[#ccc] hover:text-[#888] transition-colors text-[10px]"
                            >limpar</button>
                          </div>
                        )}
                        <Calendar
                          mode="range"
                          selected={contactsCustomRange}
                          onSelect={(range) => {
                            setContactsCustomRange(range);
                            setContactsDateFilter("custom");
                          }}
                          locale={ptBR}
                          disabled={{ after: new Date() }}
                          className="rounded-xl border border-[#f0f0f0] p-0"
                        />
                        {contactsCustomRange?.from && contactsCustomRange?.to && (
                          <button
                            onClick={() => setContactsFilterOpen(false)}
                            className="w-full h-9 rounded-xl bg-[#1a1a1a] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                          >
                            Aplicar período
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* UTM Filter */}
                <div className="relative shrink-0" ref={utmFilterRef}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setUtmFilterOpen(o => !o); if (utmFilter) { setUtmSearchField(utmFilter.field); setUtmSearchValue(utmFilter.value); } }}
                      className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-all whitespace-nowrap ${utmFilter ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white border-border text-muted-foreground hover:border-[#aaa]"}`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {utmFilter ? `${{ utm_source: "Origem", utm_medium: "Mídia", utm_campaign: "Campanha", utm_content: "Conteúdo", utm_term: "Termo" }[utmFilter.field]}: ${utmFilter.value}` : "UTMs"}
                    </button>
                    {utmFilter && (
                      <button
                        onClick={() => { setUtmFilter(null); setUtmSearchValue(""); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-white text-muted-foreground hover:text-foreground hover:border-[#aaa] transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {utmFilterOpen && (
                    <div className="absolute right-0 top-11 z-50 bg-white border border-[#ebebeb] rounded-2xl shadow-xl p-4 w-72 space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#bbb]">Filtrar por UTM</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const).map(field => {
                          const labels = { utm_source: "Origem", utm_medium: "Mídia", utm_campaign: "Campanha", utm_content: "Conteúdo", utm_term: "Termo" };
                          return (
                            <button
                              key={field}
                              onClick={() => setUtmSearchField(field)}
                              className={`h-7 px-3 rounded-full text-xs font-medium border transition-all ${utmSearchField === field ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white border-[#e5e5e5] text-[#555] hover:border-[#aaa]"}`}
                            >
                              {labels[field]}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={utmSearchValue}
                          onChange={e => setUtmSearchValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && utmSearchValue.trim()) {
                              setUtmFilter({ field: utmSearchField, value: utmSearchValue.trim() });
                              setUtmFilterOpen(false);
                            }
                            if (e.key === "Escape") setUtmFilterOpen(false);
                          }}
                          placeholder={`Valor de ${{ utm_source: "origem", utm_medium: "mídia", utm_campaign: "campanha", utm_content: "conteúdo", utm_term: "termo" }[utmSearchField]}...`}
                          className="flex-1 h-9 px-3 rounded-lg border border-[#e5e5e5] bg-white text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#aaa]"
                        />
                        <button
                          onClick={() => {
                            if (utmSearchValue.trim()) {
                              setUtmFilter({ field: utmSearchField, value: utmSearchValue.trim() });
                              setUtmFilterOpen(false);
                            }
                          }}
                          className="h-9 px-3 rounded-lg bg-[#1a1a1a] text-white text-xs font-medium hover:opacity-90 whitespace-nowrap"
                        >
                          Buscar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Salvar filtro (só aparece quando há filtro ativo) */}
                {utmFilter && (
                  <div className="relative shrink-0">
                    {saveFilterInputOpen ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={saveFilterName}
                          onChange={e => setSaveFilterName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveCurrentFilter(); if (e.key === "Escape") setSaveFilterInputOpen(false); }}
                          placeholder="Nome do filtro..."
                          className="h-9 w-36 rounded-lg border border-border bg-white px-3 text-xs text-foreground focus:outline-none focus:border-[#aaa]"
                        />
                        <button onClick={saveCurrentFilter} className="h-9 px-3 rounded-lg bg-[#1a1a1a] text-white text-xs font-medium hover:opacity-90">Salvar</button>
                        <button onClick={() => setSaveFilterInputOpen(false)} className="h-9 px-2 rounded-lg border border-border text-muted-foreground hover:text-foreground text-xs"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSaveFilterInputOpen(true)}
                        className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-white text-xs font-medium text-muted-foreground hover:border-[#aaa] whitespace-nowrap"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        Salvar filtro
                      </button>
                    )}
                  </div>
                )}

                {/* Exportar */}
                <div className="relative shrink-0" ref={exportRef}>
                  <button
                    onClick={() => { setExportOpen(o => !o); setUtmFilterOpen(false); }}
                    className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-all whitespace-nowrap ${exportOpen ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white border-border text-muted-foreground hover:border-[#aaa]"}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar
                    <ChevronDown className={`w-3 h-3 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 top-11 z-50 bg-white border border-[#ebebeb] rounded-2xl shadow-xl p-3 w-48 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#bbb] px-2 pb-1">
                        {(utmFilter || selectedFormFolder) ? "Exportar filtrado" : "Exportar todos"}
                      </p>
                      {[
                        { label: "Excel (.xlsx)", action: () => { exportExcel(); setExportOpen(false); } },
                        { label: "CSV (.csv)", action: () => { exportCSV(); setExportOpen(false); } },
                        { label: "Word (.docx)", action: () => { exportDOCX(); setExportOpen(false); } },
                      ].map(opt => (
                        <button
                          key={opt.label}
                          onClick={opt.action}
                          className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-[#555] hover:bg-[#f5f5f5] transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dashboard */}
          {tab === "dashboard" && (() => {
            const { totalLeads, sqlLeads, sqlRate, trendData, trendInterval, fatDonut, fatTotal, areaData, areaMax, areaDonut, ebookOptions, ebookCounts, ebookMax } = dashboardData;
            return (
              <div className="space-y-4">
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

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#1a1a1a] text-white p-5 flex flex-col gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-white/50">Total de Leads</span>
                    <span className="text-5xl font-black leading-none">{totalLeads}</span>
                    <span className="text-[11px] text-white/40 mt-auto">{ebookFilter === "todos" ? "todos os formulários" : ebookFilter}</span>
                  </div>
                  <div className="rounded-2xl bg-white border border-[#ebebeb] p-5 flex flex-col gap-2 shadow-sm">
                    <span className="text-[11px] uppercase tracking-widest text-[#aaa]">Lead MQL</span>
                    <span className="text-5xl font-black leading-none text-[#1a1a1a]">{sqlRate}%</span>
                    <span className="text-[11px] text-[#ccc] mt-auto">faturamento R$5k – R$10k</span>
                  </div>
                </div>

                {/* Tendência + Faturamento */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 rounded-2xl bg-white border border-[#ebebeb] shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 pt-5 pb-2">
                      <p className="text-xs text-[#aaa] uppercase tracking-widest">Tendência</p>
                    </div>
                    <div className="flex-1 min-h-0" style={{ height: 190 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 10, right: 16, left: 16, bottom: 0 }}>
                          <defs>
                            <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#1a1a1a" stopOpacity={0.08} />
                              <stop offset="100%" stopColor="#1a1a1a" stopOpacity={0} />
                            </linearGradient>
                            <filter id="glow">
                              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                              <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>
                          <XAxis
                            dataKey="name"
                            axisLine={{ stroke: "#f0f0f0", strokeWidth: 1 }}
                            tickLine={{ stroke: "#f0f0f0", strokeWidth: 1 }}
                            tick={({ x, y, payload }) => (
                              <g transform={`translate(${x},${y})`}>
                                <text
                                  x={0} y={0} dy={14}
                                  textAnchor="middle"
                                  fill="#9ca3af"
                                  fontSize={10}
                                  fontWeight={500}
                                  fontFamily="inherit"
                                >
                                  {payload.value}
                                </text>
                              </g>
                            )}
                            interval={trendInterval}
                            height={36}
                          />
                          <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, 1) * 1.4]} />
                          <Tooltip
                            contentStyle={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}
                            formatter={(v: number) => [v, "leads"]}
                            labelStyle={{ color: "#888", fontWeight: 600 }}
                            cursor={{ stroke: "#f0f0f0", strokeWidth: 1, strokeDasharray: "4 4" }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#1a1a1a"
                            strokeWidth={2.5}
                            fill="url(#leadGrad)"
                            dot={false}
                            activeDot={{ r: 5, fill: "#1a1a1a", strokeWidth: 2, stroke: "#fff" }}
                            isAnimationActive={true}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white border border-[#ebebeb] p-6 shadow-sm flex flex-col">
                    <p className="text-sm font-semibold text-[#1a1a1a] mb-4">Faturamento</p>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="relative w-72 h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={fatDonut.every(d => d.value === 0) ? [{ name: "vazio", value: 1, color: "#f2f2f2" }] : fatDonut}
                              dataKey="value" cx="50%" cy="50%" innerRadius={68} outerRadius={108} strokeWidth={0}
                              paddingAngle={fatDonut.some(d => d.value > 0) ? 3 : 0}
                            >
                              {(fatDonut.every(d => d.value === 0) ? [{ color: "#f2f2f2" }] : fatDonut).map((e, i) => (
                                <Cell key={i} fill={e.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [v, "leads"]} />
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

                {/* Área + Distribuição + Leads por Formulário */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1 rounded-2xl bg-white border border-[#ebebeb] p-6 shadow-sm">
                    <p className="text-sm font-semibold text-[#1a1a1a] mb-4">Área de Atuação</p>
                    {areaData.length === 0 ? (
                      <p className="text-[#ccc] text-sm text-center py-8">Sem dados</p>
                    ) : (
                      <div className="space-y-3">
                        {areaData.map(d => {
                          const pct = totalLeads > 0 ? Math.round((d.value / totalLeads) * 100) : 0;
                          return (
                          <div key={d.name}>
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-xs text-[#777]">{d.name}</span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-[11px] text-[#bbb]">{pct}%</span>
                                <span className="text-xs font-bold text-[#1a1a1a]">{d.value}</span>
                              </div>
                            </div>
                            <div className="h-7 rounded-full bg-[#f2f2f2] overflow-hidden relative">
                              <div className="h-full rounded-full bg-[#1a1a1a] transition-all duration-700" style={{ width: `${Math.round((d.value / areaMax) * 100)}%` }} />
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl bg-white border border-[#ebebeb] p-6 shadow-sm flex flex-col">
                    <p className="text-sm font-semibold text-[#1a1a1a] mb-4">Distribuição por Área</p>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="relative w-72 h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={areaDonut.length > 0 ? areaDonut : [{ name: "vazio", value: 1, color: "#f2f2f2" }]}
                              dataKey="value" cx="50%" cy="50%" innerRadius={68} outerRadius={108} strokeWidth={0}
                              paddingAngle={areaDonut.some(d => d.value > 0) ? 3 : 0}
                            >
                              {(areaDonut.length > 0 ? areaDonut : [{ color: "#f2f2f2" }]).map((e, i) => (
                                <Cell key={i} fill={e.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [v, "leads"]} />
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
                              <div className="h-full rounded-full bg-[#374151] transition-all duration-700" style={{ width: `${Math.round((d.value / ebookMax) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Contatos */}
          {tab === "contatos" && (
            <div className="w-full space-y-4">

            {!inFolderView ? (
              /* ── GRADE DE PASTAS ── */
              <div className="pt-2">
                <div className="relative mb-6 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={folderSearch}
                    onChange={e => setFolderSearch(e.target.value)}
                    placeholder="Buscar formulário..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#aaa] shadow-sm transition-colors"
                  />
                </div>
                <div className="flex flex-wrap gap-6">
                  {(() => {
                    const MacFolderIcon = ({ muted }: { muted?: boolean }) => (
                      <svg width="130" height="103" viewBox="0 0 96 76" fill="none">
                        <path d="M3 28L3 17Q3 13 7 13L36 13L43 6Q44.5 3 48 3L89 3Q93 3 93 7L93 28Z"
                          fill={muted ? "#9ca3af" : "#4a9ef8"} />
                        <rect x="3" y="25" width="90" height="48" rx="8"
                          fill={muted ? "#b0b8c4" : "#60a5fa"} />
                        <rect x="3" y="25" width="90" height="18" rx="8" fill="rgba(255,255,255,0.18)" />
                      </svg>
                    );

                    const allFolders: { id: string | null; name: string; count: number; muted?: boolean }[] = [
                      { id: null, name: "Todos", count: formSubmissions.length },
                      ...savedForms.map(f => ({ id: f.id, name: f.name, count: folderCounts.counts[f.id] || 0 })),
                      ...(folderCounts.noFormCount > 0 ? [{ id: "__none__", name: "Sem formulário", count: folderCounts.noFormCount, muted: true }] : []),
                    ];
                    const folders = folderSearch.trim()
                      ? allFolders.filter(f => f.name.toLowerCase().includes(folderSearch.toLowerCase()))
                      : allFolders;

                    return folders.map(folder => (
                      <button
                        key={folder.id ?? "__all__"}
                        onClick={() => { setSelectedFormFolder(folder.id); setInFolderView(true); setContactsPage(1); }}
                        className="group flex flex-col items-center gap-2 p-4 rounded-2xl transition-all select-none outline-none hover:bg-muted/60 active:scale-95"
                        style={{ width: isMobile ? 140 : 160 }}
                      >
                        <div className="transition-transform group-hover:-translate-y-1">
                          <MacFolderIcon muted={folder.muted} />
                        </div>
                        <span className="text-xs font-semibold leading-tight text-center w-full truncate text-foreground">
                          {folder.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {folder.count} {folder.count === 1 ? "lead" : "leads"}
                        </span>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            ) : (
              /* ── DENTRO DA PASTA ── */
              <div className="space-y-3">
                {/* Breadcrumb / voltar */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setInFolderView(false); setSelectedFormFolder(null); setContactsPage(1); }}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Formulários
                  </button>
                  <span className="text-muted-foreground text-xs">/</span>
                  <span className="text-xs font-semibold text-foreground">
                    {selectedFormFolder === null ? "Todos" : selectedFormFolder === "__none__" ? "Sem formulário" : savedForms.find(f => f.id === selectedFormFolder)?.name ?? "Pasta"}
                  </span>
                </div>

              {/* Conteúdo — tabela filtrada */}
              <div className="space-y-3">
              {/* Filtros salvos */}
              {savedContactFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-medium">Filtros salvos:</span>
                  {savedContactFilters.map(f => (
                    <div key={f.id} className="flex items-center gap-1 h-7 pl-3 pr-1.5 rounded-full border border-[#e5e5e5] bg-white text-xs font-medium text-[#555] hover:border-[#aaa] transition-all">
                      <button
                        onClick={() => { setUtmFilter(f.utmFilter); setFormFilter(f.formFilter); }}
                        className="flex items-center gap-1.5"
                      >
                        <Bookmark className="w-3 h-3 text-[#aaa]" />
                        {f.name}
                      </button>
                      <button onClick={() => deleteSavedFilter(f.id)} className="ml-1 text-[#ccc] hover:text-[#888] transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {formSubmissionsLoading && formSubmissions.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (<>{(() => {
                    const folderForm = selectedFormFolder && selectedFormFolder !== "__none__"
                      ? savedForms.find(f => f.id === selectedFormFolder)
                      : null;
                    const showFaturamento = !folderForm?.hide_faturamento;
                    const showArea = !folderForm?.hide_area;
                    const today = new Date();
                    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const applyContactsDate = (list: FormSubmission[]) => {
                      if (contactsDateFilter === "hoje") { const end = new Date(todayStart); end.setDate(end.getDate() + 1); return list.filter(s => { const d = new Date(s.created_at); return d >= todayStart && d < end; }); }
                      if (contactsDateFilter === "ontem") { const start = new Date(todayStart); start.setDate(start.getDate() - 1); return list.filter(s => { const d = new Date(s.created_at); return d >= start && d < todayStart; }); }
                      if (contactsDateFilter === "7dias") { const start = new Date(todayStart); start.setDate(start.getDate() - 6); return list.filter(s => new Date(s.created_at) >= start); }
                      if (contactsDateFilter === "30dias") { const start = new Date(todayStart); start.setDate(start.getDate() - 29); return list.filter(s => new Date(s.created_at) >= start); }
                      if (contactsDateFilter === "custom" && contactsCustomRange?.from) {
                        const start = contactsCustomRange.from;
                        const end = contactsCustomRange.to ? new Date(new Date(contactsCustomRange.to).setHours(23, 59, 59, 999)) : new Date(new Date(start).setHours(23, 59, 59, 999));
                        return list.filter(s => { const d = new Date(s.created_at); return d >= start && d <= end; });
                      }
                      return list;
                    };
                    const filtered = applyContactsDate(formSubmissions.filter((s) => {
                      if (searchTerm.trim()) {
                        const term = searchTerm.toLowerCase();
                        if (!s.name.toLowerCase().includes(term) && !s.email.toLowerCase().includes(term) && !s.phone.toLowerCase().includes(term)) return false;
                      }
                      if (utmFilter && s[utmFilter.field] !== utmFilter.value) return false;
                      if (formFilter && s.product !== formFilter) return false;
                      if (selectedFormFolder === "__none__") { if (s.form_id !== null) return false; }
                      else if (selectedFormFolder !== null) { if (s.form_id !== selectedFormFolder) return false; }
                      return true;
                    }));
                    const activeGuruForFolder = guruIntegrations.filter(g => g.active && (g.form_id === null || g.form_id === selectedFormFolder));
                    const showGuruCol = activeGuruForFolder.length > 0;
                    const colSpan = 9 + (showFaturamento ? 1 : 0) + (showArea ? 1 : 0) + (showGuruCol ? 1 : 0);
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Nome</th>
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Email</th>
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">WhatsApp</th>
                              {showFaturamento && <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Faturamento</th>}
                              {showArea && <th className="text-left px-4 py-3 font-semibold text-foreground">Área da Beleza</th>}
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Formulário</th>
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Origem</th>
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Mídia</th>
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Campanha</th>
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Conteúdo</th>
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Termo</th>
                              <th className="text-left px-4 py-3 font-semibold text-foreground whitespace-nowrap">Recebido em</th>
                              {showGuruCol && <th className="text-center px-4 py-3 font-semibold text-foreground whitespace-nowrap">Compra</th>}
                              <th className="px-4 py-3 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.length === 0 ? (
                              <tr>
                                <td colSpan={colSpan} className="text-center py-12 text-muted-foreground">
                                  {formSubmissions.length === 0 ? "Nenhum lead recebido ainda. Gere e publique seu formulário!" : "Nenhum lead encontrado com esses filtros."}
                                </td>
                              </tr>
                            ) : (
                              filtered
                                .slice((contactsPage - 1) * CONTACTS_PER_PAGE, contactsPage * CONTACTS_PER_PAGE)
                                .map((s) => (
                                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors animate-[fadeIn_0.3s_ease]">
                                    <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">{s.name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{s.email || "—"}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{s.phone ? formatPhone(s.phone) : "—"}</td>
                                    {showFaturamento && <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{s.faturamento || "—"}</td>}
                                    {showArea && (
                                      <td className="px-4 py-3 text-muted-foreground max-w-xs" title={s.area_beleza || ""}>
                                        {s.area_beleza ? (s.area_beleza.length > 60 ? s.area_beleza.slice(0, 60) + "…" : s.area_beleza) : "—"}
                                      </td>
                                    )}
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                      {s.product ? (
                                        <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">{s.product}</span>
                                      ) : "—"}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {s.utm_source ? <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">{s.utm_source}</span> : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {s.utm_medium ? <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">{s.utm_medium}</span> : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {s.utm_campaign ? <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-100">{s.utm_campaign}</span> : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {s.utm_content ? <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium border border-orange-100">{s.utm_content}</span> : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {s.utm_term ? <span className="px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 text-xs font-medium border border-pink-100">{s.utm_term}</span> : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                      {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                    </td>
                                    {showGuruCol && (
                                      <td className="px-4 py-3 text-center whitespace-nowrap">
                                        {guruChecking.has(s.id) ? (
                                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground inline-block" />
                                        ) : s.guru_purchased === true ? (
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600" title="Comprou">
                                            <Check className="w-3.5 h-3.5" />
                                          </span>
                                        ) : s.guru_purchased === false ? (
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-500" title="Não comprou">
                                            <X className="w-3.5 h-3.5" />
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground/40 text-xs">—</span>
                                        )}
                                      </td>
                                    )}
                                    <td className="px-2 py-3 whitespace-nowrap">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (contactMenuOpen === s.id) {
                                            setContactMenuOpen(null);
                                            setContactMenuPos(null);
                                          } else {
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setContactMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                            setContactMenuOpen(s.id);
                                          }
                                        }}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                      >
                                        <MoreHorizontal className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}</>)}
                {/* Paginação */}
                {(() => {
                  const today2 = new Date();
                  const todayStart2 = new Date(today2.getFullYear(), today2.getMonth(), today2.getDate());
                  const applyDate2 = (list: FormSubmission[]) => {
                    if (contactsDateFilter === "hoje") { const end = new Date(todayStart2); end.setDate(end.getDate() + 1); return list.filter(s => { const d = new Date(s.created_at); return d >= todayStart2 && d < end; }); }
                    if (contactsDateFilter === "ontem") { const start = new Date(todayStart2); start.setDate(start.getDate() - 1); return list.filter(s => { const d = new Date(s.created_at); return d >= start && d < todayStart2; }); }
                    if (contactsDateFilter === "7dias") { const start = new Date(todayStart2); start.setDate(start.getDate() - 6); return list.filter(s => new Date(s.created_at) >= start); }
                    if (contactsDateFilter === "30dias") { const start = new Date(todayStart2); start.setDate(start.getDate() - 29); return list.filter(s => new Date(s.created_at) >= start); }
                    if (contactsDateFilter === "custom" && contactsCustomRange?.from) {
                      const start = contactsCustomRange.from;
                      const end = contactsCustomRange.to ? new Date(new Date(contactsCustomRange.to).setHours(23, 59, 59, 999)) : new Date(new Date(start).setHours(23, 59, 59, 999));
                      return list.filter(s => { const d = new Date(s.created_at); return d >= start && d <= end; });
                    }
                    return list;
                  };
                  const filtered = applyDate2(formSubmissions.filter((s) => {
                    if (searchTerm.trim()) {
                      const term = searchTerm.toLowerCase();
                      if (!s.name.toLowerCase().includes(term) && !s.email.toLowerCase().includes(term) && !s.phone.toLowerCase().includes(term)) return false;
                    }
                    if (utmFilter && s[utmFilter.field] !== utmFilter.value) return false;
                    if (formFilter && s.product !== formFilter) return false;
                    if (selectedFormFolder === "__none__") { if (s.form_id !== null) return false; }
                    else if (selectedFormFolder !== null) { if (s.form_id !== selectedFormFolder) return false; }
                    return true;
                  }));
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
              </div>
              </div>
            )}
            </div>
          )}

          {/* Criar Formulário — lista de salvos */}
          {tab === "formulario" && (
            <div className="w-full">
              {savedFormsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : savedForms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                    <FileCode className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Nenhum formulário criado ainda</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique em "Criar Formulário" para começar</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-3 font-semibold text-foreground">Formulário</th>
                        <th className="text-left px-5 py-3 font-semibold text-foreground whitespace-nowrap">Produto / Curso</th>
                        <th className="text-left px-5 py-3 font-semibold text-foreground whitespace-nowrap">Cores</th>
                        <th className="text-left px-5 py-3 font-semibold text-foreground whitespace-nowrap">Leads</th>
                        <th className="text-left px-5 py-3 font-semibold text-foreground whitespace-nowrap">Criado em</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {savedForms.map((form) => {
                        const leadsCount = formSubmissions.filter(s => s.product === form.product && form.product).length;
                        return (
                          <tr key={form.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center" style={{ background: form.bg_color === "transparent" ? "#f5f5f5" : form.bg_color }}>
                                  <FileCode className="w-4 h-4 opacity-40" style={{ color: form.text_color }} />
                                </div>
                                <span className="font-medium text-foreground">{form.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-muted-foreground">{form.product || "—"}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-md border border-border/60" style={{ background: form.bg_color === "transparent" ? "#f5f5f5" : form.bg_color }} title="Fundo" />
                                <div className="w-5 h-5 rounded-md border border-border/60" style={{ background: form.text_color }} title="Texto" />
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              {form.product ? (
                                <span className="inline-flex items-center justify-center h-6 min-w-[28px] px-2 rounded-full bg-muted text-xs font-semibold text-foreground">
                                  {leadsCount}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap text-xs">
                              {format(new Date(form.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2 justify-end">
                                <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={() => handleOpenPixel(form)} title="Meta Pixel">
                                  <Code2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs px-4" onClick={() => handleOpenEdit(form)}>
                                  Editar
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive border-destructive/30 px-3" onClick={() => setDeleteFormId(form.id)}>
                                  Deletar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Modal — Criar / Editar Formulário */}
          <Dialog open={formModalOpen} onOpenChange={(open) => { setFormModalOpen(open); if (!open) { setEditingFormId(null); setFormGenName(""); setFormGenProduct(""); setFormGenCode(""); setFormNoSave(false); setFormWebhook(false); setFormWebhookUrl(""); setFormHideFaturamento(false); setFormHideArea(false); setFormRedirectMode("default"); setFormRedirectUrl(""); setFormNoEmail(false); setAdvancedOpen(false); setFormFieldsConfig(null); } }}>
            <DialogContent className="max-w-[92vw] w-full p-0 gap-0 overflow-hidden rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="flex h-[90vh]">

                {/* Esquerda — configurações */}
                <div className="w-[310px] flex-shrink-0 flex flex-col border-r border-border bg-muted/10">
                  {/* Header */}
                  <div className="flex items-center justify-between px-7 py-5 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
                        <FileCode className="w-3.5 h-3.5 text-background" />
                      </div>
                      <DialogTitle className="text-sm font-semibold text-foreground">
                        {editingFormId ? "Editar Formulário" : "Novo Formulário"}
                      </DialogTitle>
                    </div>
                  </div>

                  {/* Campos */}
                  <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Identificação</label>
                      <Input value={formGenName} onChange={(e) => setFormGenName(e.target.value)} placeholder="Ex: Formulário Site Principal" className="h-11" style={{ border: "1px solid #00000013" }} />
                      <p className="text-[11px] text-muted-foreground">Uso interno — não aparece no formulário</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Produto / Curso</label>
                      <Input value={formGenProduct} onChange={(e) => setFormGenProduct(e.target.value)} placeholder="Ex: Nutrição Online, Mentoria..." className="h-11" style={{ border: "1px solid #00000013" }} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Cores</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Fundo</p>
                          <div className="flex items-center gap-2 h-10 rounded-xl px-3 bg-background" style={{ border: "1px solid #00000013" }}>
                            <input type="color" value={formBgColor} onChange={(e) => setFormBgColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-none" />
                            <span className="text-xs font-mono text-muted-foreground">{formBgColor}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Texto</p>
                          <div className="flex items-center gap-2 h-10 rounded-xl px-3 bg-background" style={{ border: "1px solid #00000013" }}>
                            <input type="color" value={formTextColor} onChange={(e) => setFormTextColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-none" />
                            <span className="text-xs font-mono text-muted-foreground">{formTextColor}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Avançado */}
                    <div className="space-y-2 pt-1 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setAdvancedOpen(o => !o)}
                        className="flex items-center gap-2 w-full text-left"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Avançado</span>
                      </button>

                      {advancedOpen && (
                        <div className="space-y-4 pt-1">
                          {/* Toggle: Não salvar leads */}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-foreground">Não salvar leads na plataforma</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">Leads não serão salvos no Webnary</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormNoSave(o => !o)}
                              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
                              style={{ background: formNoSave ? "#111" : "#d1d5db" }}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${formNoSave ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                            </button>
                          </div>

                          {/* Toggle: Enviar via webhook */}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-foreground">Enviar via webhook</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">Integrar com outra plataforma via JSON</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormWebhook(o => !o)}
                              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
                              style={{ background: formWebhook ? "#111" : "#d1d5db" }}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${formWebhook ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                            </button>
                          </div>

                          {/* Toggle: Remover faturamento */}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-foreground">Remover pergunta de faturamento</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">Pula a etapa de faturamento mensal</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormHideFaturamento(o => !o)}
                              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
                              style={{ background: formHideFaturamento ? "#111" : "#d1d5db" }}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${formHideFaturamento ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                            </button>
                          </div>

                          {/* Toggle: Remover área de atuação */}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-foreground">Remover pergunta de área de atuação</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">Pula a etapa de área de beleza</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormHideArea(o => !o)}
                              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
                              style={{ background: formHideArea ? "#111" : "#d1d5db" }}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${formHideArea ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                            </button>
                          </div>

                          {/* Redirecionamento após envio */}
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-foreground">Redirecionamento após envio</p>
                            <div className="flex flex-col gap-2">
                              {([
                                { value: "default", label: "Padrão", sub: "Redireciona para a página padrão" },
                                { value: "none", label: "Não redirecionar", sub: "Mantém o usuário na página" },
                                { value: "custom", label: "URL personalizada", sub: "Redireciona para um link específico" },
                              ] as const).map(opt => (
                                <label key={opt.value} className="flex items-start gap-2.5 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="redirect_mode"
                                    value={opt.value}
                                    checked={formRedirectMode === opt.value}
                                    onChange={() => setFormRedirectMode(opt.value)}
                                    className="mt-0.5 accent-[#111]"
                                  />
                                  <div>
                                    <p className="text-xs font-medium text-foreground leading-tight">{opt.label}</p>
                                    <p className="text-[11px] text-muted-foreground">{opt.sub}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                            {formRedirectMode === "custom" && (
                              <Input
                                placeholder="https://seusite.com/obrigado"
                                value={formRedirectUrl}
                                onChange={e => setFormRedirectUrl(e.target.value)}
                                className="h-9 text-xs mt-1"
                              />
                            )}
                          </div>

                          {/* Toggle: Não enviar email */}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-foreground">Não enviar e-mail de notificação</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">Desativa o e-mail automático ao lead</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormNoEmail(o => !o)}
                              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
                              style={{ background: formNoEmail ? "#111" : "#d1d5db" }}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${formNoEmail ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                            </button>
                          </div>

                          {formWebhook && (
                            <div className="space-y-2">
                              <label className="text-[11px] text-muted-foreground font-medium">URL do Webhook</label>
                              <Input
                                value={formWebhookUrl}
                                onChange={(e) => setFormWebhookUrl(e.target.value)}
                                placeholder="https://hooks.zapier.com/..."
                                className="h-10 text-xs font-mono"
                                style={{ border: "1px solid #00000013" }}
                              />
                              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
                                <p className="text-[11px] font-semibold text-foreground">Payload enviado (JSON)</p>
                                <pre className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{`{
  "name": "...",
  "email": "...",
  "phone": "...",
  "faturamento": "...",
  "area_beleza": "...",
  "utm_source": "...",
  "utm_medium": "...",
  "utm_campaign": "...",
  "utm_content": "...",
  "utm_term": "...",
  "form_id": "...",
  "product": "...",
  "owner_id": "..."
}`}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Button onClick={handleGenerateForm} disabled={!formGenName.trim()} className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-semibold">
                      <FileCode className="w-4 h-4 mr-2" />
                      {editingFormId ? "Atualizar Código" : "Gerar Código HTML"}
                    </Button>

                    {formGenCode && (
                      <div className="space-y-3 pt-1 border-t border-border">
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Código gerado</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleSaveForm} disabled={formSaving} className="h-8 gap-1.5 text-xs">
                              {formSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              {editingFormId ? "Atualizar" : "Salvar"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={copyFormCode} className="h-8 gap-1.5 text-xs">
                              {formGenCopied ? <><Check className="w-3 h-3 text-green-500" />Copiado!</> : <><Copy className="w-3 h-3" />Copiar</>}
                            </Button>
                          </div>
                        </div>
                        <textarea readOnly value={formGenCode} className="w-full h-28 text-[11px] font-mono bg-muted border border-border rounded-xl p-3 resize-none text-muted-foreground focus:outline-none" />
                        <div className="rounded-xl border border-border bg-background p-4 space-y-2">
                          <p className="text-[11px] font-semibold text-foreground">Como usar no Elementor / WordPress</p>
                          <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                            <li>Copie o código acima</li>
                            <li>No Elementor, adicione o widget <strong>HTML</strong></li>
                            <li>Cole o código dentro do widget</li>
                            <li>Salve e publique a página</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Centro — preview */}
                <div className="flex-1 flex flex-col bg-[#f8f8f8]">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-white">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium ml-2">Preview ao vivo</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {livePreviewCode ? (
                      <iframe srcDoc={livePreviewCode} className="w-full h-full" style={{ border: "none" }} title="Preview" sandbox="allow-scripts allow-same-origin" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-xs text-muted-foreground">Carregando preview...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direita — builder de campos */}
                <div className="w-[360px] flex-shrink-0 flex flex-col border-l border-border bg-background">
                  <FormFieldsBuilder
                    value={formFieldsConfig ?? defaultConfig()}
                    onChange={(cfg) => setFormFieldsConfig(cfg)}
                  />
                </div>

              </div>
            </DialogContent>
          </Dialog>

          {/* Configurações */}
          {tab === "configuracoes" && (
            <div className="w-full flex gap-6 items-start">

              {/* Menu lateral */}
              <div className="w-52 shrink-0 rounded-2xl border border-border bg-card overflow-hidden">
                {([
                  { key: "conta", label: "Conta", icon: <Settings className="w-4 h-4" /> },
                  { key: "integracoes", label: "Integrações", icon: <Zap className="w-4 h-4" /> },
                ] as const).map(item => (
                  <button
                    key={item.key}
                    onClick={() => setSettingsSection(item.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-border last:border-0 ${settingsSection === item.key ? "bg-foreground text-background" : "text-foreground hover:bg-muted/50"}`}
                  >
                    {item.icon}
                    {item.label}
                    {settingsSection === item.key && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
                  </button>
                ))}
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0 space-y-4">

                {/* Conta */}
                {settingsSection === "conta" && (
                  <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                    <div className="flex items-center gap-3 pb-4 border-b border-border">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                        <Settings className="w-4 h-4 text-foreground" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">Conta</h2>
                        <p className="text-xs text-muted-foreground">Informações da sua conta</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">E-mail</p>
                        <p className="text-sm font-medium text-foreground">{userEmail ?? "—"}</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        className="h-10 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-2"
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
                )}

                {/* Integrações */}
                {settingsSection === "integracoes" && (
                  <div className="space-y-4">
                    {/* Header Guru */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Guru Manager</p>
                            <p className="text-xs text-muted-foreground">Verifique se leads compraram seu produto</p>
                          </div>
                        </div>
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleOpenGuruNew}>
                          + Adicionar
                        </Button>
                      </div>

                      {guruIntegrations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border py-8 flex flex-col items-center gap-2 text-center">
                          <p className="text-xs text-muted-foreground">Nenhuma integração configurada ainda.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {guruIntegrations.map(g => (
                            <div key={g.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${g.active ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{g.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  Produto: {g.product_id} {g.form_id ? `· ${savedForms.find(f => f.id === g.form_id)?.name ?? "Formulário"}` : "· Todos os formulários"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleToggleGuru(g)}
                                  className={`relative w-9 h-5 rounded-full transition-colors ${g.active ? "bg-green-500" : "bg-muted"}`}
                                >
                                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${g.active ? "left-4" : "left-0.5"}`} />
                                </button>
                                <button onClick={() => handleOpenGuruEdit(g)} className="h-7 px-2.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors text-foreground">Editar</button>
                                <button onClick={() => handleDeleteGuru(g.id)} className="h-7 px-2.5 text-xs rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors">Excluir</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </div>

      {/* Contact row menu portal */}
      {contactMenuOpen && contactMenuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => { setContactMenuOpen(null); setContactMenuPos(null); }} />
          <div
            className="fixed z-[100] bg-white border border-border rounded-xl shadow-lg py-1 w-44"
            style={{ top: contactMenuPos.top, right: contactMenuPos.right }}
          >
            <button
              onClick={() => { setContactMenuOpen(null); setContactMenuPos(null); setDeleteContactId(contactMenuOpen); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Apagar contato
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Delete Contact Dialog */}
      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => { if (!open) setDeleteContactId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar este contato? Ele será removido permanentemente do banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteContactId && handleDeleteContact(deleteContactId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Guru Integration Modal */}
      <Dialog open={guruModalOpen} onOpenChange={(open) => { if (!open) setGuruModalOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                <Zap className="w-4 h-4 text-orange-500" />
              </div>
              {guruEditId ? "Editar integração Guru" : "Nova integração Guru"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Nome da integração</label>
              <input
                type="text"
                value={guruEditName}
                onChange={e => setGuruEditName(e.target.value)}
                autoComplete="new-password"
                placeholder="Ex: Guru — Curso X"
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#aaa]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Token da API Guru</label>
              <div className="flex gap-2">
                <input
                  type={guruEditTokenVisible ? "text" : "password"}
                  value={guruEditToken}
                  onChange={e => setGuruEditToken(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Token de acesso da API"
                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#aaa]"
                />
                <button type="button" onClick={() => setGuruEditTokenVisible(v => !v)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground">
                  {guruEditTokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Encontre em: Guru Manager → Configurações → API → Token de acesso.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">ID do Produto</label>
              <input
                type="text"
                value={guruEditProductId}
                onChange={e => setGuruEditProductId(e.target.value)}
                autoComplete="new-password"
                placeholder="ID do produto no Guru"
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#aaa]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Formulário</label>
              <select
                value={guruEditFormId}
                onChange={e => setGuruEditFormId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-[#aaa]"
              >
                <option value="">Todos os formulários</option>
                {savedForms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">A verificação só ocorre para leads do formulário selecionado, ou todos se nenhum for escolhido.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuruModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveGuru} disabled={guruSaving} className="min-w-[80px]">
              {guruSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meta Pixel Modal */}
      <Dialog open={!!pixelModalFormId} onOpenChange={(open) => { if (!open) setPixelModalFormId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-lg bg-[#1877f2]/10 flex items-center justify-center">
                <Code2 className="w-4 h-4 text-[#1877f2]" />
              </div>
              Meta Pixel &amp; API de Conversões
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 py-2">
            {/* Coluna esquerda — campos */}
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">ID do Pixel</label>
                <input
                  type="text"
                  value={pixelEditPixelId}
                  onChange={e => setPixelEditPixelId(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Ex: 1234567890123456"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#1877f2]/50"
                />
                <p className="text-[11px] text-muted-foreground">Encontre em: Gerenciador de Anúncios → Fontes de Dados → Pixels.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Token da API de Conversões (CAPI)</label>
                <div className="flex gap-2">
                  <input
                    type={pixelCapiVisible ? "text" : "password"}
                    value={pixelEditCapiToken}
                    onChange={e => setPixelEditCapiToken(e.target.value)}
                    autoComplete="new-password"
                    placeholder="EAAxxxxx..."
                    className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#1877f2]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setPixelCapiVisible(v => !v)}
                    className="h-10 w-10 flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground"
                  >
                    {pixelCapiVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">Gerenciador de Negócios → Fontes de Dados → Pixel → API de Conversões → Gerar token de acesso.</p>
              </div>
            </div>

            {/* Coluna direita — explicação */}
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground text-[13px]">Como funciona</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-[#1877f2]/10 text-[#1877f2] flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
                    <p><strong className="text-foreground">PageView</strong> — disparado pelo pixel do navegador quando o formulário carrega.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-[#1877f2]/10 text-[#1877f2] flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
                    <p><strong className="text-foreground">Lead (browser)</strong> — <code className="bg-muted px-1 rounded">fbq('track','Lead')</code> disparado após o envio com <code className="bg-muted px-1 rounded">eventID</code> único.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-[#1877f2]/10 text-[#1877f2] flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
                    <p><strong className="text-foreground">Lead (CAPI)</strong> — enviado direto à API do Meta com nome, e-mail e telefone hasheados em SHA-256. Mesmo <code className="bg-muted px-1 rounded">eventID</code> para deduplicação automática.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 p-3 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                O token CAPI fica salvo no banco e é carregado em tempo real — não fica exposto no código do formulário embutido.
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setPixelModalFormId(null)}>Cancelar</Button>
            <Button onClick={handleSavePixel} disabled={pixelSaving} className="bg-[#1877f2] hover:bg-[#1469d6] text-white min-w-[90px]">
              {pixelSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Form Dialog */}
      <AlertDialog open={!!deleteFormId} onOpenChange={(open) => { if (!open) setDeleteFormId(null); }}>
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
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
