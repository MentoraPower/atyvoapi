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

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-[#9747FF] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        <div className="bg-muted/30 border border-border rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {msg.content}
        </div>
        {msg.downloadUrl && (
          <a
            href={msg.downloadUrl}
            download={msg.downloadFilename}
            className="flex items-center gap-3 bg-muted/20 border border-border rounded-xl px-4 py-3 hover:bg-muted/40 transition-colors group w-fit"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #9747FF 0%, #FF2689 100%)",
              }}
            >
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground group-hover:text-[#9747FF] transition-colors">
                Baixar lista de leads
              </div>
              <div className="text-xs text-muted-foreground">
                {msg.downloadCount} contatos · CSV · Nome, Email, Telefone
              </div>
            </div>
          </a>
        )}
      </div>
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

  // Load all leads
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("form_submissions")
      .select(
        "id,name,email,phone,faturamento,area_beleza,utm_source,utm_campaign,product,form_id,guru_purchased,guru_product_name,guru_amount,assiny_purchased,assiny_product_name,assiny_amount,ai_analysis,created_at"
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAllLeads((data as FormSubmission[]) ?? []));
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
      <div className={`flex h-screen bg-background ${isMobile ? "pb-20" : "md:pl-[60px]"}`}>
      {/* LEFT PANEL — Chat */}
      <div
        className="flex flex-col border-r border-border"
        style={{ width: hasRightContent ? "45%" : "100%", transition: "width 400ms cubic-bezier(0.4,0,0.2,1)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black"
            style={{
              background: "linear-gradient(135deg, #9747FF 0%, #FF2689 100%)",
            }}
          >
            C
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Central de Análise</div>
            <div className="text-xs text-muted-foreground">
              {allLeads.length} leads carregados · mencione @formulário para filtrar
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black"
                style={{
                  background: "linear-gradient(135deg, #9747FF 0%, #FF2689 100%)",
                }}
              >
                C
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">
                  Bem-vindo à Central
                </div>
                <div className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Pergunte sobre seus leads. Use <span className="text-[#9747FF] font-semibold">@</span> para mencionar um formulário específico.
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-2">
                {[
                  "Qual o produto mais indicado para meus leads?",
                  "Qual a taxa de conversão dos meus leads?",
                  "Quais as principais origens de tráfego?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInputValue(s);
                      setTimeout(resizeTextarea, 0);
                      textareaRef.current?.focus();
                    }}
                    className="text-left text-xs text-muted-foreground border border-border rounded-xl px-3 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted/30 border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </span>
                <span className="text-xs text-muted-foreground">Analisando...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 pb-4 pt-2">
          <div className="relative">
            <MentionDropdown
              forms={savedForms}
              query={mentionQuery}
              onSelect={handleMentionSelect}
              visible={mentionActive}
            />
            <div className="flex items-end gap-2 bg-muted/20 border border-border rounded-2xl px-4 py-3 focus-within:border-[#9747FF]/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre seus leads... use @ para mencionar um formulário"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-relaxed min-h-[24px]"
                rows={1}
                style={{ maxHeight: 200 }}
              />
              {loading ? (
                <button
                  onClick={handleStop}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-foreground text-background hover:opacity-80 transition-opacity"
                  title="Interromper"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: inputValue.trim()
                      ? "linear-gradient(135deg, #9747FF 0%, #FF2689 100%)"
                      : undefined,
                    backgroundColor: inputValue.trim() ? undefined : "var(--muted)",
                    opacity: inputValue.trim() ? 1 : 0.4,
                  }}
                  title="Enviar"
                >
                  <ArrowUp className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            {mentionedForm && (
              <div className="mt-1.5 flex items-center gap-1.5 px-1">
                <span className="text-xs text-muted-foreground">Filtrando por:</span>
                <span className="text-xs font-semibold text-[#9747FF] bg-[#9747FF]/10 rounded-full px-2 py-0.5">
                  @{mentionedForm.form_name}
                </span>
                <button
                  onClick={() => setMentionedForm(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Charts & KPIs */}
      {hasRightContent && (
        <div
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
          style={{ width: "55%" }}
        >
          {/* KPI grid */}
          {rightKpis.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {rightKpis.map((kpi, i) => (
                <KpiCard key={i} kpi={kpi} />
              ))}
            </div>
          )}

          {/* Charts */}
          {rightGraficos.map((g, i) => (
            <ChartBlock key={i} grafico={g} />
          ))}
        </div>
      )}
      </div>
    </>
  );
}
