"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Markdown from "@/components/ui/Markdown";

type Message = { role: "user" | "assistant"; content: string };

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const next = [...messages, { role: "user", content: input } as Message];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json();
      const replyText = json.answer || "(no reply)";
      const refs: string[] = Array.isArray(json.context) ? json.context : [];
      const reply: Message = { role: "assistant", content: refs.length ? `${replyText}\n\nRelevant datasets: ${refs.join(", ")}` : replyText };
      setMessages((m) => [...m, reply]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[520px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 space-y-3 overflow-auto p-4">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500">Ask in natural language, e.g., &quot;Find global monthly SST (2000-2020) in NetCDF&quot;</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            {m.role === "user" ? (
              <div className="inline-block max-w-[85%] rounded-lg bg-blue-600 px-3 py-2 text-left text-white">
                {m.content}
              </div>
            ) : (
              <div className="inline-block max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-left text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                <Markdown text={m.content} />
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-sm text-slate-500">Thinking…</div>}
      </div>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask ODFP…" className="flex-1" />
          <Button onClick={send} disabled={loading}>Send</Button>
        </div>
      </div>
    </div>
  );
}
