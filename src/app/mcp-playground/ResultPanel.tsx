"use client";

import { AlertCircle, CheckCircle2, Info, History } from "lucide-react";
import type { CallRecord } from "./mcpApi";
import { CopyButton, JsonView } from "./JsonView";
import styles from "./playground.module.css";

interface ResultPanelProps {
  history: CallRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ResultPanel({ history, selectedId, onSelect }: ResultPanelProps) {
  const current = history.find((h) => h.id === selectedId) ?? history[0];

  return (
    <aside className={`card ${styles.resultPanel}`} aria-label="Result">
      <div className="card-body">
        <div className={styles.panelHead}>
          <h3 className={styles.panelTitle}>Result</h3>
          {current && <CopyButton text={JSON.stringify(current.response, null, 2)} />}
        </div>

        {!current ? (
          <p className={styles.muted}>Call a tool, read a resource or get a prompt to see the response here.</p>
        ) : (
          <>
            <div className={styles.resultMeta}>
              <span className={`badge ${current.info ? styles.badgeInfo : current.ok ? "badge-active" : "badge-deleted"}`}>
                {current.info ? "needs confirmation" : current.ok ? "ok" : "error"}
              </span>
              <span>
                <strong>{current.kind}</strong> <code>{current.name}</code>
              </span>
              <span className={styles.muted}>
                {current.durationMs} ms · HTTP {current.httpStatus || "n/a"}
              </span>
            </div>

            {!current.ok && current.response.message && (
              <div className={current.info ? styles.noticeInfo : styles.noticeError} role={current.info ? "status" : "alert"}>
                {current.info ? <Info size={16} /> : <AlertCircle size={16} />}
                <span className={styles.preWrap}>{current.response.message}</span>
              </div>
            )}
            {current.ok && (
              <div className={styles.noticeSuccess}>
                <CheckCircle2 size={16} /> <span>Call succeeded.</span>
              </div>
            )}

            <details className={styles.details}>
              <summary>Request</summary>
              <JsonView value={current.request} maxHeight={200} />
            </details>
            <JsonView value={current.response} maxHeight={480} />
          </>
        )}

        <div className={styles.historyHead}>
          <History size={15} /> <span>History (last 10)</span>
        </div>
        {history.length === 0 ? (
          <p className={styles.muted}>No calls yet.</p>
        ) : (
          <ul className={styles.historyList}>
            {history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={`${styles.historyItem} ${h.id === current?.id ? styles.historyItemActive : ""}`}
                  onClick={() => onSelect(h.id)}
                  aria-current={h.id === current?.id}
                >
                  <span className={h.info ? styles.dotInfo : h.ok ? styles.dotOk : styles.dotErr} aria-hidden />
                  <span className={styles.historyName}>{h.name}</span>
                  <span className={styles.muted}>{h.time.toLocaleTimeString()}</span>
                  <span className={styles.srOnly}>{h.info ? "needs confirmation" : h.ok ? "ok" : "error"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
