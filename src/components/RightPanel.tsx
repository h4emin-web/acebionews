import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pharma-chat`;

const SUGGESTIONS = [
  "세마글루타이드 원료 공급 현황은?",
  "FDA DMF 등록 절차 알려줘",
  "2025년 특허 만료 블록버스터는?",
  "바이오시밀러 개발 트렌드",
];

async function streamChat({
  messages,
  onDelta,
  onDone,
  signal,
}: {
  messages: Msg[];
  onDelta: (t: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "요청 실패");
  }
  if (!resp.body) throw new Error("스트림 없음");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;

  while (!done) {
    const { done: rd, value } = await reader.read();
    if (rd) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  onDone();
}

export const RightPanel = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    abortRef.current = new AbortController();
    const allMsgs = [...messages, userMsg];
    const attempt = async (retry: number): Promise<void> => {
      try {
        await streamChat({
          messages: allMsgs,
          onDelta: upsert,
          onDone: () => setIsLoading(false),
          signal: abortRef.current!.signal,
        });
      } catch (e: any) {
        if (e.name === "AbortError") { setIsLoading(false); return; }
        if (retry > 0) {
          await new Promise(r => setTimeout(r, 1000));
          return attempt(retry - 1);
        }
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message || "오류가 발생했습니다. 다시 시도해주세요."}` }]);
        setIsLoading(false);
      }
    };
    attempt(2);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
  };

  return (
    <div
      className="card-elevated rounded-lg overflow-hidden sticky top-[100px] flex flex-col"
      style={{ maxHeight: "calc(100vh - 120px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-[12px] font-semibold text-foreground">AI 의약 전문가</span>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3" style={{ minHeight: 200 }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[12px] font-medium text-foreground">무엇이든 물어보세요</p>
              <p className="text-[10px] text-muted-foreground">원료의약품, 규제, 특허, 임상 등</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-[300px]">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[10px] px-2.5 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs dark:prose-invert max-w-none [&_p]:text-[11px] [&_p]:leading-relaxed [&_p]:my-1 [&_li]:text-[11px] [&_h1]:text-[13px] [&_h2]:text-[12px] [&_h3]:text-[11px] [&_code]:text-[10px] [&_strong]:font-semibold">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-foreground" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3 h-3 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-2.5 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="질문을 입력하세요..."
            rows={1}
            className="flex-1 resize-none bg-muted rounded-lg px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 max-h-[80px] scrollbar-hide"
            style={{ minHeight: 36 }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
