"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { chatStream } from "@/lib/citypulse";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I\u2019m CityPulse AI Assistant. Ask me about recent reports, issue statuses, or what to do next. I\u2019ll pull incident details in real time when needed.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Re-fetch incidents for freshest data on each message

      const ctxToUse = "";

      // Create an empty assistant message we will fill as chunks arrive.
      // We compute its index from the current state to avoid depending on external variables.
      let assistantIndex = -1;
      setMessages((prev) => {
        assistantIndex = prev.length;
        return [...prev, { role: "assistant", content: "" }];
      });

      await chatStream(userMessage, ctxToUse, (chunk) => {
        setMessages((prev) => {
          if (assistantIndex < 0 || assistantIndex >= prev.length) return prev;
          const next = [...prev];
          const msg = next[assistantIndex];
          if (msg && msg.role === "assistant") {
            next[assistantIndex] = { ...msg, content: msg.content + chunk };
          }
          return next;
        });
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn\u2019t connect to the AI backend. Please make sure the CityPulse server is running at localhost:8000.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl z-50 transition-all hover:scale-110 hover:shadow-xl"
        style={{ backgroundColor: "#09E0F7", color: "#131C15" }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? "\u2715" : "\uD83D\uDCAC"}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 w-[380px] max-w-[calc(100vw-3rem)] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
          style={{ height: "500px", backgroundColor: "#fff" }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center gap-3 shrink-0"
            style={{ backgroundColor: "#131C15" }}
          >
            <span className="text-2xl">🤖</span>
            <div className="flex-1 min-w-0">
              <h4
                className="font-bold text-white text-sm"
                style={{ fontFamily: "'Unbounded', sans-serif" }}
              >
                CityPulse AI
              </h4>
              <p className="text-xs text-gray-400">
                Ask anything about city issues
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors text-lg"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ backgroundColor: "#F4F5F7" }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-1 text-xs"
                    style={{ backgroundColor: "#09E0F7", color: "#131C15" }}>
                    🤖
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user" ? "rounded-br-md" : "rounded-bl-md"
                  }`}
                  style={
                    msg.role === "user"
                      ? { backgroundColor: "#131C15", color: "#fff" }
                      : {
                          backgroundColor: "#fff",
                          color: "#131C15",
                          border: "1px solid rgba(9,224,247,0.3)",
                        }
                  }
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-1 text-xs"
                  style={{ backgroundColor: "#09E0F7", color: "#131C15" }}>
                  🤖
                </div>
                <div
                  className="px-4 py-2.5 rounded-2xl rounded-bl-md text-sm"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid rgba(9,224,247,0.3)",
                  }}
                >
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "#09E0F7", animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "#09E0F7", animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "#09E0F7", animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            className="px-3 py-3 border-t shrink-0"
            style={{ borderColor: "rgba(9,224,247,0.2)" }}
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-opacity-100 transition-colors"
                style={{
                  borderColor: "rgba(9,224,247,0.3)",
                  color: "#131C15",
                }}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#09E0F7", color: "#131C15" }}
              >
                Send
              </button>
            </div>
            <p
              className="text-center mt-2 text-xs"
              style={{ color: "#131C15", opacity: 0.35 }}
            >
              Powered by CityPulse AI · Ollama llama3
            </p>
          </div>
        </div>
      )}
    </>
  );
}
