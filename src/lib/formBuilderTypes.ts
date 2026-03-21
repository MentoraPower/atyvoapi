export type FieldType = "text_short" | "text_long" | "tel" | "radio" | "select" | "card";

export interface FieldOption {
  id: string;
  label: string;
  sublabel?: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  key: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: FieldOption[];
}

export interface FormStep {
  id: string;
  title?: string;
  titleHTML?: string;
  subtitle?: string;
  fields: FormField[];
}

export interface FieldsConfig {
  steps: FormStep[];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function newStepId(): string { return "s_" + uid(); }
export function newFieldId(): string { return "f_" + uid(); }
export function newOptionId(): string { return "o_" + uid(); }

export function defaultConfig(): FieldsConfig {
  return {
    steps: [
      {
        id: newStepId(),
        titleHTML: "Preencha seus <strong>dados</strong> para continuar",
        fields: [
          { id: newFieldId(), type: "text_short", key: "name", label: "Nome completo", placeholder: "Nome completo *", required: true },
          { id: newFieldId(), type: "text_short", key: "email", label: "E-mail", placeholder: "E-mail *", required: true },
          { id: newFieldId(), type: "tel", key: "phone", label: "WhatsApp / Telefone", placeholder: "WhatsApp / Telefone *", required: true },
        ],
      },
    ],
  };
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text_short: "Texto curto",
  text_long: "Texto longo",
  tel: "Telefone",
  radio: "Rádio",
  select: "Suspenso",
  card: "Seleção (Card)",
};
