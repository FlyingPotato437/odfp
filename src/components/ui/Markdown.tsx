"use client";
// Lightweight markdown renderer without external deps.
// Supports: headings, lists, bold/italic, links, code, code blocks.
import React from "react";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mdToHtml(src: string): string {
  if (!src) return "";
  // Normalize line endings
  let text = src.replace(/\r\n?/g, "\n");

  // Code blocks ```
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    return `<pre class=\"md-pre\"><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code `code`
  text = text.replace(/`([^`]+?)`/g, (_, code) => `<code class=\"md-code\">${escapeHtml(code)}</code>`);

  // Headings
  text = text.replace(/^###\s+(.+)$/gm, '<h3 class="md-h md-h3">$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h2 class="md-h md-h2">$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h1 class="md-h md-h1">$1</h1>');

  // Bold and italics
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');

  // Lists: group consecutive list lines
  const lines = text.split(/\n/);
  const out: string[] = [];
  let inUl = false, inOl = false;
  const flushLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ul = /^\s*[-*]\s+(.+)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (ul) {
      if (!inUl) { flushLists(); out.push('<ul class="md-ul">'); inUl = true; }
      out.push(`<li>${ul[1]}</li>`);
      continue;
    }
    if (ol) {
      if (!inOl) { flushLists(); out.push('<ol class="md-ol">'); inOl = true; }
      out.push(`<li>${ol[1]}</li>`);
      continue;
    }
    // Normal paragraph or already-tagged line
    flushLists();
    if (/^\s*$/.test(line)) { out.push(''); continue; }
    if (/^<h[1-3]|^<pre|^<ul|^<ol|^<li|^<p|^<blockquote|^<code/.test(line)) {
      out.push(line);
    } else {
      out.push(`<p>${line}</p>`);
    }
  }
  flushLists();

  return out.join('\n');
}

export function Markdown({ text }: { text: string }) {
  const html = mdToHtml(text);
  return (
    <div
      className="markdown space-y-3 leading-relaxed text-slate-800 dark:text-slate-200"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default Markdown;

