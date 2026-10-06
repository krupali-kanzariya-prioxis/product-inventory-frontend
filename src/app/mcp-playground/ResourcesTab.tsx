"use client";

import { useState } from "react";
import { BookOpen, RefreshCw } from "lucide-react";
import type { ResourceInfo, ResourceTemplateInfo } from "@/lib/mcp/types";
import type { RunFn } from "./ToolsTab";
import styles from "./playground.module.css";

function templateVars(template: string): string[] {
  return [...template.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

export default function ResourcesTab({
  resources,
  templates,
  run,
}: {
  resources: ResourceInfo[];
  templates: ResourceTemplateInfo[];
  run: RunFn;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [vars, setVars] = useState<Record<string, Record<string, string>>>({});

  async function read(key: string, name: string, uri: string) {
    setBusyKey(key);
    try {
      await run("resource", name, "resources/read", { uri });
    } finally {
      setBusyKey(null);
    }
  }

  if (resources.length === 0 && templates.length === 0) {
    return <div className={styles.empty}>The server exposes no resources.</div>;
  }

  return (
    <div className={styles.stack}>
      <section>
        <h3 className={styles.sectionTitle}>Resources</h3>
        {resources.length === 0 ? (
          <p className={styles.muted}>No fixed resources.</p>
        ) : (
          <ul className={styles.cardList}>
            {resources.map((r) => (
              <li key={r.uri} className="card">
                <div className={`card-body ${styles.resourceRow}`}>
                  <div>
                    <div className={styles.itemHead}>
                      <code className={styles.itemName}>{r.uri}</code>
                      {r.mimeType && <span className="badge badge-in">{r.mimeType}</span>}
                    </div>
                    <div className={styles.muted}>{r.name}</div>
                    {r.description && <p className={styles.itemDesc}>{r.description}</p>}
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busyKey !== null} onClick={() => read(r.uri, r.name, r.uri)}>
                    {busyKey === r.uri ? <RefreshCw size={14} className="spin-icon" /> : <BookOpen size={14} />} Read
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Resource templates</h3>
        {templates.length === 0 ? (
          <p className={styles.muted}>No resource templates.</p>
        ) : (
          <ul className={styles.cardList}>
            {templates.map((t) => {
              const names = templateVars(t.uriTemplate);
              const current = vars[t.uriTemplate] ?? {};
              const missing = names.some((n) => !current[n]?.trim());
              const uri = names.reduce((u, n) => u.replace(`{${n}}`, encodeURIComponent(current[n]?.trim() ?? "")), t.uriTemplate);
              return (
                <li key={t.uriTemplate} className="card">
                  <div className="card-body">
                    <div className={styles.itemHead}>
                      <code className={styles.itemName}>{t.uriTemplate}</code>
                      {t.mimeType && <span className="badge badge-in">{t.mimeType}</span>}
                    </div>
                    <div className={styles.muted}>{t.name}</div>
                    {t.description && <p className={styles.itemDesc}>{t.description}</p>}
                    <form
                      className={styles.loadRow}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!missing) void read(t.uriTemplate, t.name, uri);
                      }}
                    >
                      {names.map((n) => (
                        <input
                          key={n}
                          className="form-input"
                          placeholder={n}
                          aria-label={n}
                          value={current[n] ?? ""}
                          onChange={(e) => setVars((v) => ({ ...v, [t.uriTemplate]: { ...current, [n]: e.target.value } }))}
                        />
                      ))}
                      <button type="submit" className="btn btn-primary btn-sm" disabled={missing || busyKey !== null}>
                        {busyKey === t.uriTemplate ? <RefreshCw size={14} className="spin-icon" /> : <BookOpen size={14} />} Read
                      </button>
                    </form>
                    <div className="form-hint">
                      URI: <code>{missing ? t.uriTemplate : uri}</code>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
