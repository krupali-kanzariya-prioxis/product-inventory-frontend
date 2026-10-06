"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Eye, Save, RefreshCw, Download, Wrench } from "lucide-react";
import Modal from "@/components/Modal";
import type { ToolInfo } from "@/lib/mcp/types";
import { extractToolPayload, mcpFetch, type CallRecord } from "./mcpApi";
import {
  buildArguments,
  extractDiff,
  getFieldSpecs,
  initialValues,
  isOptional,
  toInputString,
  WORKFLOW_FIELDS,
  type DiffRow,
  type FieldSpec,
  type FormValues,
} from "./schema";
import { JsonView } from "./JsonView";
import styles from "./playground.module.css";

export type RunFn = (kind: CallRecord["kind"], name: string, path: string, body: unknown) => Promise<CallRecord>;

const TOKEN_FIELDS = new Set(["idempotencyKey", "expectedLastModifiedAt"]);

function isReadOnly(tool: ToolInfo) {
  return tool.annotations?.readOnlyHint === true;
}

export default function ToolsTab({ tools, run }: { tools: ToolInfo[]; run: RunFn }) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = tools.find((t) => t.name === selectedName) ?? null;

  if (tools.length === 0) {
    return <div className={styles.empty}>The server exposes no tools.</div>;
  }

  return (
    <div className={styles.split}>
      <ul className={styles.itemList} aria-label="Tools">
        {tools.map((t) => (
          <li key={t.name}>
            <button
              type="button"
              className={`${styles.item} ${t.name === selectedName ? styles.itemActive : ""}`}
              onClick={() => setSelectedName(t.name)}
              aria-pressed={t.name === selectedName}
            >
              <div className={styles.itemHead}>
                <code className={styles.itemName}>{t.name}</code>
                {isReadOnly(t) ? (
                  <span className="badge badge-active">read-only</span>
                ) : (
                  <span className={`badge ${styles.badgeWrite}`}>writes data</span>
                )}
              </div>
              {t.description && <p className={styles.itemDesc}>{t.description}</p>}
            </button>
          </li>
        ))}
      </ul>
      <div>
        {selected ? (
          <ToolForm key={selected.name} tool={selected} tools={tools} run={run} />
        ) : (
          <div className={styles.empty}>
            <Wrench size={28} />
            <p>Select a tool to build a call.</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface Notice {
  type: "error" | "info" | "success";
  text: string;
}

function ToolForm({ tool, tools, run }: { tool: ToolInfo; tools: ToolInfo[]; run: RunFn }) {
  const fields = useMemo(() => getFieldSpecs(tool), [tool]);
  const names = new Set(fields.map((f) => f.name));
  const isWrite = !isReadOnly(tool);
  const safeFlow = isWrite && names.has("dryRun") && names.has("confirmed");
  const hasIdempotency = names.has("idempotencyKey");
  const hasExpected = names.has("expectedLastModifiedAt");
  const canLoadProduct = isWrite && names.has("productSid") && tools.some((t) => t.name === "get_product");
  const sendOnlyChanged = /^update_/i.test(tool.name);

  const [values, setValues] = useState<FormValues>(() => {
    const v = initialValues(fields);
    if (hasIdempotency) v.idempotencyKey = crypto.randomUUID();
    return v;
  });
  const [baseline, setBaseline] = useState<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [preview, setPreview] = useState<{ args: Record<string, unknown>; diff: DiffRow[] | null; payload: unknown } | null>(null);
  const [confirm, setConfirm] = useState<{ args: Record<string, unknown>; rows: DiffRow[] | null } | null>(null);

  const built = buildArguments(fields, values, {
    omit: safeFlow ? WORKFLOW_FIELDS : undefined,
    baseline: sendOnlyChanged && baseline ? baseline : undefined,
  });
  const requestPreview = { name: tool.name, arguments: safeFlow ? { ...built.args, dryRun: true } : built.args };

  function setField(name: string, value: string | boolean) {
    setValues((v) => ({ ...v, [name]: value }));
    setPreview(null);
    if (errors[name]) setErrors((e) => ({ ...e, [name]: "" }));
  }

  async function exec(args: Record<string, unknown>): Promise<CallRecord> {
    setBusy(true);
    try {
      const rec = await run("tool", tool.name, "tools/call", { name: tool.name, arguments: args });
      if (!rec.ok) setNotice({ type: rec.info ? "info" : "error", text: rec.response.message ?? "Call failed." });
      return rec;
    } finally {
      setBusy(false);
    }
  }

  function validate(): Record<string, unknown> | null {
    setErrors(built.errors);
    if (Object.values(built.errors).some(Boolean)) {
      setNotice({ type: "error", text: "Fix the highlighted fields before sending." });
      return null;
    }
    setNotice(null);
    return built.args;
  }

  async function handleCall() {
    const args = validate();
    if (!args) return;
    setPreview(null);

    if (!isWrite) {
      await exec(args);
      return;
    }

    const changedKeys = Object.keys(args).filter((k) => k !== "productSid" && !TOKEN_FIELDS.has(k));
    if (sendOnlyChanged && baseline && changedKeys.length === 0) {
      setNotice({ type: "info", text: "Nothing changed compared with the loaded product. Edit a field first." });
      return;
    }

    if (safeFlow) {
      const rec = await exec({ ...args, dryRun: true });
      if (rec.ok) {
        const payload = extractToolPayload(rec.response);
        setPreview({ args, diff: extractDiff(payload), payload });
      }
      return;
    }

    // Server has no dry-run: confirm client-side with a local before/after summary.
    setConfirm({
      args,
      rows: changedKeys.map((k) => ({
        field: k,
        oldValue: baseline ? baseline[k] : undefined,
        newValue: args[k],
      })),
    });
  }

  async function handleConfirmed() {
    if (!confirm) return;
    const finalArgs = safeFlow ? { ...confirm.args, dryRun: false, confirmed: true } : confirm.args;
    setConfirm(null);
    const rec = await exec(finalArgs);
    if (!rec.ok) return;

    setPreview(null);
    setNotice({ type: "success", text: "Saved. Existing inventory pages will show the change after refresh." });
    window.dispatchEvent(new Event("inventory:changed"));
    if (hasIdempotency) setValues((v) => ({ ...v, idempotencyKey: crypto.randomUUID() }));
    const sid = typeof finalArgs.productSid === "string" ? finalArgs.productSid : "";
    if (baseline && sid) await loadProduct(sid, false);
  }

  function applyProduct(product: Record<string, unknown>) {
    const byLower = new Map(Object.entries(product).map(([k, v]) => [k.toLowerCase(), v]));
    const next: FormValues = { ...values };
    const base: Record<string, string> = {};
    for (const f of fields) {
      if (WORKFLOW_FIELDS.has(f.name) || TOKEN_FIELDS.has(f.name)) continue;
      const key = f.name.toLowerCase();
      if (!byLower.has(key)) continue;
      const raw = byLower.get(key);
      if (f.kind === "boolean") {
        next[f.name] = raw === true;
      } else {
        next[f.name] = toInputString(raw);
        if (f.name !== "productSid") base[f.name] = toInputString(raw);
      }
    }
    if (hasExpected) next.expectedLastModifiedAt = toInputString(byLower.get("lastmodifiedat"));
    setValues(next);
    setBaseline(base);
    setErrors({});
    setPreview(null);
  }

  async function loadProduct(sid: string, clearNotice = true) {
    setBusy(true);
    try {
      const rec = await run("tool", "get_product", "tools/call", { name: "get_product", arguments: { productSid: sid } });
      if (!rec.ok) {
        setNotice({ type: "error", text: rec.response.message ?? "Could not load product." });
        return;
      }
      const payload = extractToolPayload(rec.response);
      if (payload && typeof payload === "object") {
        applyProduct(payload as Record<string, unknown>);
        if (clearNotice) setNotice({ type: "info", text: "Product loaded. Change only the fields you want to update." });
      }
    } finally {
      setBusy(false);
    }
  }

  const visibleFields = fields.filter((f) => !(safeFlow && WORKFLOW_FIELDS.has(f.name)));
  const callLabel = !isWrite ? "Call" : safeFlow ? "Preview (dry run)" : "Review and save";

  return (
    <div className="card">
      <div className="card-body">
        <div className={styles.panelHead}>
          <h3 className={styles.panelTitle}>
            <code>{tool.name}</code>
          </h3>
          {isWrite ? <span className={`badge ${styles.badgeWrite}`}>writes data</span> : <span className="badge badge-active">read-only</span>}
        </div>
        {tool.description && <p className={styles.itemDesc}>{tool.description}</p>}
        {isWrite && !safeFlow && (
          <p className={styles.muted}>
            This server has no dry-run for this tool, so the playground asks you to confirm a local summary before sending.
          </p>
        )}

        {canLoadProduct && (
          <LoadProductHelper
            disabled={busy}
            hasSearch={tools.some((t) => t.name === "search_products")}
            onLoad={(sid) => loadProduct(sid)}
            loadedSid={baseline ? String(values.productSid ?? "") : ""}
          />
        )}

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void handleCall();
          }}
          noValidate
        >
          {visibleFields.length === 0 && <p className={styles.muted}>This tool takes no arguments.</p>}
          <div className="form-grid form-grid-2">
            {visibleFields.map((f) => (
              <FieldInput
                key={f.name}
                toolName={tool.name}
                field={f}
                value={values[f.name]}
                error={errors[f.name]}
                changed={!!baseline && f.name in baseline && baseline[f.name] !== String(values[f.name] ?? "").trim()}
                onChange={(v) => setField(f.name, v)}
                onRegenerate={f.name === "idempotencyKey" ? () => setField("idempotencyKey", crypto.randomUUID()) : undefined}
              />
            ))}
          </div>

          {notice && <NoticeBox notice={notice} />}

          <div className={styles.formActions}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <RefreshCw size={16} className="spin-icon" /> : safeFlow ? <Eye size={16} /> : <Play size={16} />}
              {busy ? "Working..." : callLabel}
            </button>
          </div>

          <details className={styles.details}>
            <summary>Request JSON</summary>
            <JsonView value={requestPreview} maxHeight={260} />
          </details>
        </form>

        {preview && (
          <div className={styles.previewBox}>
            <h4 className={styles.previewTitle}>Dry-run preview (nothing saved yet)</h4>
            {preview.diff && preview.diff.length > 0 ? (
              <DiffTable rows={preview.diff} />
            ) : preview.diff ? (
              <p className={styles.muted}>The server reports no changes.</p>
            ) : (
              <>
                <p className={styles.muted}>The server did not return a recognizable change list; raw preview:</p>
                <JsonView value={preview.payload} maxHeight={240} />
              </>
            )}
            <button
              type="button"
              className="btn btn-success"
              disabled={busy}
              onClick={() => setConfirm({ args: preview.args, rows: preview.diff })}
            >
              <Save size={16} /> Confirm and save
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Confirm ${tool.name}`}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-success" onClick={() => void handleConfirmed()} disabled={busy} autoFocus>
              <Save size={16} /> Save changes
            </button>
          </>
        }
      >
        <p className={styles.confirmText}>
          This will write to the inventory database{typeof confirm?.args.productSid === "string" ? ` for product ${confirm.args.productSid}` : ""}.
        </p>
        {confirm?.rows && confirm.rows.length > 0 ? <DiffTable rows={confirm.rows} /> : <JsonView value={confirm?.args} maxHeight={260} />}
      </Modal>
    </div>
  );
}

function display(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null || v === "") return "(empty)";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function DiffTable({ rows }: { rows: DiffRow[] }) {
  return (
    <div className={styles.tableScroll}>
      <table className={`data-table ${styles.compactTable}`}>
        <thead>
          <tr>
            <th>Field</th>
            <th>Old</th>
            <th>New</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field}>
              <td>
                <code>{r.field}</code>
              </td>
              <td className={styles.oldValue}>{display(r.oldValue)}</td>
              <td className={styles.newValue}>{display(r.newValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NoticeBox({ notice }: { notice: Notice }) {
  const cls = notice.type === "error" ? styles.noticeError : notice.type === "info" ? styles.noticeInfo : styles.noticeSuccess;
  return (
    <div className={cls} role={notice.type === "error" ? "alert" : "status"}>
      <span className={styles.preWrap}>{notice.text}</span>
    </div>
  );
}

interface FieldInputProps {
  toolName: string;
  field: FieldSpec;
  value: string | boolean | undefined;
  error?: string;
  changed: boolean;
  onChange: (v: string | boolean) => void;
  onRegenerate?: () => void;
}

function FieldInput({ toolName, field: f, value, error, changed, onChange, onRegenerate }: FieldInputProps) {
  const id = `f-${toolName}-${f.name}`;
  const hintId = `${id}-hint`;
  const optional = isOptional(f);
  const describedBy = f.description ? hintId : undefined;
  const inputClass = `form-input ${error ? "form-input-error" : ""} ${changed ? styles.changedInput : ""}`;
  const placeholder = f.defaultValue !== undefined && f.defaultValue !== "" ? `default: ${String(f.defaultValue)}` : undefined;

  let control: React.ReactNode;
  if (f.kind === "boolean") {
    control = (
      <label className={styles.checkbox}>
        <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} aria-describedby={describedBy} />
        <span>{value === true ? "true" : "false"}</span>
      </label>
    );
  } else if (f.kind === "enum") {
    control = (
      <select id={id} className={`form-select ${error ? "form-select-error" : ""}`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy}>
        <option value="">{optional ? "(not set)" : "Select..."}</option>
        {f.enumValues?.map((v) => (
          <option key={String(v)} value={String(v)}>
            {String(v)}
          </option>
        ))}
      </select>
    );
  } else if (f.kind === "json") {
    control = (
      <textarea id={id} className={`form-textarea ${error ? "form-input-error" : ""}`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="JSON value" aria-describedby={describedBy} />
    );
  } else {
    const type = f.kind === "integer" || f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text";
    control = (
      <div className={onRegenerate ? styles.inputWithButton : undefined}>
        <input
          id={id}
          type={type}
          step={f.kind === "integer" ? 1 : f.kind === "number" ? "any" : undefined}
          className={inputClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={!!onRegenerate}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        />
        {onRegenerate && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onRegenerate}>
            <RefreshCw size={14} /> New key
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {f.name}{" "}
        {optional ? <span className={styles.optionalTag}>{f.required ? "optional (sent as null)" : "optional"}</span> : <span className="required">*</span>}
        {changed && <span className={styles.changedTag}>changed</span>}
      </label>
      {control}
      {f.description && (
        <div className="form-hint" id={hintId}>
          {f.description}
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

interface ProductOption {
  productSid: string;
  productName?: string;
  sku?: string;
}

function LoadProductHelper({
  disabled,
  hasSearch,
  onLoad,
  loadedSid,
}: {
  disabled: boolean;
  hasSearch: boolean;
  onLoad: (sid: string) => void;
  loadedSid: string;
}) {
  const [sid, setSid] = useState("");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSearch) return;
    let cancelled = false;
    // Dropdown data only; not recorded in the call history.
    mcpFetch("tools/call", { name: "search_products", arguments: { limit: 50 } }).then(({ data }) => {
      if (cancelled) return;
      if (!data.ok) {
        setListError(data.message ?? "Could not load products.");
        return;
      }
      const payload = extractToolPayload(data) as { items?: ProductOption[] } | ProductOption[] | undefined;
      const items = Array.isArray(payload) ? payload : payload?.items ?? [];
      setOptions(items.filter((p) => p && typeof p.productSid === "string"));
    });
    return () => {
      cancelled = true;
    };
  }, [hasSearch]);

  return (
    <div className={styles.loadBox}>
      <div className={styles.loadTitle}>
        <Download size={15} /> Load product
        {loadedSid && <span className={styles.muted}> · loaded {loadedSid}</span>}
      </div>
      <div className={styles.loadRow}>
        {hasSearch && (
          <select
            className="form-select"
            aria-label="Pick a product"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                setSid(e.target.value);
                onLoad(e.target.value);
              }
            }}
            disabled={disabled || options.length === 0}
          >
            <option value="">{options.length ? "Pick from search_products..." : listError ? "Product list unavailable" : "Loading products..."}</option>
            {options.map((p) => (
              <option key={p.productSid} value={p.productSid}>
                {p.productName ?? p.productSid} {p.sku ? `(${p.sku})` : ""}
              </option>
            ))}
          </select>
        )}
        <input className="form-input" placeholder="or enter a product SID" aria-label="Product SID" value={sid} onChange={(e) => setSid(e.target.value)} />
        <button type="button" className="btn btn-outline" disabled={disabled || !sid.trim()} onClick={() => onLoad(sid.trim())}>
          Load
        </button>
      </div>
      <p className="form-hint">Calls get_product and pre-fills the form. Only fields you change are sent.</p>
    </div>
  );
}
