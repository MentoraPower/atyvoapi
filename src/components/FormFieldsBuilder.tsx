import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, X, GripVertical, AlertCircle } from "lucide-react";
import {
  FieldsConfig, FormStep, FormField, FieldOption, FieldType,
  FIELD_TYPE_LABELS, newStepId, newFieldId, newOptionId,
} from "@/lib/formBuilderTypes";

interface Props {
  value: FieldsConfig;
  onChange: (cfg: FieldsConfig) => void;
}

const TYPE_COLORS: Record<FieldType, string> = {
  text_short: "bg-blue-50 text-blue-700 border-blue-200",
  text_long:  "bg-blue-50 text-blue-700 border-blue-200",
  tel:        "bg-purple-50 text-purple-700 border-purple-200",
  radio:      "bg-orange-50 text-orange-700 border-orange-200",
  select:     "bg-teal-50 text-teal-700 border-teal-200",
  card:       "bg-pink-50 text-pink-700 border-pink-200",
};

const TYPE_SHORT: Record<FieldType, string> = {
  text_short: "Texto",
  text_long:  "Texto longo",
  tel:        "Tel",
  radio:      "Rádio",
  select:     "Suspenso",
  card:       "Card",
};

/* ─── Option row ─────────────────────────────────────────── */
function OptionRow({
  option, index, total,
  onUpdate, onDelete, onMove,
}: {
  option: FieldOption; index: number; total: number;
  onUpdate: (o: FieldOption) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <div className="flex flex-col mt-0.5">
        <button
          type="button" disabled={index === 0}
          onClick={() => onMove(-1)}
          className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/50 disabled:opacity-20 transition-colors"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button" disabled={index === total - 1}
          onClick={() => onMove(1)}
          className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/50 disabled:opacity-20 transition-colors"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 space-y-1">
        <input
          value={option.label}
          onChange={(e) => onUpdate({ ...option, label: e.target.value })}
          placeholder="Label da opção *"
          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-foreground/30 transition-colors"
        />
        <input
          value={option.sublabel || ""}
          onChange={(e) => onUpdate({ ...option, sublabel: e.target.value })}
          placeholder="Sublabel (opcional)"
          className="w-full h-7 px-2.5 rounded-lg border border-border bg-muted/20 text-[11px] text-muted-foreground outline-none focus:border-foreground/30 transition-colors"
        />
      </div>
      <button
        type="button" onClick={onDelete}
        className="mt-1 p-1 rounded-md hover:bg-red-50 text-muted-foreground/40 hover:text-red-500 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Field card ─────────────────────────────────────────── */
function FieldCard({
  field, index, total,
  onUpdate, onDelete, onMove,
}: {
  field: FormField; index: number; total: number;
  onUpdate: (f: FormField) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasOptions = field.type === "card" || field.type === "radio" || field.type === "select";

  const updateOption = (i: number, opt: FieldOption) => {
    const options = [...(field.options || [])];
    options[i] = opt;
    onUpdate({ ...field, options });
  };
  const deleteOption = (i: number) => {
    onUpdate({ ...field, options: (field.options || []).filter((_, j) => j !== i) });
  };
  const moveOption = (i: number, dir: -1 | 1) => {
    const opts = [...(field.options || [])];
    const j = i + dir;
    if (j < 0 || j >= opts.length) return;
    [opts[i], opts[j]] = [opts[j], opts[i]];
    onUpdate({ ...field, options: opts });
  };
  const addOption = () => {
    onUpdate({
      ...field,
      options: [...(field.options || []), { id: newOptionId(), label: "Nova opção", sublabel: "" }],
    });
  };

  const changeType = (t: FieldType) => {
    const needsOpts = t === "card" || t === "radio" || t === "select";
    const hadOpts   = field.type === "card" || field.type === "radio" || field.type === "select";
    onUpdate({
      ...field, type: t,
      options: needsOpts
        ? (hadOpts ? field.options : [{ id: newOptionId(), label: "Opção 1", sublabel: "" }])
        : undefined,
    });
  };

  return (
    <div className={`rounded-xl border transition-all ${open ? "border-foreground/20 shadow-sm" : "border-border"} bg-background overflow-hidden`}>
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        {/* reorder */}
        <div className="flex flex-col gap-0 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            type="button" disabled={index === 0}
            onClick={() => onMove(-1)}
            className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 disabled:opacity-20 transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button" disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 disabled:opacity-20 transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* type badge */}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border flex-shrink-0 ${TYPE_COLORS[field.type]}`}>
          {TYPE_SHORT[field.type]}
        </span>

        {/* label */}
        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
          {field.label || field.placeholder || field.key || "Campo"}
        </span>

        {/* required dot */}
        {field.required && (
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" title="Obrigatório" />
        )}

        {/* options count for card/radio/select */}
        {hasOptions && (
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {(field.options || []).length} op.
          </span>
        )}

        {/* delete */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded-md hover:bg-red-50 text-muted-foreground/40 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>

        {/* expand chevron */}
        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </div>

      {/* Editor */}
      {open && (
        <div className="px-3 pb-4 pt-1 space-y-3 border-t border-border bg-muted/5">

          {/* Type selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo de campo</label>
            <select
              value={field.type}
              onChange={e => changeType(e.target.value as FieldType)}
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-foreground/30 transition-colors cursor-pointer"
            >
              {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([t, lbl]) => (
                <option key={t} value={t}>{lbl}</option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label</label>
            <input
              value={field.label || ""}
              onChange={e => onUpdate({ ...field, label: e.target.value })}
              placeholder="Ex: Nome completo"
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-foreground/30 transition-colors"
            />
          </div>

          {/* Placeholder — text fields */}
          {(field.type === "text_short" || field.type === "text_long" || field.type === "tel") && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Placeholder</label>
              <input
                value={field.placeholder || ""}
                onChange={e => onUpdate({ ...field, placeholder: e.target.value })}
                placeholder="Ex: Digite seu nome..."
                className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-foreground/30 transition-colors"
              />
            </div>
          )}

          {/* Key */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              Chave (identificador)
              <span title="Usado como nome do campo nos dados coletados">
                <AlertCircle className="w-3 h-3 text-muted-foreground/50" />
              </span>
            </label>
            <input
              value={field.key}
              onChange={e => onUpdate({ ...field, key: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
              placeholder="ex: nome_campo"
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground font-mono outline-none focus:border-foreground/30 transition-colors"
            />
          </div>

          {/* Required */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Obrigatório</span>
            <button
              type="button"
              onClick={() => onUpdate({ ...field, required: !field.required })}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
              style={{ background: field.required ? "#111" : "#d1d5db" }}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${field.required ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
            </button>
          </div>

          {/* Options — card / radio / select */}
          {hasOptions && (
            <div className="space-y-2 pt-1 border-t border-border">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Opções ({(field.options || []).length})
              </label>
              <div className="space-y-2">
                {(field.options || []).map((opt, i) => (
                  <OptionRow
                    key={opt.id}
                    option={opt} index={i} total={(field.options || []).length}
                    onUpdate={o => updateOption(i, o)}
                    onDelete={() => deleteOption(i)}
                    onMove={dir => moveOption(i, dir)}
                  />
                ))}
              </div>
              <button
                type="button" onClick={addOption}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar opção
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main builder ───────────────────────────────────────── */
export function FormFieldsBuilder({ value, onChange }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  const steps = value.steps;
  const safeIdx = Math.min(activeIdx, steps.length - 1);
  const step = steps[safeIdx];

  const updateStep = (s: FormStep) => {
    const updated = [...steps];
    updated[safeIdx] = s;
    onChange({ ...value, steps: updated });
  };

  const addStep = () => {
    const s: FormStep = {
      id: newStepId(),
      title: `Etapa ${steps.length + 1}`,
      subtitle: "",
      fields: [{
        id: newFieldId(), type: "text_short",
        key: "campo_" + Math.random().toString(36).slice(2, 5),
        label: "Novo campo", placeholder: "Digite aqui...", required: false,
      }],
    };
    const newSteps = [...steps, s];
    onChange({ ...value, steps: newSteps });
    setActiveIdx(newSteps.length - 1);
  };

  const deleteStep = () => {
    if (steps.length <= 1) return;
    const newSteps = steps.filter((_, i) => i !== safeIdx);
    onChange({ ...value, steps: newSteps });
    setActiveIdx(Math.max(0, safeIdx - 1));
  };

  const addField = () => {
    const field: FormField = {
      id: newFieldId(), type: "text_short",
      key: "campo_" + Math.random().toString(36).slice(2, 5),
      label: "Novo campo", placeholder: "Digite aqui...", required: false,
    };
    updateStep({ ...step, fields: [...step.fields, field] });
  };

  const updateField = (i: number, f: FormField) => {
    const fields = [...step.fields];
    fields[i] = f;
    updateStep({ ...step, fields });
  };

  const deleteField = (i: number) => {
    updateStep({ ...step, fields: step.fields.filter((_, j) => j !== i) });
  };

  const moveField = (i: number, dir: -1 | 1) => {
    const fields = [...step.fields];
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    updateStep({ ...step, fields });
  };

  if (!step) return null;

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-foreground text-background text-[9px] flex items-center justify-center font-bold">F</span>
          Campos do Formulário
        </p>

        {/* Step tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {steps.map((s, i) => (
            <button
              key={s.id} type="button"
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                i === safeIdx
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s.title ? s.title.slice(0, 18) + (s.title.length > 18 ? "…" : "") : `Etapa ${i + 1}`}
            </button>
          ))}
          <button
            type="button" onClick={addStep}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            title="Nova etapa"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Step meta ── */}
      <div className="px-5 py-3 border-b border-border bg-muted/5 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Título da etapa</label>
            <input
              value={step.title || step.titleHTML?.replace(/<[^>]+>/g, "") || ""}
              onChange={e => updateStep({ ...step, title: e.target.value, titleHTML: undefined })}
              placeholder="Ex: Preencha seus dados"
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-foreground/30 transition-colors"
            />
          </div>
          {steps.length > 1 && (
            <button
              type="button" onClick={deleteStep}
              className="mt-5 p-2 rounded-xl border border-border hover:bg-red-50 hover:border-red-200 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
              title="Excluir esta etapa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Subtítulo <span className="font-normal normal-case">(opcional)</span></label>
          <input
            value={step.subtitle || ""}
            onChange={e => updateStep({ ...step, subtitle: e.target.value })}
            placeholder="Ex: Selecione a opção abaixo"
            className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-foreground/30 transition-colors"
          />
        </div>
      </div>

      {/* ── Fields list (scrollable) ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {step.fields.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-xs text-muted-foreground">Nenhum campo ainda</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Clique em "+ Campo" para adicionar</p>
          </div>
        )}
        {step.fields.map((field, i) => (
          <FieldCard
            key={field.id}
            field={field} index={i} total={step.fields.length}
            onUpdate={f => updateField(i, f)}
            onDelete={() => deleteField(i)}
            onMove={dir => moveField(i, dir)}
          />
        ))}
      </div>

      {/* ── Add field ── */}
      <div className="px-5 py-3 border-t border-border flex-shrink-0">
        <button
          type="button" onClick={addField}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-foreground/20 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar Campo
        </button>

        <div className="mt-2 flex gap-2 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" /> obrigatório</span>
          <span className="ml-auto">{step.fields.length} campo{step.fields.length !== 1 ? "s" : ""} · etapa {safeIdx + 1}/{steps.length}</span>
        </div>
      </div>
    </div>
  );
}
