"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const QUICK_PROMPTS = [
  "What's my portfolio worth right now?",
  "Show me my top 5 holdings by value",
  "What's my asset class breakdown?",
  "How diversified am I across currencies?",
];

const transport = new DefaultChatTransport({ api: "/api/chat" });

function ChatContent({ initialMessages }: { initialMessages: UIMessage[] }) {
  const [input, setInput] = useState("");
  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport,
    messages: initialMessages,
  });

  const isLoading = status === "streaming" || status === "submitted";
  const prevStatusRef = useRef(status);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist new messages when streaming completes
  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    prevStatusRef.current = status;

    if (wasStreaming && status === "ready" && messages.length >= 2) {
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      const lastUser = [...messages].reverse().find((m) => m.role === "user");

      const userText = lastUser?.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n\n");
      const assistantText = lastAssistant?.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n\n");

      if (userText && assistantText) {
        fetch("/api/chat/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userMessage: userText, assistantMessage: assistantText }),
        }).catch(() => {});
      }
    }
  }, [status, messages]);

  const chatDisabled =
    error?.message?.includes("OPENAI_API_KEY") ||
    error?.message?.includes("503");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading || chatDisabled) return;
    sendMessage({ text: input });
    setInput("");
  }

  function handleQuickPrompt(prompt: string) {
    if (chatDisabled) return;
    sendMessage({ text: prompt });
  }

  async function handleClearChat() {
    await fetch("/api/chat/history", { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {chatDisabled && (
        <div className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          Chat is disabled — OPENAI_API_KEY is not configured. Add it to
          your .env file and restart the server.
        </div>
      )}

      {error && !chatDisabled && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message || "Something went wrong. Please try again."}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && !chatDisabled && (
          <div className="py-12 text-center">
            <h2 className="mb-2 text-2xl font-bold">Portfolio Copilot</h2>
            <p className="mb-8 text-muted-foreground">
              Ask me anything about your portfolio
            </p>
            <div className="mx-auto grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="rounded-lg border p-4 text-left text-base transition-colors active:bg-muted md:p-3 md:text-sm md:hover:bg-muted"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  if (message.role === "user") {
                    return (
                      <div
                        key={i}
                        className="whitespace-pre-wrap text-sm leading-relaxed"
                      >
                        {part.text}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="chat-markdown prose prose-sm dark:prose-invert max-w-none"
                    >
                      <Markdown remarkPlugins={[remarkGfm]}>
                        {part.text}
                      </Markdown>
                    </div>
                  );
                }
                if (isToolUIPart(part)) {
                  if (part.state === "output-available") return null;
                  return (
                    <p
                      key={i}
                      className="text-sm italic text-muted-foreground"
                    >
                      Fetching portfolio data...
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-4 py-3">
              <span className="animate-pulse text-sm text-muted-foreground">
                Thinking...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t pt-4 pb-[env(safe-area-inset-bottom)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            chatDisabled
              ? "Chat is disabled (no API key)"
              : "Ask about your portfolio..."
          }
          className="flex-1 rounded-lg border bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 md:text-sm"
          disabled={isLoading || chatDisabled}
        />
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            disabled={isLoading}
            className="rounded-lg border px-3 py-3 text-base text-muted-foreground transition-colors active:bg-muted md:text-sm md:hover:bg-muted disabled:opacity-50"
          >
            Clear
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || !input.trim() || chatDisabled}
          className="rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors active:bg-primary/90 md:text-sm md:hover:bg-primary/90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null
  );

  useEffect(() => {
    fetch("/api/chat/history")
      .then((res) => res.json())
      .then((msgs) => setInitialMessages(msgs))
      .catch(() => setInitialMessages([]));
  }, []);

  if (initialMessages === null) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading chat...
      </div>
    );
  }

  return <ChatContent initialMessages={initialMessages} />;
}
