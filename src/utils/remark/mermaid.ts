import type { Root } from "mdast";
import { visit } from "unist-util-visit";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, "code", (node, index, parent) => {
      if (node.lang !== "mermaid" || !parent || typeof index !== "number") {
        return;
      }
      parent.children[index] = {
        type: "html",
        value: `<div class="mermaid" data-mermaid-source>${escapeHtml(node.value)}</div>`,
      };
    });
  };
}
