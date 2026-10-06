"use client";

import { useState } from "react";
import { MessageSquareText, RefreshCw, Info } from "lucide-react";
import type { PromptInfo } from "@/lib/mcp/types";
import type { RunFn } from "./ToolsTab";
import { CopyButton } from "./JsonView";
import styles from "./playground.module.css";

interface PromptMessage {
  role: string;
  content: { type: string; text?: string; resource?: { uri?: string; text?: string } };
}

function messageText(m: PromptMessage): string {
  if (m.content?.type === "text") return m.content.text ?? "";
  if (m.content?.type === "resource") return m.content.resource?.text ?? `[resource ${m.content.resource?.uri ?? ""}]`;
  return `[${m.content?.type ?? "unknown"} content]`;
}

export default function PromptsTab({ prompts, run }: { prompts: PromptInfo[]; run: RunFn }) {
  const [args, setArgs] = useState<Record<string, Record<string, string>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [output, setOutput] = useState<{ name: string; messages: PromptMessage[] } | null>(null);

  async function getPrompt(p: PromptInfo) {
    const current = args[p.name] ?? {};
    const missing = (p.arguments ?? []).filter((a) => a.required && !current[a.name]?.trim()).map((a) => a.name);
    if (missing.length) {
      setErrors((e) => ({ ...e, [p.name]: `Required: ${missing.join(", ")}` }));
      return;
    }
    setErrors((e) => ({ ...e, [p.name]: "" }));
    const sent: Record<string, string> = {};
    for (const [k, v] of Object.entries(current)) if (v.trim()) sent[k] = v.trim();

    setBusy(p.name);
    try {
      const rec = await run("prompt", p.name, "prompts/get", { name: p.name, arguments: sent });
      const result = rec.response.result as { messages?: PromptMessage[] } | undefined;
      setOutput(rec.ok ? { name: p.name, messages: result?.messages ?? [] } : null);
    } finally {
      setBusy(null);
    }
  }

  if (prompts.length === 0) {
    return <div className={styles.empty}>The server exposes no prompts.</div>;
  }

  const outputText = output?.messages.map((m) => `[${m.role}]\n${messageText(m)}`).join("\n\n") ?? "";

  return (
    <div className={styles.stack}>
      <div className={styles.noticeInfo}>
        <Info size={16} /> <span>A prompt returns text for an AI to use; nothing is executed.</span>
      </div>

      <ul className={styles.cardList}>
        {prompts.map((p) => (
          <li key={p.name} className="card">
            <div className="card-body">
              <code className={styles.itemName}>{p.name}</code>
              {p.description && <p className={styles.itemDesc}>{p.description}</p>}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void getPrompt(p);
                }}
              >
                {(p.arguments ?? []).length > 0 && (
                  <div className="form-grid form-grid-2">
                    {(p.arguments ?? []).map((a) => {
                      const id = `p-${p.name}-${a.name}`;
                      return (
                        <div className="form-group" key={a.name}>
                          <label className="form-label" htmlFor={id}>
                            {a.name} {a.required ? <span className="required">*</span> : <span className={styles.optionalTag}>optional</span>}
                          </label>
                          <input
                            id={id}
                            className="form-input"
                            type={/date$/i.test(a.name) ? "date" : "text"}
                            value={args[p.name]?.[a.name] ?? ""}
                            onChange={(e) => setArgs((s) => ({ ...s, [p.name]: { ...(s[p.name] ?? {}), [a.name]: e.target.value } }))}
                          />
                          {a.description && <div className="form-hint">{a.description}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors[p.name] && <div className="form-error">{errors[p.name]}</div>}
                <div className={styles.formActions}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy !== null}>
                    {busy === p.name ? <RefreshCw size={14} className="spin-icon" /> : <MessageSquareText size={14} />} Get Prompt
                  </button>
                </div>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {output && (
        <section className="card">
          <div className="card-body">
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>
                Prompt text: <code>{output.name}</code>
              </h3>
              <CopyButton text={outputText} label="Copy text" />
            </div>
            {output.messages.length === 0 ? (
              <p className={styles.muted}>The prompt returned no messages.</p>
            ) : (
              output.messages.map((m, i) => (
                <div key={i} className={styles.promptMessage}>
                  <span className="badge badge-in">{m.role}</span>
                  <pre className={styles.promptText}>{messageText(m)}</pre>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
