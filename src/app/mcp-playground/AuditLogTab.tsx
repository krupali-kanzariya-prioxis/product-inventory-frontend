"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { mcpFetch, type McpApiResponse } from "./mcpApi";
import styles from "./playground.module.css";

const AUDIT_URI = "app://audit/recent";

function fetchAudit(): Promise<McpApiResponse> {
  return mcpFetch("resources/read", { uri: AUDIT_URI }).then((r) => r.data);
}

type Entry = Record<string, unknown>;

function pick(e: Entry, ...keys: string[]): unknown {
  for (const k of keys) if (e[k] !== undefined && e[k] !== null) return e[k];
  return undefined;
}

function show(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  if (typeof v === "object") return Object.keys(v as object).join(", ");
  return String(v);
}

function formatTime(v: unknown): string {
  if (typeof v !== "string") return show(v);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

function parseEntries(result: unknown): Entry[] {
  const contents = (result as { contents?: { text?: string }[] })?.contents ?? [];
  const text = contents.find((c) => typeof c.text === "string")?.text;
  if (!text) return [];
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed as Entry[];
  const obj = parsed as Record<string, unknown>;
  const list = obj.entries ?? obj.items ?? obj.records ?? obj.events ?? obj.result;
  return Array.isArray(list) ? (list as Entry[]) : [];
}

export default function AuditLogTab({ available }: { available: boolean }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const apply = useCallback((data: McpApiResponse) => {
    setLoading(false);
    if (!data.ok) {
      setError(data.message ?? "Could not read the audit log.");
      return;
    }
    try {
      setEntries(parseEntries(data.result));
      setError(null);
      setUpdatedAt(new Date());
    } catch {
      setError("The audit resource did not return valid JSON.");
    }
  }, []);

  const load = useCallback(() => fetchAudit().then(apply), [apply]);

  useEffect(() => {
    let cancelled = false;
    fetchAudit().then((data) => {
      if (!cancelled) apply(data);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [auto, load]);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbarRow}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? "spin-icon" : undefined} /> Refresh
        </button>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <span>Auto-refresh (5 s)</span>
        </label>
        {updatedAt && <span className={styles.muted}>Updated {updatedAt.toLocaleTimeString()}</span>}
      </div>

      {!available && (
        <div className={styles.noticeInfo} role="status">
          The server does not list <code>{AUDIT_URI}</code> as a resource. Reading it may fail until the backend adds it.
        </div>
      )}
      {error && (
        <div className={styles.noticeError} role="alert">
          <span className={styles.preWrap}>{error}</span>
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Tool</th>
              <th>Operation</th>
              <th>Product SID</th>
              <th>Changed fields</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {!entries || entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  {loading ? "Loading..." : error ? "Audit log unavailable." : "No audit entries yet."}
                </td>
              </tr>
            ) : (
              entries.map((e, i) => (
                <tr key={i}>
                  <td>{formatTime(pick(e, "time", "timestamp", "timestampUtc", "occurredAt", "createdAt"))}</td>
                  <td>
                    <code>{show(pick(e, "tool", "toolName"))}</code>
                  </td>
                  <td>{show(pick(e, "operation", "action"))}</td>
                  <td>
                    <code>{show(pick(e, "productSid", "entitySid"))}</code>
                  </td>
                  <td>{show(pick(e, "changedFields", "fields", "changes"))}</td>
                  <td>{show(pick(e, "outcome", "result", "status"))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
