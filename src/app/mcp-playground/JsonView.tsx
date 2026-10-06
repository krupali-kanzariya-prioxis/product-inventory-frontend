"use client";

import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import { copyText } from "./mcpApi";
import styles from "./playground.module.css";

const TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function tokenClass(token: string): string {
  if (token.startsWith('"')) return token.trimEnd().endsWith(":") ? styles.jsonKey : styles.jsonString;
  if (token === "true" || token === "false") return styles.jsonBool;
  if (token === "null") return styles.jsonNull;
  return styles.jsonNumber;
}

/** Colorised JSON rendered as React text nodes (never as HTML). */
export function JsonView({ value, maxHeight }: { value: unknown; maxHeight?: number }) {
  const text = JSON.stringify(value, null, 2) ?? "undefined";
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <span key={i++} className={tokenClass(m[0])}>
        {m[0]}
      </span>
    );
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <pre className={styles.codeBlock} style={maxHeight ? { maxHeight } : undefined}>
      {parts}
    </pre>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={async () => {
        if (await copyText(text)) toast.success("Copied to clipboard");
        else toast.error("Copy failed");
      }}
    >
      <Copy size={14} /> {label}
    </button>
  );
}
