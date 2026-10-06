import type { Metadata } from "next";
import McpPlayground from "./McpPlayground";

export const metadata: Metadata = {
  title: "MCP Playground | Product Inventory Tracker",
};

export default function McpPlaygroundPage() {
  return <McpPlayground />;
}
