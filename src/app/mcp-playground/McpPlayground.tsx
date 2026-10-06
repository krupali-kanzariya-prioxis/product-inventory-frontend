"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert, PlugZap, Server } from "lucide-react";
import type { PromptInfo, ResourceInfo, ResourceTemplateInfo, ToolInfo } from "@/lib/mcp/types";
import { mcpFetch, NOT_SAVED_PATTERN, type CallRecord } from "./mcpApi";
import ToolsTab, { type RunFn } from "./ToolsTab";
import ResourcesTab from "./ResourcesTab";
import PromptsTab from "./PromptsTab";
import AuditLogTab from "./AuditLogTab";
import ResultPanel from "./ResultPanel";
import styles from "./playground.module.css";

type Tab = "tools" | "resources" | "prompts" | "audit";
const TABS: { id: Tab; label: string }[] = [
  { id: "tools", label: "Tools" },
  { id: "resources", label: "Resources" },
  { id: "prompts", label: "Prompts" },
  { id: "audit", label: "Audit Log" },
];

interface InfoState {
  connected: boolean;
  host?: string;
  server?: { name: string; version: string; title?: string };
  capabilities?: Record<string, unknown>;
  message?: string;
}

interface Lists {
  tools: ToolInfo[];
  resources: ResourceInfo[];
  templates: ResourceTemplateInfo[];
  prompts: PromptInfo[];
  errors: Partial<Record<"tools" | "resources" | "prompts", string>>;
}

const EMPTY_LISTS: Lists = { tools: [], resources: [], templates: [], prompts: [], errors: {} };

async function fetchAll(): Promise<{ info: InfoState; lists: Lists }> {
  const { data } = await mcpFetch("info");
  if (!data.ok) return { info: { connected: false, message: data.message }, lists: EMPTY_LISTS };
  const info = data as unknown as InfoState;
  if (!info.connected) return { info, lists: EMPTY_LISTS };

  // Only list what the server advertises; listing an unsupported capability is an MCP error.
  const caps = info.capabilities ?? {};
  const skip = Promise.resolve(null);
  const [t, r, p] = await Promise.all([
    caps.tools ? mcpFetch("tools") : skip,
    caps.resources ? mcpFetch("resources") : skip,
    caps.prompts ? mcpFetch("prompts") : skip,
  ]);
  const errors: Lists["errors"] = {};
  if (t && !t.data.ok) errors.tools = t.data.message;
  if (r && !r.data.ok) errors.resources = r.data.message;
  if (p && !p.data.ok) errors.prompts = p.data.message;
  return {
    info,
    lists: {
      tools: (t?.data.ok ? (t.data.tools as ToolInfo[]) : []) ?? [],
      resources: (r?.data.ok ? (r.data.resources as ResourceInfo[]) : []) ?? [],
      templates: (r?.data.ok ? (r.data.resourceTemplates as ResourceTemplateInfo[]) : []) ?? [],
      prompts: (p?.data.ok ? (p.data.prompts as PromptInfo[]) : []) ?? [],
      errors,
    },
  };
}

export default function McpPlayground() {
  const [info, setInfo] = useState<InfoState | null>(null);
  const [lists, setLists] = useState<Lists>(EMPTY_LISTS);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("tools");
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const applyLoaded = useCallback(({ info: nextInfo, lists: nextLists }: { info: InfoState; lists: Lists }) => {
    setInfo(nextInfo);
    setLists(nextLists);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAll().then((loaded) => {
      if (!cancelled) applyLoaded(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [applyLoaded]);

  function refresh() {
    setLoading(true);
    fetchAll().then(applyLoaded);
  }

  const run: RunFn = useCallback(async (kind, name, path, body) => {
    const { status, data, durationMs } = await mcpFetch(path, body);
    const rec: CallRecord = {
      id: crypto.randomUUID(),
      kind,
      name,
      time: new Date(),
      ok: data.ok === true,
      info: data.ok !== true && NOT_SAVED_PATTERN.test(data.message ?? ""),
      httpStatus: status,
      durationMs,
      request: body,
      response: data,
    };
    setHistory((h) => [rec, ...h].slice(0, 10));
    setSelectedId(rec.id);
    if (data.unreachable) setInfo((i) => ({ ...(i ?? {}), connected: false, message: data.message }));
    return rec;
  }, []);

  function onTabKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (index + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[next].id);
    document.getElementById(`mcp-tab-${TABS[next].id}`)?.focus();
  }

  const connected = info?.connected === true;
  const listError = tab === "tools" ? lists.errors.tools : tab === "resources" ? lists.errors.resources : tab === "prompts" ? lists.errors.prompts : undefined;

  return (
    <>
      <div className="page-header">
        <h2>MCP Playground</h2>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin-icon" : undefined} /> Refresh
          </button>
        </div>
      </div>

      <div className={`card ${styles.headerCard}`}>
        <div className={`card-body ${styles.headerRow}`}>
          <span
            className={`badge ${!info ? styles.badgeInfo : connected ? "badge-active" : "badge-deleted"}`}
            role="status"
            aria-live="polite"
          >
            {!info ? "Checking..." : connected ? "Connected" : "Disconnected"}
          </span>
          <span className={styles.headerItem}>
            <Server size={15} />
            {info?.server ? (
              <>
                <strong>{info.server.title ?? info.server.name}</strong> <span className={styles.muted}>v{info.server.version}</span>
              </>
            ) : (
              <span className={styles.muted}>Unknown server</span>
            )}
          </span>
          <span className={styles.headerItem}>
            <PlugZap size={15} /> <code>{info?.host ?? "…"}</code>
          </span>
          <span className={styles.demoNotice}>
            <ShieldAlert size={15} /> Local demo only, no authentication
          </span>
        </div>
      </div>

      {info && !connected && (
        <div className={styles.noticeError} role="alert">
          <span className={styles.preWrap}>{info.message ?? "Cannot reach the MCP server."}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin-icon" : undefined} /> Retry
          </button>
        </div>
      )}

      <div className={styles.layout}>
        <section className={styles.mainCol}>
          <div className="tab-bar" role="tablist" aria-label="MCP features">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                id={`mcp-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`mcp-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                className={`tab-btn ${tab === t.id ? "tab-btn-active" : ""}`}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div id={`mcp-panel-${tab}`} role="tabpanel" aria-labelledby={`mcp-tab-${tab}`}>
            {listError && (
              <div className={styles.noticeError} role="alert">
                <span className={styles.preWrap}>{listError}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={refresh} disabled={loading}>
                  Retry
                </button>
              </div>
            )}
            {loading && !info ? (
              <div className={styles.empty}>
                <RefreshCw size={24} className="spin-icon" /> <p>Connecting to MCP server...</p>
              </div>
            ) : !connected ? (
              <div className={styles.empty}>Not connected. Start the API, then press Retry.</div>
            ) : tab === "tools" ? (
              <ToolsTab tools={lists.tools} run={run} />
            ) : tab === "resources" ? (
              <ResourcesTab resources={lists.resources} templates={lists.templates} run={run} />
            ) : tab === "prompts" ? (
              <PromptsTab prompts={lists.prompts} run={run} />
            ) : (
              <AuditLogTab available={lists.resources.some((r) => r.uri === "app://audit/recent")} />
            )}
          </div>
        </section>

        <ResultPanel history={history} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </>
  );
}
