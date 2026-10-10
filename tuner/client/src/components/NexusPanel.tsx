/**
 * NexusPanel — the Nexus AI presence for OM Tuner.
 *
 * A floating orb (bottom-right) opens a slide-out panel containing a
 * streaming chat conversation with the Nexus AI. The Nexus receives
 * page-level context from wherever the practitioner is in the app,
 * so its responses are always relevant to what is on screen.
 *
 * Architecture mirrors Studio's Nexus (server.py / rose-mirror) but
 * adapted for Node/Express + @anthropic-ai/sdk and React.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

// Must use the same API_BASE as queryClient so Railway proxy rewrites work
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NexusMessage {
  role: "user" | "nexus" | "divider";
  text: string;
}

export interface NexusContextProps {
  /** Plain-text description of what the practitioner is currently viewing */
  pageContext: string;
}

// ─── Page context hook — consumed by page components ────────────────────────

// Global singleton so any page can call setNexusContext() without prop drilling
let _setContext: ((ctx: string) => void) | null = null;

export function setNexusContext(ctx: string) {
  _setContext?.(ctx);
}

// ─── Orb pulsing animation CSS ────────────────────────────────────────────────

const ORB_IDLE = `
  @keyframes nexus-breathe {
    0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.0), 0 0 16px 2px rgba(99,102,241,0.25); }
    50%       { box-shadow: 0 0 0 6px rgba(99,102,241,0.0), 0 0 28px 6px rgba(99,102,241,0.45); }
  }
`;

// ─── Main component ───────────────────────────────────────────────────────────

export default function NexusPanel() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<NexusMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [nexusMemory, setNexusMemory] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [pageContext, setPageContext] = useState("");
  const [hasUnread, setHasUnread] = useState(false);

  const convRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingTextRef = useRef("");
  const prevContextRef = useRef<string>("");

  // Register global context setter — inserts a divider when context shifts
  useEffect(() => {
    _setContext = (ctx: string) => {
      setPageContext(ctx);
      // Extract the first line as a short page label
      const newLabel = ctx.split("\n")[0].trim();
      const prevLabel = prevContextRef.current.split("\n")[0].trim();
      // Only insert a divider if: there's already a conversation, and the
      // page-level label actually changed (ignore sub-state changes on same page)
      if (
        newLabel &&
        prevLabel &&
        newLabel !== prevLabel &&
        !newLabel.startsWith("Sound healing") // ignore reset-to-default
      ) {
        setHistory((h) => {
          if (h.length === 0) return h;
          // Don't stack dividers
          if (h[h.length - 1]?.role === "divider") return h;
          return [...h, { role: "divider", text: newLabel }];
        });
      }
      prevContextRef.current = ctx;
    };
    return () => { _setContext = null; };
  }, []);

  // Load persisted memory on mount
  useEffect(() => {
    apiRequest("GET", "/api/nexus/memory")
      .then((res) => res.json())
      .then((data) => {
        if (data.memory) setNexusMemory(data.memory);
      })
      .catch(() => {});
  }, []);

  // Auto-scroll conversation
  useEffect(() => {
    if (convRef.current) {
      convRef.current.scrollTop = convRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
      setHasUnread(false);
    }
  }, [open]);

  // ─── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const msg = input.trim();
    if (!msg || streaming) return;

    setInput("");
    const userMsg: NexusMessage = { role: "user", text: msg };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setStreaming(true);
    streamingTextRef.current = "";

    // Append streaming placeholder for Nexus reply
    setHistory((h) => [...h, { role: "nexus", text: "" }]);

    try {
      const res = await fetch(`${API_BASE}/api/nexus/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: newHistory.slice(-10),
          pageContext,
          nexusMemory,
        }),
      });

      if (!res.ok) throw new Error("Server error");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      const read = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.chunk) {
                accumulated += d.chunk;
                streamingTextRef.current = accumulated;
                // Update last message in history (the streaming Nexus reply)
                setHistory((h) => {
                  const updated = [...h];
                  updated[updated.length - 1] = { role: "nexus", text: accumulated };
                  return updated;
                });
              }
              if (d.done) {
                // Persist memory update: after 6+ turns, ask Nexus to compress what it knows
                if (newHistory.length >= 6 && newHistory.length % 6 === 0) {
                  compressAndSaveMemory([...newHistory, { role: "nexus", text: accumulated }]);
                }
              }
              if (d.error) {
                setHistory((h) => {
                  const updated = [...h];
                  updated[updated.length - 1] = {
                    role: "nexus",
                    text: "Something interrupted the connection. Try again when you are ready.",
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
      };

      await read();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isApiKey = errMsg.includes("503") || errMsg.includes("ANTHROPIC_API_KEY");
      setHistory((h) => {
        const updated = [...h];
        updated[updated.length - 1] = {
          role: "nexus",
          text: isApiKey
            ? "Nexus is not yet connected — the ANTHROPIC_API_KEY environment variable needs to be set on Railway."
            : `Connection error: ${errMsg}`,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      if (!open) setHasUnread(true);
    }
  }, [input, streaming, history, pageContext, nexusMemory, open]);

  // ─── Memory compression ────────────────────────────────────────────────────
  // Periodically condenses the conversation into a compact practitioner profile
  // stored in SQLite — the same pattern as Studio's nexusMemory.

  const compressAndSaveMemory = useCallback(
    async (msgs: NexusMessage[]) => {
      try {
        const transcript = msgs
          .map((m) => `${m.role === "nexus" ? "Nexus" : "Practitioner"}: ${m.text}`)
          .join("\n");
        const compressionPrompt = `Based on this conversation, write a 3–5 sentence compressed profile of the practitioner: what instruments they use, their experience level, any preferences or patterns you notice, and any clinical or personal context that would help you in future sessions. Be specific, not generic. Return plain text only.\n\nConversation:\n${transcript.slice(0, 3000)}`;

        const res = await fetch(`${API_BASE}/api/nexus/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: compressionPrompt,
            history: [],
            pageContext: "",
            nexusMemory: "",
          }),
        });

        if (!res.ok) return;
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let compressed = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.chunk) compressed += d.chunk;
            } catch {}
          }
        }

        if (compressed) {
          setNexusMemory(compressed);
          await apiRequest("POST", "/api/nexus/memory", { memory: compressed });
        }
      } catch {}
    },
    []
  );

  // ─── Keyboard handler ──────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inject keyframe animation */}
      <style>{ORB_IDLE}</style>

      {/* Floating orb */}
      <button
        data-testid="nexus-orb"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full",
          "bg-primary/90 hover:bg-primary text-white",
          "flex items-center justify-center",
          "transition-all duration-200 hover:scale-110 active:scale-95",
          "shadow-lg shadow-primary/30"
        )}
        style={{ animation: "nexus-breathe 4s ease-in-out infinite" }}
        title="Open Nexus"
      >
        {/* OM symbol */}
        {hasUnread && !open ? (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-background" />
        ) : null}
        <span
          className="text-lg leading-none select-none"
          style={{ fontFamily: "serif", letterSpacing: 0 }}
        >
          ॐ
        </span>
      </button>

      {/* Slide-out panel */}
      <div
        data-testid="nexus-panel"
        className={cn(
          "fixed right-0 top-0 h-full z-50",
          "w-[400px] max-w-[95vw]",
          "flex flex-col",
          "bg-card border-l border-border",
          "shadow-2xl shadow-black/40",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <span
            className="text-xl text-primary"
            style={{ fontFamily: "serif" }}
          >
            ॐ
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">Nexus</div>
            <div className="text-xs text-muted-foreground truncate">
              {pageContext
                ? pageContext.split("\n")[0].slice(0, 50)
                : "Sound healing advisor"}
            </div>
          </div>
          <button
            data-testid="nexus-close"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Memory strip (collapsed by default) */}
        {nexusMemory && (
          <div className="border-b border-border flex-shrink-0">
            <button
              onClick={() => setMemoryOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Sparkles size={11} className="text-primary/60" />
              <span className="flex-1 text-left">What I know about you</span>
              {memoryOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {memoryOpen && (
              <div className="px-5 pb-3 text-xs text-muted-foreground leading-relaxed">
                {nexusMemory}
              </div>
            )}
          </div>
        )}

        {/* Conversation */}
        <div
          ref={convRef}
          data-testid="nexus-conversation"
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {history.length === 0 && (
            <div className="text-xs text-muted-foreground text-center pt-8 leading-relaxed">
              Ask anything about your instruments, sessions,
              <br />
              protocols, or clients.
            </div>
          )}
          {history.map((msg, i) => {
            // ── Divider: page-change marker ──────────────────────────────
            if (msg.role === "divider") {
              return (
                <div key={i} className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[9px] text-muted-foreground/60 font-medium px-1 shrink-0 max-w-[180px] truncate">
                    {msg.text}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              );
            }
            // ── Normal message ───────────────────────────────────────────
            return (
              <div
                key={i}
                className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}
              >
                <span className="text-[10px] text-muted-foreground px-1">
                  {msg.role === "user" ? "You" : "Nexus"}
                </span>
                <div
                  className={cn(
                    "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[88%]",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-foreground"
                  )}
                >
                  {msg.text || (
                    streaming && i === history.length - 1 ? (
                      <span className="inline-flex gap-1 items-center text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-border px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              data-testid="nexus-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Nexus…"
              rows={1}
              disabled={streaming}
              className={cn(
                "flex-1 resize-none rounded-lg border border-border bg-background",
                "px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1 focus:ring-primary/50",
                "disabled:opacity-50 transition-colors",
                "min-h-[38px] max-h-[120px] overflow-y-auto"
              )}
              style={{ height: "38px", lineHeight: "1.5" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "38px";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              data-testid="nexus-send"
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className={cn(
                "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed",
                "transition-all active:scale-95"
              )}
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
