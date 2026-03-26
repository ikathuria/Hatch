export type ApplicationFieldType = "text" | "textarea" | "select";

export interface ApplicationFormField {
  id: string;
  label: string;
  type: ApplicationFieldType;
  required: boolean;
  helperText: string;
  options: string[];
}

export interface ApplicationAnswerMap {
  [fieldId: string]: string;
}

const normalizeStringList = (input: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(input) ? input : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

const normalizeFieldType = (value: unknown): ApplicationFieldType => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "textarea" || normalized === "select") return normalized;
  return "text";
};

const slugify = (value: string) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const normalizeParticipantLocations = normalizeStringList;

export const parseParticipantLocations = (raw: unknown) => {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    return normalizeParticipantLocations(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const normalizeApplicationFormFields = (input: unknown): ApplicationFormField[] =>
  (Array.isArray(input) ? input : [])
    .map((field, index) => {
      const label = String((field as Record<string, unknown>)?.label || "").trim();
      if (!label) return null;
      const fallbackId = `${slugify(label) || "question"}-${index + 1}`;
      const rawId = String((field as Record<string, unknown>)?.id || "").trim();
      const type = normalizeFieldType((field as Record<string, unknown>)?.type);
      return {
        id: slugify(rawId) || fallbackId,
        label,
        type,
        required: Boolean((field as Record<string, unknown>)?.required),
        helperText: String((field as Record<string, unknown>)?.helperText || "").trim(),
        options:
          type === "select"
            ? normalizeStringList((field as Record<string, unknown>)?.options)
            : []
      } satisfies ApplicationFormField;
    })
    .filter(Boolean) as ApplicationFormField[];

export const parseApplicationFormFields = (raw: unknown) => {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    return normalizeApplicationFormFields(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const parseApplicationAnswers = (raw: unknown): ApplicationAnswerMap => {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
        .filter(([key, value]) => key && value)
    );
  } catch {
    return {};
  }
};

export const normalizeApplicationAnswers = (
  input: unknown,
  fields: ApplicationFormField[]
): ApplicationAnswerMap => {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const knownFieldIds = new Set(fields.map((field) => field.id));

  return Object.fromEntries(
    Object.entries(source)
      .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
      .filter(([key, value]) => key && value && knownFieldIds.has(key))
  );
};
