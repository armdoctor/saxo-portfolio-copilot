"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const QUICK_PROMPTS = [
  "What's my portfolio worth right now?",
  "Show me my top 5 holdings by value",
  "What's my asset class breakdown?",
  "How diversified am I across currencies?",
];

const transport = new DefaultChatTransport({ api: "/api/chat" });

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  // Check if the error indicates chat is disabled (no API key)
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
                  className="rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted"
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
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t pt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            chatDisabled
              ? "Chat is disabled (no API key)"
              : "Ask about your portfolio..."
          }
          className="flex-1 rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          disabled={isLoading || chatDisabled}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || chatDisabled}
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
