import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowUp, Square, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlbm1yZHFkbWppZGxvaXZqeWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2NjM1NzEsImV4cCI6MjA1ODIzOTU3MX0.YX2wMEGOYzCLXbMkSjKM5SYuEK2nzjCz-jXB5ERg_as";

const CHART_COLORS = [
  "#9747FF",
  "#FF2689",
  "#FF9C2B",
  "#22d3ee",
  "#4ade80",
  "#f472b6",
  "#facc15",
  "#a78bfa",
];

interface SavedForm {
  id: string;
  form_name: string;
}

interface FormSubmission {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  faturamento: string | null;
  area_beleza: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  product: string | null;
  form_id: string | null;
  guru_purchased: boolean | null;
  guru_product_name: string | null;
  guru_amount: number | null;
  assiny_purchased: boolean | null;
  assiny_product_name: string | null;
  assiny_amount: number | null;
  ai_analysis: string | null;
  created_at: string | null;
}

interface KPI {
  label: string;
  valor: string;
  descricao: string;
}

interface GraficoData {
  name: string;
  valor: number;
  [key: string]: string | number;
}

interface Grafico {
  tipo: "bar" | "pie" | "area";
  titulo: string;
  dados: GraficoData[];
  dataKey: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  kpis?: KPI[];
  graficos?: Grafico[];
  downloadUrl?: string;
  downloadFilename?: string;
  downloadCount?: number;
}

function buildCSV(leads: FormSubmission[]): string {
  const escape = (v: string | null) => {
    if (!v) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = [["Nome", "Email", "Telefone"]];
  for (const l of leads) {
    rows.push([escape(l.name), escape(l.email), escape(l.phone)]);
  }
  return rows.map((r) => r.join(",")).join("\n");
}

function createDownloadURL(leads: FormSubmission[]): string {
  const csv = buildCSV(leads);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  return URL.createObjectURL(blob);
}

function calcLeadScore(s: FormSubmission): number {
  let score = 0;
  if (s.faturamento) {
    const f = s.faturamento.toLowerCase();
    if (f.includes("50") || f.includes("100") || f.includes("mais")) score += 4;
    else if (f.includes("20") || f.includes("30")) score += 2;
    else score += 1;
  }
  if (s.guru_purchased || s.assiny_purchased) score += 4;
  if (s.utm_source) score += 1;
  if (s.utm_campaign) score += 1;
  return Math.min(score, 10);
}

function aggregateLeads(leads: FormSubmission[], formName: string) {
  const total = leads.length;
  const compraram = leads.filter((l) => l.guru_purchased || l.assiny_purchased).length;

  const faturamento: Record<string, number> = {};
  const area: Record<string, number> = {};
  const origem: Record<string, number> = {};
  const produtos: Record<string, number> = {};
  const indicacoesProduto: Record<string, number> = {};
  let alto = 0, medio = 0, baixo = 0;

  for (const l of leads) {
    if (l.faturamento) faturamento[l.faturamento] = (faturamento[l.faturamento] ?? 0) + 1;
    if (l.area_beleza) area[l.area_beleza] = (area[l.area_beleza] ?? 0) + 1;
    if (l.utm_source) origem[l.utm_source] = (origem[l.utm_source] ?? 0) + 1;
    if (l.guru_purchased && l.guru_product_name) {
      produtos[l.guru_product_name] = (produtos[l.guru_product_name] ?? 0) + 1;
    }
    if (l.assiny_purchased && l.assiny_product_name) {
      produtos[l.assiny_product_name] = (produtos[l.assiny_product_name] ?? 0) + 1;
    }

    // Extract product recommendation from ai_analysis
    if (l.ai_analysis) {
      const match = l.ai_analysis.match(/\*\*Produto indicado:\*\*\s*([^—\n]+)/i);
      if (match) {
        const prod = match[1].trim();
        indicacoesProduto[prod] = (indicacoesProduto[prod] ?? 0) + 1;
      }
    }

    const sc = calcLeadScore(l);
    if (sc >= 8) alto++;
    else if (sc >= 5) medio++;
    else baixo++;
  }

  return {
    total,
    compraram,
    formName,
    faturamento,
    area,
    origem,
    produtos,
    scores: { alto, medio, baixo },
    indicacoesProduto,
  };
}

function MentionDropdown({
  forms,
  query,
  onSelect,
  visible,
}: {
  forms: SavedForm[];
  query: string;
  onSelect: (form: SavedForm) => void;
  visible: boolean;
}) {
  const filtered = forms.filter((f) =>
    f.form_name.toLowerCase().includes(query.toLowerCase())
  );
  if (!visible || filtered.length === 0) return null;
  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
      {filtered.map((f) => (
        <button
          key={f.id}
          onClick={() => onSelect(f)}
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
        >
          <span className="text-[#9747FF] font-bold">@</span>
          <span>{f.form_name}</span>
        </button>
      ))}
    </div>
  );
}

function KpiCard({ kpi }: { kpi: KPI }) {
  return (
    <div className="bg-muted/20 border border-border rounded-xl p-4">
      <div className="text-2xl font-black text-foreground">{kpi.valor}</div>
      <div className="text-sm font-semibold text-foreground mt-1">{kpi.label}</div>
      {kpi.descricao && (
        <div className="text-xs text-muted-foreground mt-1">{kpi.descricao}</div>
      )}
    </div>
  );
}

function ChartBlock({ grafico }: { grafico: Grafico }) {
  if (!grafico.dados || grafico.dados.length === 0) return null;

  return (
    <div className="bg-muted/10 border border-border rounded-xl p-4">
      <div className="text-sm font-semibold text-foreground mb-3">{grafico.titulo}</div>
      <ResponsiveContainer width="100%" height={220}>
        {grafico.tipo === "pie" ? (
          <PieChart>
            <Pie
              data={grafico.dados}
              dataKey={grafico.dataKey}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {grafico.dados.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : grafico.tipo === "area" ? (
          <AreaChart data={grafico.dados}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey={grafico.dataKey}
              stroke="#9747FF"
              fill="#9747FF22"
              strokeWidth={2}
            />
          </AreaChart>
        ) : (
          <BarChart data={grafico.dados} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={100}
            />
            <Tooltip />
            <Bar dataKey={grafico.dataKey} radius={[0, 4, 4, 0]}>
              {grafico.dados.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function CodeMessage({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex items-start gap-2 py-1">
        <span className="text-[#9747FF] font-mono text-xs shrink-0 mt-0.5 select-none">›</span>
        <span className="font-mono text-xs text-[#e2e8f0] leading-relaxed break-words min-w-0">{msg.content}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-start gap-2">
        <span className="text-[#4ade80] font-mono text-xs shrink-0 mt-0.5 select-none">#</span>
        <span className="font-mono text-xs text-[#94a3b8] leading-relaxed whitespace-pre-wrap break-words min-w-0">{msg.content}</span>
      </div>
      {msg.downloadUrl && (
        <a
          href={msg.downloadUrl}
          download={msg.downloadFilename}
          className="flex items-center gap-2 ml-4 mt-1 border border-[#ffffff12] rounded-lg px-3 py-2 hover:border-[#9747FF]/50 hover:bg-[#9747FF]/10 transition-all group w-fit"
        >
          <Download className="w-3.5 h-3.5 text-[#9747FF] shrink-0" />
          <span className="font-mono text-xs text-[#94a3b8] group-hover:text-[#9747FF] transition-colors">
            {msg.downloadFilename} <span className="text-[#4a5568]">· {msg.downloadCount} leads</span>
          </span>
        </a>
      )}
    </div>
  );
}

export default function Central() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [userId, setUserId] = useState<string | null>(null);
  const [savedForms, setSavedForms] = useState<SavedForm[]>([]);
  const [allLeads, setAllLeads] = useState<FormSubmission[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Right panel state — derived from last assistant message
  const [rightKpis, setRightKpis] = useState<KPI[]>([]);
  const [rightGraficos, setRightGraficos] = useState<Grafico[]>([]);

  // @ mention state
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionedForm, setMentionedForm] = useState<SavedForm | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/acesso");
        return;
      }
      setUserId(data.session.user.id);
    });
  }, [navigate]);

  // Load saved forms
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("saved_forms")
      .select("id, form_name")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setSavedForms((data as SavedForm[]) ?? []));
  }, [userId]);

  // Load all leads — fetches in pages of 1000 until done
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const COLS = "id,name,email,phone,faturamento,area_beleza,utm_source,utm_campaign,product,form_id,guru_purchased,guru_product_name,guru_amount,assiny_purchased,assiny_product_name,assiny_amount,ai_analysis,created_at";
    const PAGE = 1000;

    async function fetchAll() {
      let all: FormSubmission[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("form_submissions")
          .select(COLS)
          .eq("owner_id", userId as string)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (cancelled) return;
        if (error || !data || data.length === 0) break;
        all = all.concat(data as FormSubmission[]);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      if (!cancelled) setAllLeads(all);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [userId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  const getLeadsForForm = useCallback(
    (form: SavedForm | null): FormSubmission[] => {
      if (!form) return allLeads;
      return allLeads.filter(
        (l) => l.form_id === form.id || l.product === form.form_name
      );
    },
    [allLeads]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInputValue(val);
      resizeTextarea();

      // Detect @ mention
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf("@");
      if (atIndex !== -1 && !textBeforeCursor.slice(atIndex).includes(" ")) {
        const query = textBeforeCursor.slice(atIndex + 1);
        setMentionQuery(query);
        setMentionActive(true);
      } else {
        setMentionActive(false);
        setMentionQuery("");
      }
    },
    [resizeTextarea]
  );

  const handleMentionSelect = useCallback(
    (form: SavedForm) => {
      setMentionedForm(form);
      setMentionActive(false);

      // Replace the @query in the textarea with @"Form Name"
      const el = textareaRef.current;
      if (!el) return;
      const cursorPos = el.selectionStart;
      const textBeforeCursor = inputValue.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf("@");
      const newVal =
        inputValue.slice(0, atIndex) +
        `@"${form.form_name}" ` +
        inputValue.slice(cursorPos);
      setInputValue(newVal);
      setTimeout(() => {
        resizeTextarea();
        el.focus();
        const newPos = atIndex + form.form_name.length + 4;
        el.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [inputValue, resizeTextarea]
  );

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    // Detect @"Form Name" mentions in text
    let targetForm = mentionedForm;
    const mentionMatch = text.match(/@"([^"]+)"/);
    if (mentionMatch) {
      const found = savedForms.find((f) => f.form_name === mentionMatch[1]);
      if (found) targetForm = found;
    }

    const leads = getLeadsForForm(targetForm);
    const dadosLeads = aggregateLeads(leads, targetForm?.form_name ?? "Todos os leads");

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue("");
    setMentionedForm(null);
    setTimeout(resizeTextarea, 0);

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const historico = newMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(
        "https://wenmrdqdmjidloivjycs.supabase.co/functions/v1/central-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON_KEY}`,
            apikey: ANON_KEY,
          },
          body: JSON.stringify({ pergunta: text, historico, dadosLeads }),
          signal: controller.signal,
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const downloadUrl = createDownloadURL(leads);
      const safeFormName = (targetForm?.form_name ?? "leads")
        .replace(/[^a-zA-Z0-9_\-]/g, "_")
        .toLowerCase();
      const downloadFilename = `${safeFormName}_${new Date().toISOString().slice(0, 10)}.csv`;

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.resposta ?? "Sem resposta.",
        kpis: data.kpis ?? [],
        graficos: data.graficos ?? [],
        downloadUrl,
        downloadFilename,
        downloadCount: leads.length,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setRightKpis(data.kpis ?? []);
      setRightGraficos(data.graficos ?? []);
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Erro ao processar sua pergunta. Tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [inputValue, loading, messages, mentionedForm, savedForms, getLeadsForForm, resizeTextarea]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const hasRightContent = rightKpis.length > 0 || rightGraficos.length > 0;

  return (
    <>
      <AppSidebar activeTab="" onTabChange={() => {}} />
      <div className={`flex flex-col h-screen bg-background ${isMobile ? "pb-20" : "md:pl-[76px]"}`}>

        {/* Page title */}
        <div className="px-4 pt-8 pb-4 shrink-0">
          <h1 className="text-xl font-bold text-foreground">Central</h1>
        </div>

        {/* Two-panel area */}
        <div className="flex flex-1 overflow-hidden border-t border-border">

          {/* LEFT — Terminal / Chat (narrow, dark) */}
          <div className="flex flex-col shrink-0 border-r border-[#ffffff08]" style={{ width: 320, background: "#0a0a0a" }}>

            {/* Terminal header bar */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#ffffff08] shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 font-mono text-[10px] text-[#4a5568] select-none">central ~ leads</span>
            </div>

            {/* Messages / output */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
              {messages.length === 0 && (
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs text-[#4ade80] shrink-0">#</span>
                    <span className="font-mono text-xs text-[#4a5568] leading-relaxed">
                      Bem-vindo à Central. Use @ para mencionar um formulário.
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    {[
                      "Qual o produto mais indicado?",
                      "Taxa de conversão dos leads?",
                      "Principais origens de tráfego?",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setInputValue(s);
                          setTimeout(resizeTextarea, 0);
                          textareaRef.current?.focus();
                        }}
                        className="flex items-center gap-2 text-left group"
                      >
                        <span className="font-mono text-xs text-[#4a5568] group-hover:text-[#9747FF] transition-colors shrink-0">›</span>
                        <span className="font-mono text-xs text-[#4a5568] group-hover:text-[#94a3b8] transition-colors">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <CodeMessage key={i} msg={msg} />
              ))}
              {loading && (
                <div className="flex items-center gap-2 py-1">
                  <span className="font-mono text-xs text-[#4ade80] shrink-0">#</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-full bg-[#4a5568] animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input — terminal prompt */}
            <div className="px-3 pb-3 pt-2 border-t border-[#ffffff08] shrink-0">
              <div className="relative">
                <MentionDropdown
                  forms={savedForms}
                  query={mentionQuery}
                  onSelect={handleMentionSelect}
                  visible={mentionActive}
                />
                <div className="flex items-end gap-2 bg-[#0f0f0f] border border-[#ffffff10] rounded-xl px-3 py-2.5 focus-within:border-[#9747FF]/40 transition-colors">
                  <span className="font-mono text-xs text-[#9747FF] shrink-0 mb-0.5 select-none">›</span>
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="pergunte sobre os leads..."
                    className="flex-1 bg-transparent font-mono text-xs text-[#e2e8f0] placeholder:text-[#2d3748] resize-none outline-none leading-relaxed min-h-[18px]"
                    rows={1}
                    style={{ maxHeight: 160 }}
                  />
                  {loading ? (
                    <button
                      onClick={handleStop}
                      className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center bg-[#1a1a1a] border border-[#ffffff15] hover:border-[#ff5f57]/50 transition-colors"
                      title="Interromper"
                    >
                      <Square className="w-2.5 h-2.5 fill-[#ff5f57] text-[#ff5f57]" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim()}
                      className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center border transition-all"
                      style={{
                        background: inputValue.trim() ? "#9747FF" : "transparent",
                        borderColor: inputValue.trim() ? "#9747FF" : "#ffffff10",
                        opacity: inputValue.trim() ? 1 : 0.4,
                      }}
                      title="Enviar"
                    >
                      <ArrowUp className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
                {mentionedForm && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-1">
                    <span className="font-mono text-[10px] text-[#4a5568]">@</span>
                    <span className="font-mono text-[10px] text-[#9747FF]">{mentionedForm.form_name}</span>
                    <button
                      onClick={() => setMentionedForm(null)}
                      className="font-mono text-[10px] text-[#4a5568] hover:text-[#94a3b8] ml-1"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — Charts & KPIs (wider, light) */}
          <div className="flex-1 overflow-y-auto">
            {hasRightContent ? (
              <div className="px-6 py-6 space-y-6">
                {rightKpis.length > 0 && (
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                    {rightKpis.map((kpi, i) => (
                      <KpiCard key={i} kpi={kpi} />
                    ))}
                  </div>
                )}
                {rightGraficos.map((g, i) => (
                  <ChartBlock key={i} grafico={g} />
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="text-sm text-muted-foreground">Os gráficos e métricas aparecerão aqui</div>
                  <div className="text-xs text-muted-foreground/50">{allLeads.length} leads carregados</div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
