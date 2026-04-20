import { useState, useCallback, useEffect, useRef, memo } from "react";
import { createPortal, flushSync } from "react-dom";
import { toast } from "sonner";
import ReactFlow, {
  Node, Edge, Background, Controls, NodeProps, Handle, Position,
  useNodesState, useEdgesState, BackgroundVariant,
  EdgeProps, BaseEdge, EdgeLabelRenderer, getSmoothStepPath, NodeChange, applyNodeChanges,
  OnConnectStartParams,
} from "reactflow";
import "reactflow/dist/style.css";
import { Check, ToggleLeft, ToggleRight, ArrowLeft, Plus, Clock, X, Mic, GitBranch, Globe, Zap, RefreshCw, Trash2 } from "lucide-react";
import type { FieldsConfig } from "@/lib/formBuilderTypes";
import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────
type Unit = "seconds" | "minutes" | "hours" | "days";

interface ClintFieldMapping {
  formKey:   string; // campo do formulário (ex: name, email, custom_key)
  formLabel: string; // label exibida (ex: "Nome completo")
  clintName: string; // nome do campo na Clint
  fakeValue: string; // valor de teste
}

interface BranchStep {
  id: string;
  type: "message" | "delay" | "audio" | "unnichat_webhook" | "clint_webhook";
  message?: string;
  value?: number;
  unit?: Unit;
  audioUrl?: string;
  unnichatToken?: string;
  unnichatCrmId?: string;
  unnichatColumnId?: string;
  unnichatTagId?: string;
  clintApiUrl?: string;
  clintApiKey?: string;
  clintFieldMappings?: ClintFieldMapping[];
}
interface FlowStep {
  id: string;
  type: "message" | "delay" | "audio" | "purchase_check" | "unnichat_webhook" | "clint_webhook";
  message?: string;
  value?: number;
  unit?: Unit;
  audioUrl?: string;
  // purchase_check only
  purchasedSteps?: BranchStep[];
  notPurchasedSteps?: BranchStep[];
  // unnichat_webhook only
  unnichatToken?: string;
  unnichatCrmId?: string;
  unnichatColumnId?: string;
  unnichatTagId?: string;
  // clint_webhook only
  clintApiUrl?: string;
  clintApiKey?: string;
  clintFieldMappings?: ClintFieldMapping[];
}


// ── WhatsApp icon ────────────────────────────────────────────────────────────
export function WhatsAppIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Custom nodes ─────────────────────────────────────────────────────────────
function StartNode({ data }: NodeProps) {
  return (
    <div className="rounded-2xl shadow-md" style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", minWidth: 210 }}>
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <WhatsAppIcon size={14} className="text-white" />
        </div>
        <div>
          <div className="text-xs font-bold text-white uppercase tracking-wider">Início</div>
          <div className="text-[11px] text-white/70 mt-0.5">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: "#22c55e", border: "2.5px solid var(--background)", boxShadow: "0 0 0 2px #22c55e60", cursor: "crosshair" }} />
    </div>
  );
}

const WhatsAppNode = memo(function WhatsAppNode({ data }: NodeProps) {
  const [msg, setMsg] = useState<string>(data.message ?? "");
  const msgRef = useRef(msg);

  // Sync only when external value changes (load, insertVar from parent)
  useEffect(() => {
    if (data.message !== msgRef.current) {
      setMsg(data.message ?? "");
      msgRef.current = data.message ?? "";
    }
  }, [data.message]);

  const handleChange = (val: string) => {
    setMsg(val);
    msgRef.current = val;
  };

  const handleBlur = () => {
    if (msgRef.current !== data.message) data.onMessageChange(msgRef.current);
  };

  const handleInsertVar = (v: string) => {
    const next = msgRef.current + v;
    setMsg(next);
    msgRef.current = next;
    data.onMessageChange(next);
  };

  return (
    <div className="bg-card rounded-2xl shadow-md overflow-hidden" style={{ minWidth: 300, border: "1.5px solid var(--border)" }}>
      <Handle type="target" position={Position.Top} style={{ background: "#25D366", border: "2px solid white", width: 10, height: 10 }} />
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "#25D366" }}>
            <WhatsAppIcon size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">Mensagem</span>
        </div>
        {data.onRemove && (
          <button onMouseDown={(e) => { e.stopPropagation(); data.onRemove(); }} className="nodrag w-5 h-5 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">
        <textarea
          value={msg}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={"Olá {{nome}}, tudo bem?\n\nUse {{nome}}, {{telefone}}, {{produto}}"}
          className="w-full text-xs text-foreground resize-none outline-none leading-relaxed bg-muted/40 rounded-xl p-3 nodrag"
          rows={4}
          style={{ minHeight: 90, fontFamily: "Space Grotesk, sans-serif" }}
        />
        <div className="flex flex-wrap gap-1">
          {["{{nome}}", "{{telefone}}", "{{produto}}", "{{link}}"].map((v) => (
            <button key={v} onMouseDown={(e) => { e.preventDefault(); handleInsertVar(v); }}
              className="nodrag text-[10px] px-2 py-0.5 rounded-full font-medium cursor-pointer"
              style={{ background: "#25D36615", color: "#16a34a" }}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: "#25D366", border: "2.5px solid var(--background)", boxShadow: "0 0 0 2px #25D36660", cursor: "crosshair" }} />
    </div>
  );
});

function DelayNode({ data }: NodeProps) {
  const unitLabels: Record<string, string> = { seconds: "Segundos", minutes: "Minutos", hours: "Horas", days: "Dias" };
  return (
    <div className="bg-card rounded-2xl shadow-md overflow-hidden" style={{ minWidth: 230, border: "1.5px solid var(--border)" }}>
      <Handle type="target" position={Position.Top} style={{ background: "#94a3b8", border: "2px solid white", width: 10, height: 10 }} />
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground">Aguardar</span>
        </div>
        {data.onRemove && (
          <button onMouseDown={(e) => { e.stopPropagation(); data.onRemove(); }} className="nodrag w-5 h-5 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="px-4 py-3 flex items-center gap-2">
        <input
          type="number"
          value={data.value ?? 1}
          min={1}
          onChange={(e) => data.onValueChange(Math.max(1, Number(e.target.value)))}
          className="nodrag w-16 h-8 rounded-xl border border-border bg-background px-2 text-sm text-center outline-none focus:border-[#25D366] transition-colors"
        />
        <select
          value={data.unit ?? "minutes"}
          onChange={(e) => data.onUnitChange(e.target.value)}
          className="nodrag flex-1 h-8 rounded-xl border border-border bg-background px-2 text-sm outline-none focus:border-[#25D366] transition-colors"
        >
          {Object.entries(unitLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: "#94a3b8", border: "2.5px solid var(--background)", boxShadow: "0 0 0 2px #94a3b860", cursor: "crosshair" }} />
    </div>
  );
}

type AddPopup = { afterId: string; afterHandle?: string | null; x: number; y: number };

// ── FlowEdge: linha colorida + bolinha "•" no meio ────────────────────────────
function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style }: EdgeProps) {
  const color = (style as React.CSSProperties | undefined)?.stroke as string ?? "#25D366";
  const [path, mx, my] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: color, strokeWidth: 2 }} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute pointer-events-none"
          style={{ transform: `translate(-50%,-50%) translate(${mx}px,${my}px)` }}
        >
          <div className="w-3 h-3 rounded-full" style={{ background: color, border: "2.5px solid var(--background)", boxShadow: `0 0 0 2px ${color}40` }} />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// ── AudioNode ─────────────────────────────────────────────────────────────────
function AudioNode({ data }: NodeProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "mp3";
    const path = `audio/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("whatsapp-audio").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("whatsapp-audio").getPublicUrl(path);
      data.onAudioChange(urlData.publicUrl);
    }
    setUploading(false);
  };

  return (
    <div className="bg-card rounded-2xl shadow-md overflow-hidden" style={{ minWidth: 260, border: "1.5px solid var(--border)" }}>
      <Handle type="target" position={Position.Top} style={{ background: "#7c3aed", border: "2px solid white", width: 10, height: 10 }} />
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "#7c3aed" }}>
            <Mic size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">Áudio</span>
        </div>
        {data.onRemove && (
          <button onMouseDown={(e) => { e.stopPropagation(); data.onRemove(); }} className="nodrag w-5 h-5 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="px-4 py-3 nodrag">
        {data.audioUrl ? (
          <div className="flex flex-col gap-2">
            <audio controls src={data.audioUrl} className="w-full nodrag" style={{ height: 36, borderRadius: 8 }} />
            <button
              onMouseDown={(e) => { e.stopPropagation(); data.onAudioChange(""); }}
              className="nodrag text-xs text-destructive hover:underline text-left"
            >
              Remover áudio
            </button>
          </div>
        ) : (
          <div
            onMouseDown={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="nodrag flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl cursor-pointer hover:bg-muted/30 transition-colors"
            style={{ border: "1.5px dashed var(--border)" }}
          >
            {uploading ? (
              <div className="w-4 h-4 rounded-full border-2 border-[#7c3aed] border-t-transparent animate-spin" />
            ) : (
              <>
                <Mic size={18} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Clique para enviar áudio</span>
                <span className="text-[10px] text-muted-foreground/60">MP3 · OGG · AAC</span>
              </>
            )}
          </div>
        )}
        <input ref={inputRef} type="file" accept="audio/*" className="hidden nodrag"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: "#7c3aed", border: "2.5px solid var(--background)", boxShadow: "0 0 0 2px #7c3aed60", cursor: "crosshair" }} />
    </div>
  );
}

// ── UnnichatWebhookNode ───────────────────────────────────────────────────────
const UNNICHAT_COLOR = "#6366f1";

function UnnichatWebhookNode({ data }: NodeProps) {
  // Estado local apenas para exibição fluida; sincroniza com flowSteps em toda mudança via onChange
  const [token,    setToken]    = useState<string>(data.token    ?? "");
  const [crmId,    setCrmId]    = useState<string>(data.crmId    ?? "");
  const [columnId, setColumnId] = useState<string>(data.columnId ?? "");
  const [tagId,    setTagId]    = useState<string>(data.tagId    ?? "");
  const [testing,  setTesting]  = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [backfilling,     setBackfilling]     = useState(false);
  const [backfillProgress, setBackfillProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [backfillResult,   setBackfillResult]   = useState<{ ok: boolean; msg: string } | null>(null);
  const backfillCancelRef = useRef(false);

  // Sync unidirecional: DB → estado local (apenas quando o dado externo muda, ex: carga inicial)
  // Não sincroniza de volta para evitar loop com rebuildFlow
  const prevToken    = useRef(data.token);
  const prevCrmId    = useRef(data.crmId);
  const prevColumnId = useRef(data.columnId);
  const prevTagId    = useRef(data.tagId);

  useEffect(() => {
    if (data.token    !== prevToken.current)    { prevToken.current    = data.token;    setToken(data.token       ?? ""); }
    if (data.crmId    !== prevCrmId.current)    { prevCrmId.current    = data.crmId;    setCrmId(data.crmId       ?? ""); }
    if (data.columnId !== prevColumnId.current) { prevColumnId.current = data.columnId; setColumnId(data.columnId ?? ""); }
    if (data.tagId    !== prevTagId.current)    { prevTagId.current    = data.tagId;    setTagId(data.tagId       ?? ""); }
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data: result, error } = await supabase.functions.invoke("unnichat-webhook", {
        body: {
          token,
          name:     "Teste Exemplo",
          email:    "teste@exemple.com.br",
          phone:    "5527998474152",
          crmId,
          columnId,
          tagId,
        },
      });
      if (error) {
        setTestResult({ ok: false, msg: `Erro na função: ${error.message ?? JSON.stringify(error)}` });
      } else if (!result?.success) {
        const detail = result?.details ? ` — ${JSON.stringify(result.details)}` : "";
        const raw    = result?.raw     ? ` | raw: ${JSON.stringify(result.raw)}`  : "";
        setTestResult({ ok: false, msg: `${result?.error ?? "Erro desconhecido"}${detail}${raw}` });
      } else {
        const base = result?.contactId ? `Contato criado (ID: ${result.contactId})` : "Enviado com sucesso!";
        const crmWarn = result?.crmWarning ? `\n⚠ ${result.crmWarning}` : "";
        const tagWarn = result?.tagWarning ? `\n⚠ ${result.tagWarning}` : "";
        setTestResult({ ok: true, msg: base + crmWarn + tagWarn });
      }
    } catch (err: unknown) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  // Normaliza telefone igual ao trigger notify_whatsapp_on_submission no banco
  const normalizePhone = (raw: string): string | null => {
    const digits = (raw ?? "").replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    if (digits.length === 12 || digits.length === 13) return digits;
    return null;
  };

  const handleBackfill = async () => {
    if (!data.formId) { setBackfillResult({ ok: false, msg: "formId não disponível." }); return; }
    if (!token.trim()) { setBackfillResult({ ok: false, msg: "Configure o token antes de disparar." }); return; }
    if (!window.confirm("Disparar TODOS os leads já cadastrados para o Unnichat, um por um? Pode levar alguns minutos.")) return;

    setBackfilling(true);
    setBackfillResult(null);
    setBackfillProgress({ done: 0, total: 0, errors: 0 });
    backfillCancelRef.current = false;

    try {
      const { data: leads, error } = await supabase
        .from("form_submissions")
        .select("id, name, email, phone")
        .eq("form_id", data.formId)
        .order("created_at", { ascending: true });

      if (error) {
        setBackfillResult({ ok: false, msg: `Erro ao buscar leads: ${error.message}` });
        return;
      }

      const total = leads?.length ?? 0;
      setBackfillProgress({ done: 0, total, errors: 0 });

      if (total === 0) {
        setBackfillResult({ ok: true, msg: "Nenhum lead encontrado para esse formulário." });
        return;
      }

      let done = 0;
      let errors = 0;

      for (const lead of leads ?? []) {
        if (backfillCancelRef.current) break;
        const phone = normalizePhone(lead.phone ?? "");
        if (!phone) {
          done++; errors++;
          setBackfillProgress({ done, total, errors });
          continue;
        }
        try {
          const { data: r, error: fnErr } = await supabase.functions.invoke("unnichat-webhook", {
            body: { token, name: lead.name ?? "", email: lead.email ?? "", phone, crmId, columnId, tagId },
          });
          if (fnErr || !r?.success) errors++;
        } catch {
          errors++;
        }
        done++;
        setBackfillProgress({ done, total, errors });
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      const cancelled = backfillCancelRef.current;
      setBackfillResult({
        ok: errors === 0 && !cancelled,
        msg: `${done}/${total} disparados${errors ? ` · ${errors} erro(s)` : ""}${cancelled ? " · cancelado" : ""}`,
      });
    } finally {
      setBackfilling(false);
    }
  };

  const Field = ({
    label, value, onChange, onSave, placeholder,
  }: { label: string; value: string; onChange: (v: string) => void; onSave: (v: string) => void; placeholder?: string }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); onSave(e.target.value); }}
        onBlur={(e) => onSave(e.target.value)}
        placeholder={placeholder}
        className="nodrag w-full h-8 rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-[#6366f1] transition-colors"
        style={{ fontFamily: "Space Grotesk, sans-serif" }}
      />
    </div>
  );

  return (
    <div className="bg-card rounded-2xl shadow-md overflow-hidden" style={{ minWidth: 300, border: "1.5px solid var(--border)" }}>
      <Handle type="target" position={Position.Top} style={{ background: UNNICHAT_COLOR, border: "2px solid white", width: 10, height: 10 }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: UNNICHAT_COLOR }}>
            <Globe size={12} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">Unnichat</span>
            <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: "#ede9fe", color: UNNICHAT_COLOR }}>Webhook</span>
          </div>
        </div>
        {data.onRemove && (
          <button onMouseDown={(e) => { e.stopPropagation(); data.onRemove(); }} className="nodrag w-5 h-5 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Fields */}
      <div className="px-4 py-3 nodrag flex flex-col gap-2.5">
        <Field label="Token de autorização" value={token} onChange={setToken} onSave={(v) => { data.onTokenChange?.(v); }} placeholder="Bearer eyJh..." />

        <div className="h-px bg-border" />
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: UNNICHAT_COLOR }}>CRM</div>
        <Field label="CRM ID"    value={crmId}    onChange={setCrmId}    onSave={(v) => { data.onCrmIdChange?.(v); }}    placeholder="UhPBrPVKA0G3eGyJ8OQl" />
        <Field label="Column ID" value={columnId} onChange={setColumnId} onSave={(v) => { data.onColumnIdChange?.(v); }} placeholder="t8Dh4UNhpTNr5uGMP7zR" />

        <div className="h-px bg-border" />
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: UNNICHAT_COLOR }}>Tag</div>
        <Field label="Tag ID" value={tagId} onChange={setTagId} onSave={(v) => { data.onTagIdChange?.(v); }} placeholder="019c8a60-2961-76bf-9ec9-05fcda43827f" />

        {/* Botão de teste */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleTest}
          disabled={testing}
          className="nodrag mt-1 w-full h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
          style={{ background: UNNICHAT_COLOR, color: "#fff" }}
        >
          {testing && <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {testing ? "Enviando..." : "Testar (Teste Exemplo / 5527998474152)"}
        </button>

        {testResult && (
          <div
            className="nodrag text-[11px] rounded-xl px-3 py-2 leading-relaxed break-all"
            style={{ background: testResult.ok ? "#f0fdf4" : "#fef2f2", color: testResult.ok ? "#15803d" : "#dc2626" }}
          >
            {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
          </div>
        )}

        <div className="h-px bg-border mt-0.5" />
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: UNNICHAT_COLOR }}>Backfill</div>
        <div className="text-[10px] text-muted-foreground leading-relaxed -mt-1">
          Dispara todos os leads já cadastrados neste formulário para o Unnichat, um por um. Não interfere no envio automático de novos leads.
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleBackfill}
          disabled={backfilling || testing}
          className="nodrag w-full h-8 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
          style={{ background: "transparent", color: UNNICHAT_COLOR, border: `1.5px solid ${UNNICHAT_COLOR}` }}
        >
          {backfilling ? (
            <>
              <div className="w-3 h-3 rounded-full border-2 border-[#6366f1] border-t-transparent animate-spin" />
              {backfillProgress.done}/{backfillProgress.total}{backfillProgress.errors ? ` · ${backfillProgress.errors} erros` : ""}
            </>
          ) : (
            <>
              <RefreshCw size={11} />
              Disparar leads já cadastrados
            </>
          )}
        </button>
        {backfilling && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { backfillCancelRef.current = true; }}
            className="nodrag text-[10px] text-muted-foreground hover:text-destructive underline underline-offset-2 text-center"
          >
            Cancelar
          </button>
        )}
        {backfillResult && (
          <div
            className="nodrag text-[11px] rounded-xl px-3 py-2 leading-relaxed break-all"
            style={{ background: backfillResult.ok ? "#f0fdf4" : "#fef2f2", color: backfillResult.ok ? "#15803d" : "#dc2626" }}
          >
            {backfillResult.ok ? "✓ " : "✗ "}{backfillResult.msg}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: UNNICHAT_COLOR, border: "2.5px solid var(--background)", boxShadow: `0 0 0 2px ${UNNICHAT_COLOR}60`, cursor: "crosshair" }} />
    </div>
  );
}

// ── ClintWebhookNode ──────────────────────────────────────────────────────────
const CLINT_COLOR = "#0ea5e9";

const CLINT_STANDARD_KEYS = new Set(["name", "email", "phone", "faturamento", "area_beleza"]);
const CLINT_INPUT_TYPES   = new Set(["text_short", "text_long", "email", "tel", "instagram", "currency", "radio", "select", "card"]);

const STANDARD_FIELDS: ClintFieldMapping[] = [
  { formKey: "name",        formLabel: "Nome",         clintName: "name",        fakeValue: "Maria Silva" },
  { formKey: "email",       formLabel: "E-mail",       clintName: "email",       fakeValue: "maria@exemplo.com" },
  { formKey: "phone",       formLabel: "WhatsApp",     clintName: "phone",       fakeValue: "+5511999998888" },
  { formKey: "faturamento", formLabel: "Faturamento",  clintName: "faturamento", fakeValue: "R$ 5.000 - R$ 10.000" },
  { formKey: "area_beleza", formLabel: "Área da Beleza", clintName: "area_beleza", fakeValue: "Cabelo" },
];

function fakeValueFor(key: string, type: string, opts?: { label?: string }[]): string {
  if (key === "name")        return "Maria Silva";
  if (key === "email")       return "maria@exemplo.com";
  if (key === "phone")       return "+5511999998888";
  if (key === "faturamento") return "R$ 5.000 - R$ 10.000";
  if (key === "area_beleza") return "Cabelo";
  if (type === "email")      return "maria@exemplo.com";
  if (type === "tel")        return "+5511999998888";
  if (type === "instagram")  return "@maria.silva";
  if (type === "currency")   return "R$ 1.500,00";
  if ((type === "radio" || type === "card" || type === "select") && opts?.[0]?.label) return opts[0].label;
  return "Resposta de teste";
}

function deriveLabelForField(
  field: { key: string; type: string; label?: string; placeholder?: string; options?: { label?: string }[] },
  stepTitle: string,
): string {
  const isSingleInput = ["text_short", "text_long", "email", "tel", "instagram", "currency"].includes(field.type);
  const isSelection   = ["radio", "card", "select"].includes(field.type);
  let raw = "";
  if (isSingleInput) {
    raw = field.placeholder || field.label || field.key;
  } else if (isSelection) {
    raw = stepTitle || field.label || field.key;
  } else {
    raw = field.label || field.key;
  }
  // Trunca em 4 palavras (mesma lógica do Dashboard)
  const words = raw.trim().split(/\s+/);
  return words.length > 4 ? words.slice(0, 4).join(" ") + "…" : raw;
}

function ClintWebhookNode({ data }: NodeProps) {
  const [apiUrl,     setApiUrl]     = useState<string>(data.clintApiUrl ?? "");
  const [apiKey,     setApiKey]     = useState<string>(data.clintApiKey ?? "");
  const [mappings,   setMappings]   = useState<ClintFieldMapping[]>(data.clintFieldMappings ?? []);
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pulling,    setPulling]    = useState(false);

  // Ref para o container scrollável — listener nativo capture impede React Flow de capturar o wheel
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => {
      const atTop    = el.scrollTop === 0 && e.deltaY < 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight && e.deltaY > 0;
      if (!atTop && !atBottom) e.stopPropagation();
    };
    el.addEventListener("wheel", stop, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", stop, { capture: true });
  }, []);

  // Sync unidirecional: DB → estado local
  const prevApiUrl   = useRef(data.clintApiUrl);
  const prevApiKey   = useRef(data.clintApiKey);
  const prevMappings = useRef(data.clintFieldMappings);

  useEffect(() => {
    if (data.clintApiUrl        !== prevApiUrl.current)   { prevApiUrl.current   = data.clintApiUrl;        setApiUrl(data.clintApiUrl        ?? ""); }
    if (data.clintApiKey        !== prevApiKey.current)   { prevApiKey.current   = data.clintApiKey;        setApiKey(data.clintApiKey        ?? ""); }
    if (data.clintFieldMappings !== prevMappings.current) { prevMappings.current = data.clintFieldMappings; setMappings(data.clintFieldMappings ?? []); }
  });

  const save = (url: string, key: string, maps: ClintFieldMapping[]) => {
    data.onApiUrlChange?.(url);
    data.onApiKeyChange?.(key);
    data.onFieldMappingsChange?.(maps);
  };

  // Busca diretamente do Supabase para não depender de stale closure do parent
  const handlePull = async () => {
    setPulling(true);
    setTestResult(null);
    try {
      const { data: formData } = await supabase
        .from("saved_forms")
        .select("fields_config, hide_faturamento, hide_area")
        .eq("id", data.formId)
        .maybeSingle();

      const cfg = formData?.fields_config as FieldsConfig | null;
      const next: ClintFieldMapping[] = [];

      // Campos padrão sempre presentes
      next.push({ formKey: "name",  formLabel: "Nome",    clintName: "name",  fakeValue: "Maria Silva" });
      next.push({ formKey: "email", formLabel: "E-mail",  clintName: "email", fakeValue: "maria@exemplo.com" });
      next.push({ formKey: "phone", formLabel: "WhatsApp", clintName: "phone", fakeValue: "+5511999998888" });
      if (!formData?.hide_faturamento) next.push({ formKey: "faturamento", formLabel: "Faturamento",    clintName: "faturamento", fakeValue: "R$ 5.000 - R$ 10.000" });
      if (!formData?.hide_area)        next.push({ formKey: "area_beleza", formLabel: "Área da Beleza", clintName: "area_beleza", fakeValue: "Cabelo" });

      // Campos customizados do formulário
      if (cfg?.steps) {
        const seen = new Set(CLINT_STANDARD_KEYS);
        cfg.steps.forEach(step => {
          const stepTitle = (step.title || step.titleHTML?.replace(/<[^>]+>/g, "") || "").trim();
          step.fields.forEach(field => {
            if (!CLINT_INPUT_TYPES.has(field.type)) return;
            if (seen.has(field.key)) return;
            seen.add(field.key);
            const formLabel = deriveLabelForField(field, stepTitle);
            next.push({
              formKey:   field.key,
              formLabel,
              clintName: field.key,
              fakeValue: fakeValueFor(field.key, field.type, field.options),
            });
          });
        });
      }

      setMappings(next);
      save(apiUrl, apiKey, next);
    } catch {
      setTestResult({ ok: false, msg: "Erro ao buscar campos do formulário." });
    } finally {
      setPulling(false);
    }
  };

  const updateMapping = (i: number, patch: Partial<ClintFieldMapping>) => {
    const next = mappings.map((m, idx) => idx === i ? { ...m, ...patch } : m);
    setMappings(next);
    save(apiUrl, apiKey, next);
  };

  const removeMapping = (i: number) => {
    const next = mappings.filter((_, idx) => idx !== i);
    setMappings(next);
    save(apiUrl, apiKey, next);
  };

  const handleTest = async () => {
    if (!apiUrl.trim()) { setTestResult({ ok: false, msg: "Configure a URL da API antes de testar." }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const payload: Record<string, string> = {};
      mappings.forEach(m => { if (m.clintName.trim()) payload[m.clintName.trim()] = m.fakeValue; });

      const { data: result, error } = await supabase.functions.invoke("send-to-clint", {
        body: { apiUrl: apiUrl.trim(), apiKey: apiKey.trim() || undefined, payload },
      });

      if (error) {
        // Tenta extrair o corpo do FunctionsHttpError para mostrar mensagem real
        let msg = error.message ?? JSON.stringify(error);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ctx = (error as any).context;
          if (ctx) {
            const txt = typeof ctx.text === "function" ? await ctx.text() : null;
            if (txt) {
              const parsed = JSON.parse(txt);
              msg = parsed?.error ?? parsed?.message ?? txt;
            }
          }
        } catch { /* usa msg original */ }
        setTestResult({ ok: false, msg: `Erro: ${msg}` });
      } else if (!result?.success) {
        const detail = result?.details ? `\n${JSON.stringify(result.details, null, 2)}` : "";
        setTestResult({ ok: false, msg: `${result?.error ?? "Erro desconhecido"}${detail}` });
      } else {
        setTestResult({ ok: true, msg: `Enviado com sucesso! (status ${result.status ?? 200}) ✓` });
      }
    } catch (err: unknown) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-md overflow-hidden" style={{ minWidth: 360, border: `1.5px solid ${CLINT_COLOR}` }}>
      <Handle type="target" position={Position.Top} style={{ background: CLINT_COLOR, border: "2px solid white", width: 10, height: 10 }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border" style={{ background: `${CLINT_COLOR}10` }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: CLINT_COLOR }}>
            <Zap size={12} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">Clint</span>
            <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: `${CLINT_COLOR}20`, color: CLINT_COLOR }}>CRM</span>
          </div>
        </div>
        {data.onRemove && (
          <button onMouseDown={(e) => { e.stopPropagation(); data.onRemove(); }}
            className="nodrag w-5 h-5 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="px-4 py-3 nodrag flex flex-col gap-2.5">

        {/* API URL */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">URL da API Clint</label>
          <input
            type="text" value={apiUrl}
            onChange={(e) => { setApiUrl(e.target.value); save(e.target.value, apiKey, mappings); }}
            placeholder="https://api.clint.digital/v1/contacts"
            className="nodrag w-full h-8 rounded-xl border border-border bg-background px-3 text-xs outline-none transition-colors"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = CLINT_COLOR)}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "")}
          />
        </div>

        {/* API Key */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Chave de API <span className="normal-case font-normal opacity-60">(opcional)</span>
          </label>
          <input
            type="password" value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); save(apiUrl, e.target.value, mappings); }}
            placeholder="sua-chave-de-api"
            className="nodrag w-full h-8 rounded-xl border border-border bg-background px-3 text-xs outline-none transition-colors"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = CLINT_COLOR)}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "")}
          />
        </div>

        {/* Campos header */}
        <div className="h-px bg-border mt-0.5" />
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: CLINT_COLOR }}>Campos</span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handlePull}
            disabled={pulling}
            className="nodrag flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-60"
            style={{ background: `${CLINT_COLOR}15`, color: CLINT_COLOR }}
          >
            <RefreshCw size={11} className={pulling ? "animate-spin" : ""} />
            {pulling ? "Buscando..." : "Puxar campos"}
          </button>
        </div>

        {/* Empty state */}
        {mappings.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl"
            style={{ background: `${CLINT_COLOR}08`, border: `1px dashed ${CLINT_COLOR}40` }}>
            <Zap size={16} style={{ color: `${CLINT_COLOR}60` }} />
            <span className="text-[11px] text-muted-foreground text-center">
              Clique em "Puxar campos" para<br />carregar os campos do formulário
            </span>
          </div>
        )}

        {/* Mapping rows */}
        {mappings.length > 0 && (
          <>
            {/* Col headers */}
            <div className="grid gap-1.5 px-0.5" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 22px" }}>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Campo do formulário</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Nome na Clint · Valor teste</span>
              <span />
            </div>

            <div
              ref={scrollRef}
              className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5 nodrag"
            >
              {mappings.map((m, i) => (
                <div key={i} className="grid gap-1.5 items-start"
                  style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 22px" }}>

                  {/* Campo do form — badge read-only */}
                  <div className="flex items-center h-7 px-2.5 rounded-lg text-[11px] font-medium truncate"
                    style={{ background: `${CLINT_COLOR}12`, color: CLINT_COLOR, border: `1px solid ${CLINT_COLOR}25` }}>
                    {m.formLabel || m.formKey || "—"}
                  </div>

                  {/* Nome + valor empilhados */}
                  <div className="flex flex-col gap-1">
                    <input
                      value={m.clintName}
                      onChange={(e) => updateMapping(i, { clintName: e.target.value })}
                      placeholder="nome_na_clint"
                      className="nodrag w-full h-7 rounded-lg border border-border bg-background px-2 text-[11px] outline-none focus:border-sky-400 transition-colors"
                      style={{ fontFamily: "Space Grotesk, sans-serif" }}
                    />
                    <input
                      value={m.fakeValue}
                      onChange={(e) => updateMapping(i, { fakeValue: e.target.value })}
                      placeholder="Valor de teste"
                      className="nodrag w-full h-7 rounded-lg border border-border bg-muted/40 px-2 text-[11px] text-muted-foreground outline-none focus:border-sky-400 transition-colors"
                      style={{ fontFamily: "Space Grotesk, sans-serif" }}
                    />
                  </div>

                  {/* Remover */}
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => removeMapping(i)}
                    className="nodrag mt-0.5 w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar campo manual */}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                const next = [...mappings, { formKey: "", formLabel: "", clintName: "", fakeValue: "" }];
                setMappings(next);
                save(apiUrl, apiKey, next);
              }}
              className="nodrag w-full h-7 rounded-xl border border-dashed border-border text-[11px] text-muted-foreground hover:border-sky-400 hover:text-sky-600 transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={11} /> Adicionar campo manual
            </button>
          </>
        )}

        {/* Teste */}
        <div className="h-px bg-border mt-0.5" />
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleTest}
          disabled={testing || mappings.length === 0}
          className="nodrag w-full h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          style={{ background: CLINT_COLOR, color: "#fff" }}
        >
          {testing
            ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Enviando...</>
            : <><Zap size={13} /> Testar envio com dados fake</>
          }
        </button>

        {testResult && (
          <div className="nodrag text-[11px] rounded-xl px-3 py-2.5 leading-relaxed break-all"
            style={{ background: testResult.ok ? "#f0fdf4" : "#fef2f2", color: testResult.ok ? "#15803d" : "#dc2626" }}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: CLINT_COLOR, border: "2.5px solid var(--background)", boxShadow: `0 0 0 2px ${CLINT_COLOR}60`, cursor: "crosshair" }} />
    </div>
  );
}

// ── PurchaseCheckNode ─────────────────────────────────────────────────────────
function PurchaseCheckNode({ data }: NodeProps) {
  const unitLabels: Record<string, string> = { seconds: "seg", minutes: "min", hours: "hrs", days: "dias" };
  return (
    <div style={{ minWidth: 320, background: "#fff", borderRadius: 18, border: "1px solid #e4e4e7", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
      <Handle type="target" position={Position.Top} style={{ background: "#d4d4d8", border: "2px solid #fff", width: 8, height: 8 }} />

      {/* Top bar with label + remove */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 0" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#a1a1aa", textTransform: "uppercase" }}>Verificação de Compra</span>
        {data.onRemove && (
          <button onMouseDown={(e) => { e.stopPropagation(); data.onRemove(); }}
            className="nodrag"
            style={{ width: 20, height: 20, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#a1a1aa" }}>
            <X size={11} />
          </button>
        )}
      </div>

      {/* Wait time — clean pill row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px 14px" }}>
        <span style={{ fontSize: 13, color: "#3f3f46" }}>Verificar após</span>
        <input type="number" value={data.value ?? 3} min={1}
          onChange={(e) => data.onValueChange(Math.max(1, Number(e.target.value)))}
          className="nodrag"
          style={{ width: 44, height: 30, borderRadius: 8, border: "1px solid #e4e4e7", background: "#fafafa", textAlign: "center", fontSize: 13, color: "#18181b", outline: "none" }} />
        <select value={data.unit ?? "minutes"} onChange={(e) => data.onUnitChange(e.target.value)}
          className="nodrag"
          style={{ height: 30, borderRadius: 8, border: "1px solid #e4e4e7", background: "#fafafa", fontSize: 12, color: "#52525b", outline: "none", padding: "0 8px" }}>
          {Object.entries(unitLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ fontSize: 13, color: "#3f3f46" }}>sem compra</span>
      </div>

      {/* Branch exits */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #f4f4f5" }}>
        {/* Comprou */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 12px 20px", position: "relative" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>Comprou</span>
        </div>
        {/* Não comprou */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 12px 20px", borderLeft: "1px solid #f4f4f5", position: "relative" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#dc2626" }}>Não comprou</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} id="purchased"
        style={{ left: "25%", width: 10, height: 10, background: "#22c55e", border: "2px solid #fff", boxShadow: "0 0 0 2px #22c55e50", cursor: "crosshair" }} />
      <Handle type="source" position={Position.Bottom} id="not_purchased"
        style={{ left: "75%", width: 10, height: 10, background: "#ef4444", border: "2px solid #fff", boxShadow: "0 0 0 2px #ef444450", cursor: "crosshair" }} />
    </div>
  );
}

// ── GhostNode: âncora invisível para a aresta fantasma ───────────────────────
function GhostNode() {
  return (
    <div style={{ width: 1, height: 1, opacity: 0, pointerEvents: "none" }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}

const nodeTypes = { startNode: StartNode, whatsappNode: WhatsAppNode, delayNode: DelayNode, audioNode: AudioNode, purchaseCheckNode: PurchaseCheckNode, unnichatWebhookNode: UnnichatWebhookNode, clintWebhookNode: ClintWebhookNode, ghostNode: GhostNode };
const edgeTypes = { flowEdge: FlowEdge };

// ── Layout helpers ────────────────────────────────────────────────────────────
const NODE_X = 80;
const START_Y = 40;
const STEP_GAP = 60;
const NODE_HEIGHTS: Record<string, number> = { startNode: 72, whatsappNode: 210, delayNode: 100, audioNode: 150, purchaseCheckNode: 145, unnichatWebhookNode: 610, clintWebhookNode: 520 };
const BRANCH_OFFSET_X = 420; // horizontal distance from center to each branch column
const NODE_CENTER_X = NODE_X + 150; // centro horizontal dos nodes (minWidth 300)

// ── Main component ────────────────────────────────────────────────────────────
interface Props { formId: string; formName: string; ownerId: string; onClose: () => void; }

export function WhatsAppFlow({ formId, formName, ownerId, onClose }: Props) {
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  // Ref sempre atualizado para evitar stale closure no handleSave
  const flowStepsRef = useRef<FlowStep[]>([]);
  flowStepsRef.current = flowSteps;
  const [enabled, setEnabled]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [addPopup, setAddPopup]   = useState<AddPopup | null>(null);
  const [instanceId,    setInstanceId]    = useState("");
  const [instanceToken, setInstanceToken] = useState("");
  const [clientToken,   setClientToken]   = useState("");
  const [fieldsConfig,  setFieldsConfig]  = useState<FieldsConfig | null>(null);
  const nodePositionsRef  = useRef<Record<string, { x: number; y: number }>>({});
  const connectSourceRef  = useRef<string | null>(null);
  const connectHandleRef  = useRef<string | null>(null);
  const ghostPositionRef  = useRef<{ x: number; y: number } | null>(null);
  const reactFlowWrapRef  = useRef<HTMLDivElement>(null);
  const viewportRef       = useRef({ x: 0, y: 0, zoom: 1 });
  const popupOpenRef      = useRef(false);

  // Carrega fields_config do formulário para o bloco Clint
  useEffect(() => {
    supabase.from("saved_forms").select("fields_config").eq("id", formId).maybeSingle()
      .then(({ data }) => { if (data?.fields_config) setFieldsConfig(data.fields_config as FieldsConfig); });
  }, [formId]);

  // Load from Supabase
  useEffect(() => {
    supabase.from("form_automations").select("enabled, flow_steps, message_template, node_positions, instance_id, instance_token, client_token")
      .eq("form_id", formId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEnabled(data.enabled ?? false);
          setInstanceId(data.instance_id ?? "");
          setInstanceToken(data.instance_token ?? "");
          setClientToken(data.client_token ?? "");
          if (data.node_positions && typeof data.node_positions === "object") {
            nodePositionsRef.current = data.node_positions as Record<string, { x: number; y: number }>;
          }
          const steps = data.flow_steps as FlowStep[] | null;
          if (steps && steps.length > 0) {
            setFlowSteps(steps);
          } else {
            setFlowSteps([]);
          }
        } else {
          setFlowSteps([]);
        }
        setLoading(false);
      });
  }, [formId]);

  // ── Build React Flow nodes from flowSteps ──────────────────────────────────
  const buildAll = useCallback((steps: FlowStep[]) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const saved = nodePositionsRef.current;
    const pos = (id: string, def: { x: number; y: number }) => saved[id] ?? def;

    let y = START_Y;
    nodes.push({ id: "start", type: "startNode", position: pos("start", { x: NODE_X, y }), draggable: true, data: { label: `Lead cadastrado via ${formName}` } });
    y += NODE_HEIGHTS.startNode + STEP_GAP;

    let prevId = "start";
    steps.forEach((step) => {
      if (step.type === "purchase_check") {
        const h = NODE_HEIGHTS.purchaseCheckNode;
        edges.push({ id: `e-${prevId}-${step.id}`, source: prevId, target: step.id, type: prevId === "start" ? "smoothstep" : "flowEdge", style: { stroke: "#25D366", strokeWidth: 2 } });
        nodes.push({ id: step.id, type: "purchaseCheckNode", position: pos(step.id, { x: NODE_X, y }), draggable: true, data: { value: step.value ?? 3, unit: step.unit ?? "minutes", onValueChange: () => {}, onUnitChange: () => {}, onRemove: () => {} } });
        y += h + STEP_GAP;

        // Build purchased branch nodes (left column)
        let py = y;
        let prevPId = step.id;
        (step.purchasedSteps ?? []).forEach((bs) => {
          const nt = bs.type === "delay" ? "delayNode" : bs.type === "audio" ? "audioNode" : bs.type === "unnichat_webhook" ? "unnichatWebhookNode" : bs.type === "clint_webhook" ? "clintWebhookNode" : "whatsappNode";
          edges.push({ id: `e-${prevPId}-${bs.id}`, source: prevPId, target: bs.id, sourceHandle: prevPId === step.id ? "purchased" : undefined, type: "flowEdge", style: { stroke: "#22c55e", strokeWidth: 2 } });
          nodes.push({ id: bs.id, type: nt, position: pos(bs.id, { x: NODE_X - BRANCH_OFFSET_X, y: py }), draggable: true, data: { formId, message: bs.message ?? "", value: bs.value ?? 1, unit: bs.unit ?? "minutes", audioUrl: bs.audioUrl ?? "", token: bs.unnichatToken ?? "", crmId: bs.unnichatCrmId ?? "", columnId: bs.unnichatColumnId ?? "", tagId: bs.unnichatTagId ?? "", clintApiUrl: bs.clintApiUrl ?? "", clintApiKey: bs.clintApiKey ?? "", clintFieldMappings: bs.clintFieldMappings ?? [], onMessageChange: () => {}, onInsertVar: () => {}, onValueChange: () => {}, onUnitChange: () => {}, onAudioChange: () => {}, onTokenChange: () => {}, onCrmIdChange: () => {}, onColumnIdChange: () => {}, onTagIdChange: () => {}, onApiUrlChange: () => {}, onApiKeyChange: () => {}, onFieldMappingsChange: () => {}, onRemove: () => {} } });
          py += (NODE_HEIGHTS[nt] ?? 150) + STEP_GAP;
          prevPId = bs.id;
        });

        // Build not-purchased branch nodes (right column)
        let ny = y;
        let prevNId = step.id;
        (step.notPurchasedSteps ?? []).forEach((bs) => {
          const nt = bs.type === "delay" ? "delayNode" : bs.type === "audio" ? "audioNode" : bs.type === "unnichat_webhook" ? "unnichatWebhookNode" : bs.type === "clint_webhook" ? "clintWebhookNode" : "whatsappNode";
          edges.push({ id: `e-${prevNId}-${bs.id}`, source: prevNId, target: bs.id, sourceHandle: prevNId === step.id ? "not_purchased" : undefined, type: "flowEdge", style: { stroke: "#ef4444", strokeWidth: 2 } });
          nodes.push({ id: bs.id, type: nt, position: pos(bs.id, { x: NODE_X + BRANCH_OFFSET_X, y: ny }), draggable: true, data: { formId, message: bs.message ?? "", value: bs.value ?? 1, unit: bs.unit ?? "minutes", audioUrl: bs.audioUrl ?? "", token: bs.unnichatToken ?? "", crmId: bs.unnichatCrmId ?? "", columnId: bs.unnichatColumnId ?? "", tagId: bs.unnichatTagId ?? "", clintApiUrl: bs.clintApiUrl ?? "", clintApiKey: bs.clintApiKey ?? "", clintFieldMappings: bs.clintFieldMappings ?? [], onMessageChange: () => {}, onInsertVar: () => {}, onValueChange: () => {}, onUnitChange: () => {}, onAudioChange: () => {}, onTokenChange: () => {}, onCrmIdChange: () => {}, onColumnIdChange: () => {}, onTagIdChange: () => {}, onApiUrlChange: () => {}, onApiKeyChange: () => {}, onFieldMappingsChange: () => {}, onRemove: () => {} } });
          ny += (NODE_HEIGHTS[nt] ?? 150) + STEP_GAP;
          prevNId = bs.id;
        });

        prevId = step.id;
        return;
      }

      const nodeType = step.type === "delay" ? "delayNode" : step.type === "audio" ? "audioNode" : step.type === "unnichat_webhook" ? "unnichatWebhookNode" : step.type === "clint_webhook" ? "clintWebhookNode" : "whatsappNode";
      const h = NODE_HEIGHTS[nodeType] ?? 150;
      const edgeType = prevId === "start" ? "smoothstep" : "flowEdge";
      edges.push({ id: `e-${prevId}-${step.id}`, source: prevId, target: step.id, type: edgeType, style: { stroke: "#25D366", strokeWidth: 2 } });
      nodes.push({ id: step.id, type: nodeType, position: pos(step.id, { x: NODE_X, y }), draggable: true, data: { formId, message: step.message ?? "", value: step.value ?? 1, unit: step.unit ?? "minutes", audioUrl: step.audioUrl ?? "", token: step.unnichatToken ?? "", crmId: step.unnichatCrmId ?? "", columnId: step.unnichatColumnId ?? "", tagId: step.unnichatTagId ?? "", clintApiUrl: step.clintApiUrl ?? "", clintApiKey: step.clintApiKey ?? "", clintFieldMappings: step.clintFieldMappings ?? [], onMessageChange: () => {}, onInsertVar: () => {}, onValueChange: () => {}, onUnitChange: () => {}, onAudioChange: () => {}, onTokenChange: () => {}, onCrmIdChange: () => {}, onColumnIdChange: () => {}, onTagIdChange: () => {}, onApiUrlChange: () => {}, onApiKeyChange: () => {}, onFieldMappingsChange: () => {}, onRemove: steps.length > 1 ? () => {} : undefined } });
      y += h + STEP_GAP;
      prevId = step.id;
    });

    return { nodes, edges };
  }, [formName, formId]);

  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    changes.forEach((c) => {
      if (c.type === "position" && c.position && !c.dragging) {
        nodePositionsRef.current = { ...nodePositionsRef.current, [c.id]: c.position };
      }
    });
  }, [setNodes]);

  const removeGhost = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== "__ghost__"));
    setEdges((eds) => eds.filter((e) => e.id !== "e-ghost"));
  }, [setNodes, setEdges]);

  const closePopup = useCallback(() => {
    popupOpenRef.current = false;
    setAddPopup(null);
    ghostPositionRef.current = null;
    removeGhost();
  }, [removeGhost]);

  const onConnectStart = useCallback((_: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
    connectSourceRef.current = params.nodeId;
    connectHandleRef.current = params.handleId ?? null;
  }, []);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const target = event.target as Element;
    if (!target.classList.contains("react-flow__pane")) return;
    const sourceId = connectSourceRef.current;
    if (!sourceId) return;
    connectSourceRef.current = null;

    // Se o popup já está aberto, ignora — evita reposicionar ao arrastar a tela
    if (popupOpenRef.current) return;

    const e = event as MouseEvent;
    const rect = reactFlowWrapRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Converte coordenadas de tela para coordenadas do canvas
    const { x: vpX, y: vpY, zoom } = viewportRef.current;
    const flowX = (e.clientX - rect.left - vpX) / zoom;
    const flowY = (e.clientY - rect.top  - vpY) / zoom;

    ghostPositionRef.current = { x: flowX, y: flowY };

    const handle = connectHandleRef.current;
    const edgeColor = handle === "not_purchased" ? "#ef4444" : handle === "purchased" ? "#22c55e" : "#25D366";

    // Adiciona nó fantasma e aresta no estilo das existentes
    setNodes((nds) => [...nds.filter((n) => n.id !== "__ghost__"), {
      id: "__ghost__", type: "ghostNode",
      position: { x: flowX, y: flowY },
      draggable: false, selectable: false, focusable: false, data: {},
    }]);
    setEdges((eds) => [...eds.filter((e2) => e2.id !== "e-ghost"), {
      id: "e-ghost", source: sourceId, target: "__ghost__",
      sourceHandle: handle ?? undefined,
      type: "flowEdge", style: { stroke: edgeColor, strokeWidth: 2 },
    }]);

    popupOpenRef.current = true;
    setAddPopup({ afterId: sourceId, afterHandle: handle, x: e.clientX, y: e.clientY });
  }, [setNodes, setEdges]);

  // Inject live handlers into node data and rebuild
  const rebuildFlow = useCallback((steps: FlowStep[]) => {
    const { nodes: baseNodes, edges: baseEdges } = buildAll(steps);

    // Map each branch step id → { checkId, branch }
    const branchMap = new Map<string, { checkId: string; branch: "purchased" | "not_purchased" }>();
    steps.forEach((s) => {
      if (s.type === "purchase_check") {
        (s.purchasedSteps ?? []).forEach((bs) => branchMap.set(bs.id, { checkId: s.id, branch: "purchased" }));
        (s.notPurchasedSteps ?? []).forEach((bs) => branchMap.set(bs.id, { checkId: s.id, branch: "not_purchased" }));
      }
    });

    const liveNodes = baseNodes.map((n) => {
      if (n.id === "start" || n.id === "__add__") return n;

      // Purchase check node itself
      const step = steps.find((s) => s.id === n.id);
      if (step?.type === "purchase_check") {
        return { ...n, data: { ...n.data,
          onValueChange: (val: number) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, value: val } : s)),
          onUnitChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, unit: val as Unit } : s)),
          onRemove: steps.length > 1 ? () => setFlowSteps((prev) => prev.filter((s) => s.id !== step.id)) : undefined,
        }};
      }

      // Branch step node
      const bi = branchMap.get(n.id);
      if (bi) {
        const { checkId, branch } = bi;
        const getBranch = (s: FlowStep) => branch === "purchased" ? (s.purchasedSteps ?? []) : (s.notPurchasedSteps ?? []);
        const setBranch = (s: FlowStep, val: BranchStep[]) => branch === "purchased" ? { ...s, purchasedSteps: val } : { ...s, notPurchasedSteps: val };
        const branchStep = getBranch(steps.find((s) => s.id === checkId)!).find((bs) => bs.id === n.id);
        const isUnnichat = branchStep?.type === "unnichat_webhook";
        const isClint   = branchStep?.type === "clint_webhook";
        return { ...n, data: { ...n.data,
          token: branchStep?.unnichatToken ?? "",
          crmId: branchStep?.unnichatCrmId ?? "",
          columnId: branchStep?.unnichatColumnId ?? "",
          tagId: branchStep?.unnichatTagId ?? "",
          formId,
          clintApiUrl:        branchStep?.clintApiUrl        ?? "",
          clintApiKey:        branchStep?.clintApiKey        ?? "",
          clintFieldMappings: branchStep?.clintFieldMappings ?? [],
          onMessageChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, message: val } : bs)) : s)),
          onInsertVar: (v: string) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, message: (bs.message ?? "") + v } : bs)) : s)),
          onValueChange: (val: number) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, value: val } : bs)) : s)),
          onUnitChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, unit: val as Unit } : bs)) : s)),
          onAudioChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, audioUrl: val } : bs)) : s)),
          ...(isUnnichat ? {
            onTokenChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, unnichatToken: val } : bs)) : s)),
            onCrmIdChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, unnichatCrmId: val } : bs)) : s)),
            onColumnIdChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, unnichatColumnId: val } : bs)) : s)),
            onTagIdChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, unnichatTagId: val } : bs)) : s)),
          } : {}),
          ...(isClint ? {
            onApiUrlChange:        (val: string)              => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, clintApiUrl: val } : bs)) : s)),
            onApiKeyChange:        (val: string)              => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, clintApiKey: val } : bs)) : s)),
            onFieldMappingsChange: (val: ClintFieldMapping[]) => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).map((bs) => bs.id === n.id ? { ...bs, clintFieldMappings: val } : bs)) : s)),
          } : {}),
          onRemove: () => setFlowSteps((prev) => prev.map((s) => s.id === checkId ? setBranch(s, getBranch(s).filter((bs) => bs.id !== n.id)) : s)),
        }};
      }

      // Normal main-flow step
      if (!step) return n;

      // Unnichat webhook step
      if (step.type === "unnichat_webhook") {
        return { ...n, data: { ...n.data,
          token: step.unnichatToken ?? "",
          crmId: step.unnichatCrmId ?? "",
          columnId: step.unnichatColumnId ?? "",
          tagId: step.unnichatTagId ?? "",
          onTokenChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, unnichatToken: val } : s)),
          onCrmIdChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, unnichatCrmId: val } : s)),
          onColumnIdChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, unnichatColumnId: val } : s)),
          onTagIdChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, unnichatTagId: val } : s)),
          onRemove: steps.length > 1 ? () => setFlowSteps((prev) => prev.filter((s) => s.id !== step.id)) : undefined,
        }};
      }

      // Clint webhook step
      if (step.type === "clint_webhook") {
        return { ...n, data: { ...n.data,
          formId,
          clintApiUrl:        step.clintApiUrl        ?? "",
          clintApiKey:        step.clintApiKey        ?? "",
          clintFieldMappings: step.clintFieldMappings ?? [],
          onApiUrlChange:        (val: string)              => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, clintApiUrl: val } : s)),
          onApiKeyChange:        (val: string)              => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, clintApiKey: val } : s)),
          onFieldMappingsChange: (val: ClintFieldMapping[]) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, clintFieldMappings: val } : s)),
          onRemove: steps.length > 1 ? () => setFlowSteps((prev) => prev.filter((s) => s.id !== step.id)) : undefined,
        }};
      }

      return { ...n, data: { ...n.data,
        onMessageChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, message: val } : s)),
        onInsertVar: (v: string) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, message: (s.message ?? "") + v } : s)),
        onValueChange: (val: number) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, value: val } : s)),
        onUnitChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, unit: val as Unit } : s)),
        onAudioChange: (val: string) => setFlowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, audioUrl: val } : s)),
        onRemove: steps.length > 1 ? () => setFlowSteps((prev) => prev.filter((s) => s.id !== step.id)) : undefined,
      }};
    });

    // Preserva as posições atuais do React Flow (autoritativo) em vez de usar a ref,
    // que pode estar desatualizada. Isso evita que os blocos "pulem" ao editar um campo.
    setNodes((currentNodes) => {
      const posMap: Record<string, { x: number; y: number }> = {};
      currentNodes.forEach((n) => { posMap[n.id] = n.position; });
      return liveNodes.map((n) => ({ ...n, position: posMap[n.id] ?? n.position }));
    });
    setEdges(baseEdges);
  }, [buildAll, setNodes, setEdges]);

  useEffect(() => {
    if (!loading) rebuildFlow(flowSteps);
  }, [flowSteps, loading, rebuildFlow]);

  useEffect(() => {
    if (!addPopup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePopup(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addPopup, closePopup]);

  // Add new step after a given id (optionally into a purchase_check branch via afterHandle)
  const handleAddStep = (afterId: string, type: "message" | "delay" | "audio" | "purchase_check" | "unnichat_webhook" | "clint_webhook", afterHandle?: string | null) => {
    popupOpenRef.current = false;
    removeGhost();
    setAddPopup(null);

    const newId = `${type === "delay" ? "delay" : type === "audio" ? "audio" : type === "purchase_check" ? "check" : type === "unnichat_webhook" ? "unnichat" : type === "clint_webhook" ? "clint" : "msg"}-${Date.now()}`;
    const newBranch: BranchStep = type === "delay"
      ? { id: newId, type: "delay", value: 1, unit: "minutes" }
      : type === "audio"
      ? { id: newId, type: "audio", audioUrl: "" }
      : type === "unnichat_webhook"
      ? { id: newId, type: "unnichat_webhook" }
      : type === "clint_webhook"
      ? { id: newId, type: "clint_webhook", clintApiUrl: "", clintApiKey: "", clintFieldMappings: [] }
      : { id: newId, type: "message", message: "" };

    if (ghostPositionRef.current) {
      nodePositionsRef.current[newId] = ghostPositionRef.current;
      ghostPositionRef.current = null;
    }

    // Adding directly to a purchase_check branch via handle
    if (afterHandle === "purchased" || afterHandle === "not_purchased") {
      const branch = afterHandle;
      setFlowSteps((prev) => prev.map((s) => {
        if (s.id !== afterId) return s;
        return branch === "purchased"
          ? { ...s, purchasedSteps: [...(s.purchasedSteps ?? []), newBranch] }
          : { ...s, notPurchasedSteps: [...(s.notPurchasedSteps ?? []), newBranch] };
      }));
      return;
    }

    // Check if afterId belongs to an existing branch step → append after it
    let branchInfo: { checkId: string; branch: "purchased" | "not_purchased" } | null = null;
    setFlowSteps((prev) => {
      prev.forEach((s) => {
        if (s.type === "purchase_check") {
          (s.purchasedSteps ?? []).forEach((bs) => { if (bs.id === afterId) branchInfo = { checkId: s.id, branch: "purchased" }; });
          (s.notPurchasedSteps ?? []).forEach((bs) => { if (bs.id === afterId) branchInfo = { checkId: s.id, branch: "not_purchased" }; });
        }
      });
      if (branchInfo) {
        const { checkId, branch } = branchInfo!;
        return prev.map((s) => {
          if (s.id !== checkId) return s;
          const arr = branch === "purchased" ? [...(s.purchasedSteps ?? [])] : [...(s.notPurchasedSteps ?? [])];
          const idx = arr.findIndex((bs) => bs.id === afterId);
          arr.splice(idx + 1, 0, newBranch);
          return branch === "purchased" ? { ...s, purchasedSteps: arr } : { ...s, notPurchasedSteps: arr };
        });
      }

      // Normal main-flow insertion
      const newStep: FlowStep = type === "purchase_check"
        ? { id: newId, type: "purchase_check", value: 3, unit: "minutes", purchasedSteps: [], notPurchasedSteps: [] }
        : type === "unnichat_webhook"
        ? { id: newId, type: "unnichat_webhook" }
        : type === "clint_webhook"
        ? { id: newId, type: "clint_webhook", clintApiUrl: "", clintApiKey: "", clintFieldMappings: [] }
        : { ...newBranch };
      if (afterId === "start") return [newStep, ...prev];
      if (afterId === prev[prev.length - 1]?.id) return [...prev, newStep];
      const idx = prev.findIndex((s) => s.id === afterId);
      if (idx === -1) return [...prev, newStep];
      const next = [...prev];
      next.splice(idx + 1, 0, newStep);
      return next;
    });
  };

  const handleSave = async () => {
    // flushSync garante que o blur processa o state update ANTES de lermos flowStepsRef
    flushSync(() => {
      (document.activeElement as HTMLElement)?.blur();
    });
    // Lê do ref (sempre atual após flushSync re-render) — nunca do closure antigo
    const stepsToSave = flowStepsRef.current;

    // Sincroniza nodePositionsRef com o estado atual do React Flow antes de salvar,
    // garantindo que a posição de cada bloco seja exatamente onde o usuário o deixou.
    nodes.forEach((n) => {
      nodePositionsRef.current[n.id] = n.position;
    });

    setSaving(true);
    const { error } = await supabase.from("form_automations").upsert(
      {
        form_id: formId, owner_id: ownerId, enabled,
        flow_steps: stepsToSave,
        message_template: stepsToSave.find((s) => s.type === "message")?.message ?? "",
        node_positions: nodePositionsRef.current,
        instance_id:    instanceId.trim(),
        instance_token: instanceToken.trim(),
        client_token:   clientToken.trim(),
      },
      { onConflict: "form_id" }
    );
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-[#25D366] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" style={{ fontFamily: "Space Grotesk, sans-serif" }}>

      {/* Navbar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0 bg-background">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-muted/40 transition-colors">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#25D366" }}>
            <WhatsAppIcon size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">WhatsApp Auto</div>
            <div className="text-[11px] text-muted-foreground">{formName}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEnabled((v) => !v)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all"
            style={enabled ? { borderColor: "#25D366", background: "#f0fdf4", color: "#15803d" } : {}}
          >
            {enabled ? <ToggleRight className="w-4 h-4" style={{ color: "#25D366" }} /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
            <span>{enabled ? "Ativa" : "Inativa"}</span>
          </button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: saved ? "#22c55e" : "var(--foreground)", color: "var(--background)" }}
          >
            {saved && <Check className="w-3.5 h-3.5" />}
            {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
          </button>
        </div>
      </div>

      {/* React Flow — desativa eventos de mouse quando o popup está aberto */}
      <div className="flex-1 relative" ref={reactFlowWrapRef} style={addPopup ? { pointerEvents: "none" } : undefined}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onConnectStart={onConnectStart} onConnectEnd={onConnectEnd}
          onMove={(_, vp) => { viewportRef.current = vp; }}
          connectionLineStyle={{ stroke: "#25D366", strokeWidth: 2 }}
          connectionLineType={"smoothstep" as any}
          fitView fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3} maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {addPopup && createPortal(
        <div
          style={{
            position: "fixed",
            zIndex: 9999,
            left: addPopup.x - 140,
            top: addPopup.y - 16,
            width: 300,
            background: "#ffffff",
            borderRadius: 16,
            border: "1.5px solid #e4e4e7",
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            fontFamily: "Space Grotesk, sans-serif",
          }}
        >
          {/* Header — igual ao cabeçalho dos nodes */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 16px", borderBottom: "1px solid #e4e4e7" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Plus size={13} color="#fff" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#18181b" }}>Adicionar bloco</span>
            </div>
            <button
              onClick={closePopup}
              style={{ width: 20, height: 20, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#a1a1aa" }}
            >
              <X size={12} />
            </button>
          </div>
          {/* Opções — mesmo padding/estrutura do body dos nodes */}
          <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              onClick={() => handleAddStep(addPopup.afterId, "message", addPopup.afterHandle)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e4e4e7", background: "#ffffff", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0fdf4")}
              onMouseLeave={e => (e.currentTarget.style.background = "#ffffff")}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#25D366,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <WhatsAppIcon size={16} className="text-white" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Mensagem</div>
                <div style={{ fontSize: 11, color: "#71717a", marginTop: 1 }}>Enviar texto via WhatsApp</div>
              </div>
            </button>
            <button
              onClick={() => handleAddStep(addPopup.afterId, "delay", addPopup.afterHandle)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e4e4e7", background: "#ffffff", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f4f4f5")}
              onMouseLeave={e => (e.currentTarget.style.background = "#ffffff")}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f4f4f5", border: "1.5px solid #e4e4e7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Clock size={16} color="#52525b" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Aguardar tempo</div>
                <div style={{ fontSize: 11, color: "#71717a", marginTop: 1 }}>Intervalo antes do próximo envio</div>
              </div>
            </button>
            <button
              onClick={() => handleAddStep(addPopup.afterId, "audio", addPopup.afterHandle)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e4e4e7", background: "#ffffff", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f0ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "#ffffff")}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Mic size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Áudio</div>
                <div style={{ fontSize: 11, color: "#71717a", marginTop: 1 }}>Enviar arquivo de áudio</div>
              </div>
            </button>
            <button
              onClick={() => handleAddStep(addPopup.afterId, "unnichat_webhook", addPopup.afterHandle)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1.5px solid #c7d2fe", background: "#ffffff", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#eef2ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "#ffffff")}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Globe size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Unnichat</div>
                <div style={{ fontSize: 11, color: "#71717a", marginTop: 1 }}>Criar contato, CRM e tag na Unnichat</div>
              </div>
            </button>
            <button
              onClick={() => handleAddStep(addPopup.afterId, "clint_webhook", addPopup.afterHandle)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1.5px solid #bae6fd", background: "#ffffff", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "#ffffff")}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Zap size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Clint CRM</div>
                <div style={{ fontSize: 11, color: "#71717a", marginTop: 1 }}>Enviar lead para a Clint via API</div>
              </div>
            </button>
            {/* Only show purchase_check when NOT inside a branch */}
            {!addPopup.afterHandle && (
            <button
              onClick={() => handleAddStep(addPopup.afterId, "purchase_check")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1.5px solid #fde68a", background: "#ffffff", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fffbeb")}
              onMouseLeave={e => (e.currentTarget.style.background = "#ffffff")}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <GitBranch size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Verificação de Compra</div>
                <div style={{ fontSize: 11, color: "#71717a", marginTop: 1 }}>Ramifica se lead comprou ou não</div>
              </div>
            </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
