import type { JsonSchemaProperty, ToolInfo } from "@/lib/mcp/types";

export type FieldKind = "string" | "integer" | "number" | "boolean" | "enum" | "date" | "json";
export type FormValue = string | boolean;
export type FormValues = Record<string, FormValue>;

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  /** Listed in schema.required. */
  required: boolean;
  /** Schema allows null. */
  nullable: boolean;
  description?: string;
  enumValues?: unknown[];
  defaultValue?: unknown;
}

/** Parameters driven by the safe-write workflow rather than typed by the user. */
export const WORKFLOW_FIELDS = new Set(["dryRun", "confirmed"]);

function collectTypes(p: JsonSchemaProperty): { types: string[]; format?: string; enumValues?: unknown[] } {
  const types = new Set<string>();
  let format = p.format;
  let enumValues = p.enum;
  if (Array.isArray(p.type)) p.type.forEach((t) => types.add(t));
  else if (p.type) types.add(p.type);
  for (const sub of [...(p.anyOf ?? []), ...(p.oneOf ?? [])]) {
    const inner = collectTypes(sub);
    inner.types.forEach((t) => types.add(t));
    format ??= inner.format;
    enumValues ??= inner.enumValues;
  }
  return { types: [...types], format, enumValues };
}

export function getFieldSpecs(tool: Pick<ToolInfo, "inputSchema">): FieldSpec[] {
  const props = tool.inputSchema?.properties ?? {};
  const required = new Set(tool.inputSchema?.required ?? []);
  return Object.entries(props).map(([name, p]) => {
    const { types, format, enumValues } = collectTypes(p);
    const nullable = types.includes("null") || (enumValues?.includes(null) ?? false);
    const main = types.find((t) => t !== "null") ?? "string";
    let kind: FieldKind;
    if (enumValues && enumValues.filter((v) => v !== null).length > 0) kind = "enum";
    else if (main === "integer") kind = "integer";
    else if (main === "number") kind = "number";
    else if (main === "boolean") kind = "boolean";
    else if (main === "object" || main === "array") kind = "json";
    // date-time values like concurrency tokens stay as exact text; only date-like names get a date picker.
    else if (format === "date" || /date$/i.test(name)) kind = "date";
    else kind = "string";
    return {
      name,
      kind,
      required: required.has(name),
      nullable,
      description: p.description,
      enumValues: enumValues?.filter((v) => v !== null),
      defaultValue: p.default,
    };
  });
}

/** A field the user may leave empty. */
export function isOptional(f: FieldSpec): boolean {
  return !f.required || f.nullable;
}

export function initialValues(fields: FieldSpec[]): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    values[f.name] = f.kind === "boolean" ? f.defaultValue === true : "";
  }
  return values;
}

export interface BuildOptions {
  /** Field names never sent from the form (workflow-managed). */
  omit?: Set<string>;
  /** Loaded values; optional fields equal to these are not sent (only changed fields). */
  baseline?: Record<string, string>;
}

export function buildArguments(
  fields: FieldSpec[],
  values: FormValues,
  { omit, baseline }: BuildOptions = {}
): { args: Record<string, unknown>; errors: Record<string, string> } {
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const f of fields) {
    if (omit?.has(f.name)) continue;
    const raw = values[f.name];

    if (f.kind === "boolean") {
      args[f.name] = raw === true;
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : "";
    if (baseline && !f.required && f.name in baseline && baseline[f.name] === text) continue;

    if (text === "") {
      if (f.required && !f.nullable) errors[f.name] = "This field is required.";
      // Required-but-nullable params must be present for the server binder; send null, never "".
      else if (f.required && f.nullable) args[f.name] = null;
      continue;
    }

    switch (f.kind) {
      case "integer": {
        const n = Number(text);
        if (!Number.isInteger(n)) errors[f.name] = "Must be a whole number.";
        else args[f.name] = n;
        break;
      }
      case "number": {
        const n = Number(text);
        if (!Number.isFinite(n)) errors[f.name] = "Must be a number.";
        else args[f.name] = n;
        break;
      }
      case "enum": {
        const match = f.enumValues?.find((v) => String(v) === text);
        args[f.name] = match ?? text;
        break;
      }
      case "json":
        try {
          args[f.name] = JSON.parse(text);
        } catch {
          errors[f.name] = "Must be valid JSON.";
        }
        break;
      default:
        args[f.name] = text;
    }
  }
  return { args, errors };
}

export function toInputString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export interface DiffRow {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function rowFrom(field: string, c: Record<string, unknown>): DiffRow {
  return {
    field,
    oldValue: c.oldValue ?? c.old ?? c.before ?? c.from ?? c.previous,
    newValue: c.newValue ?? c.new ?? c.after ?? c.to ?? c.proposed,
  };
}

/** Best-effort extraction of a before/after diff from a dry-run result. */
export function extractDiff(payload: unknown): DiffRow[] | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;

  for (const key of ["changes", "diff", "changedFields"]) {
    const val = obj[key];
    if (Array.isArray(val) && val.every((c) => c && typeof c === "object")) {
      return val.map((c) => {
        const r = c as Record<string, unknown>;
        return rowFrom(String(r.field ?? r.name ?? r.property ?? "?"), r);
      });
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.entries(val as Record<string, unknown>).map(([field, c]) =>
        c && typeof c === "object" ? rowFrom(field, c as Record<string, unknown>) : { field, oldValue: undefined, newValue: c }
      );
    }
  }

  const before = obj.before ?? obj.current ?? obj.existing;
  const after = obj.after ?? obj.proposed ?? obj.updated;
  if (before && after && typeof before === "object" && typeof after === "object") {
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    return [...new Set([...Object.keys(b), ...Object.keys(a)])]
      .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
      .map((field) => ({ field, oldValue: b[field], newValue: a[field] }));
  }

  for (const nested of ["preview", "result", "data"]) {
    if (obj[nested] && typeof obj[nested] === "object") {
      const d = extractDiff(obj[nested]);
      if (d) return d;
    }
  }
  return null;
}
