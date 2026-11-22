import { readStoryDateTime } from "./story-time";

export const PROPERTY_TYPES = [
  ["text", "Text"],
  ["number", "Number"],
  ["checkbox", "Checkbox"],
  ["date", "Date"],
  ["datetime", "Date and time"],
  ["list", "List"],
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number][0];

export type ScalarDraft =
  | { type: "text" | "number" | "date" | "datetime"; value: string }
  | { type: "checkbox"; value: boolean };

export type PropertyDraft = ScalarDraft | { type: "list"; items: ScalarDraft[] };
type PropertyValue = string | number | boolean | null;

export interface CodexField {
  key: string;
  label: string;
  initial: PropertyDraft | null;
  structured: boolean;
}

export interface CodexPropertyGroup {
  label: string;
  fields: CodexField[];
}

export interface CodexPropertyLayout {
  labels: Record<string, string>;
  sections: { label?: string; keys: string[] }[];
}

export function emptyProperty(type: PropertyType): PropertyDraft {
  if (type === "checkbox") return { type, value: false };
  if (type === "list") return { type, items: [] };
  return { type, value: "" };
}

function scalarDraft(value: unknown): ScalarDraft | undefined {
  if (typeof value === "boolean") return { type: "checkbox", value };
  if (typeof value === "number") {
    return Number.isFinite(value) ? { type: "number", value: String(value) } : undefined;
  }
  if (typeof value !== "string") return undefined;
  if (readStoryDateTime(value)) {
    if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return { type: "date", value };
    // HTML's datetime-local uses a T separator, and accepts optional seconds.
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?$/u.test(value)) {
      return { type: "datetime", value: value.replace(" ", "T") };
    }
  }
  return { type: "text", value };
}

function propertyDraft(value: unknown): PropertyDraft | null {
  if (!Array.isArray(value)) return scalarDraft(value) ?? null;
  const items = value.map((item) => scalarDraft(item));
  if (items.some((item) => item === undefined)) return null;
  return { type: "list", items: items.filter((item) => item !== undefined) };
}

export function propertyLabel(key: string): string {
  const label = key
    .replaceAll(/(?<tail>[\da-z])(?<head>[A-Z])/gu, "$<tail> $<head>")
    .replaceAll(/[_-]+/gu, " ")
    .replaceAll(/(?:^|\s)\p{Ll}/gu, (letter) => letter.toUpperCase())
    .trim();
  return label || key;
}

function scalarValue(draft: ScalarDraft, label: string): PropertyValue {
  if (draft.type === "checkbox" || draft.type === "text") return draft.value;
  const value = draft.value.trim();
  if (!value) return null;
  if (draft.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number) || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(value)) {
      throw new Error(`Enter a number for “${label}”.`);
    }
    return number;
  }
  if (!readStoryDateTime(value)) throw new Error(`Enter a valid date for “${label}”.`);
  return value;
}

export function editedProperty(
  draft: PropertyDraft,
  label: string,
): PropertyValue | PropertyValue[] {
  if (draft.type !== "list") return scalarValue(draft, label);
  return draft.items.map((item) => scalarValue(item, label));
}

export function groupCodexProperties(
  properties: Record<string, unknown>,
  layout?: CodexPropertyLayout,
): CodexPropertyGroup[] {
  const remaining = new Map<string, CodexField>();
  const byLowercase = new Map<string, string>();
  for (const [key, value] of Object.entries(properties)) {
    const lower = key.toLowerCase();
    const initial = propertyDraft(value);
    remaining.set(key, {
      key,
      label:
        (layout && Object.hasOwn(layout.labels, lower) ? layout.labels[lower] : undefined) ??
        propertyLabel(key),
      initial,
      structured: value !== null && value !== undefined && initial === null,
    });
    if (!byLowercase.has(lower)) byLowercase.set(lower, key);
  }

  const groups: CodexPropertyGroup[] = [];
  for (const { label, keys } of layout?.sections ?? []) {
    const fields: CodexField[] = [];
    for (const wanted of keys) {
      const key = remaining.has(wanted) ? wanted : byLowercase.get(wanted.toLowerCase());
      const field = key === undefined ? undefined : remaining.get(key);
      if (field) {
        fields.push(field);
        remaining.delete(field.key);
      }
    }
    if (fields.length > 0) groups.push({ label: label || "Properties", fields });
  }
  if (remaining.size > 0 || groups.length === 0) {
    groups.push({
      label: groups.length > 0 ? "Other properties" : "Properties",
      fields: [...remaining.values()],
    });
  }

  return groups;
}
