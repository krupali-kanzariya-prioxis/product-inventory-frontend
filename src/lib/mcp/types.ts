// Shared between route handlers and the playground UI (no server-only imports here).

export interface McpFailure {
  ok: false;
  message: string;
  code?: number;
  unreachable?: boolean;
}

export interface JsonSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  format?: string;
  default?: unknown;
  anyOf?: JsonSchemaProperty[];
  oneOf?: JsonSchemaProperty[];
  minimum?: number;
  maximum?: number;
}

export interface ToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema: {
    type?: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export interface ResourceInfo {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceTemplateInfo {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface PromptInfo {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
}

export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface ToolCallResult {
  content?: ContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface ServerInfoResponse {
  ok: true;
  connected: boolean;
  host: string;
  server?: { name: string; version: string; title?: string };
  capabilities?: Record<string, unknown>;
  instructions?: string;
}
