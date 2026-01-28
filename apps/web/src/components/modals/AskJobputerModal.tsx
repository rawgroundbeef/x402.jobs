"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@x402jobs/ui/button";
import { ChatInput } from "@x402jobs/ui/chat-input";
import {
  X,
  Loader2,
  User,
  DollarSign,
  Trash2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import { JOBPUTER_HELP_COST, JOBPUTER_AVATAR_URL } from "@/lib/config";
import { AnimatedDialog, AnimatedDialogContent } from "@x402jobs/ui/dialog";

interface Message {
  role: "user" | "assistant";
  content: string;
  txSignature?: string; // Solana transaction signature for paid messages
}

const CHAT_STORAGE_KEY = "x402-jobputer-chat";

// Load chat from localStorage
function loadChatHistory(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save chat to localStorage
function saveChatHistory(messages: Message[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (e) {
    console.error("Failed to save chat history:", e);
  }
}

interface AskJobputerModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance?: number;
}

const DEFAULT_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hey! I'm Jobputer 🤖 Ask me anything about building workflows, using resources, or how x402.jobs works.",
};

export function AskJobputerModal({
  isOpen,
  onClose,
  walletBalance = 0,
}: AskJobputerModalProps) {
  const [messages, setMessages] = useState<Message[]>([DEFAULT_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  // Load chat history from localStorage on first open
  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      const savedMessages = loadChatHistory();
      if (savedMessages.length > 0) {
        setMessages([DEFAULT_MESSAGE, ...savedMessages]);
      }
      hasLoadedRef.current = true;
    }
  }, [isOpen]);

  // Save chat history when messages change (skip the default message)
  useEffect(() => {
    if (hasLoadedRef.current && messages.length > 1) {
      // Save all messages except the first default one
      saveChatHistory(messages.slice(1));
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleClearHistory = () => {
    setMessages([DEFAULT_MESSAGE]);
    saveChatHistory([]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Call our API which will handle the x402 payment to Jobputer
      const res = await authenticatedFetch("/ask-jobputer", {
        method: "POST",
        body: JSON.stringify({ question: userMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      // Add assistant response with tx link
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          txSignature: data.txSignature,
        },
      ]);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Something went wrong";
      setError(errorMsg);
      // Remove the user message if we failed
      setMessages((prev) => prev.slice(0, -1));
      setInput(userMessage); // Restore input
    } finally {
      setIsLoading(false);
    }
  };

  const hasInsufficientBalance = walletBalance < JOBPUTER_HELP_COST;

  return (
    <AnimatedDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatedDialogContent
        className="max-w-2xl p-0 gap-0 h-[min(700px,calc(100vh-4rem))] flex flex-col overflow-hidden"
        showClose={false}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center gap-2">
            <img
              src={JOBPUTER_AVATAR_URL}
              alt="Jobputer"
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                // Fallback to icon if image fails
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <h2 className="font-semibold">Ask Jobputer</h2>
              <p className="text-xs text-muted-foreground flex items-center">
                <DollarSign className="h-3 w-3 -mr-0.5" />
                {JOBPUTER_HELP_COST.toFixed(2)} per question
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearHistory}
                title="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className="space-y-0.5">
              <div
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <img
                    src={JOBPUTER_AVATAR_URL}
                    alt="Jobputer"
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-1"
                  />
                )}
                <div
                  className={`max-w-[85%] min-w-0 rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="overflow-hidden [word-break:break-word]">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0 break-words">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc list-inside mb-2 space-y-1">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal list-inside mb-2 space-y-1">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => <li>{children}</li>,
                          code: ({ children }) => (
                            <code className="bg-background/50 px-1 py-0.5 rounded text-xs font-mono break-all">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-background/50 p-2 rounded my-2 overflow-auto text-xs max-h-48 whitespace-pre-wrap break-words">
                              {children}
                            </pre>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold">
                              {children}
                            </strong>
                          ),
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span className="[word-break:break-word]">
                      {msg.content}
                    </span>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="h-3 w-3" />
                  </div>
                )}
              </div>
              {/* Actions for assistant messages (copy + tx link) */}
              {msg.role === "assistant" && i > 0 && (
                <div className="flex justify-start pl-8 gap-2 pt-1">
                  {/* Transaction link */}
                  {msg.txSignature ? (
                    <a
                      href={`https://solscan.io/tx/${msg.txSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      tx
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50">
                      ${JOBPUTER_HELP_COST.toFixed(2)}
                    </span>
                  )}
                  {/* Copy button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      setCopiedIdx(i);
                      setTimeout(() => setCopiedIdx(null), 2000);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
                  >
                    {copiedIdx === i ? (
                      <>
                        <Check className="h-2.5 w-2.5 text-green-500" />
                        copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-2.5 w-2.5" />
                        copy
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2 justify-start">
              <img
                src={JOBPUTER_AVATAR_URL}
                alt="Jobputer"
                className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-1"
              />
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 pb-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border">
          {hasInsufficientBalance ? (
            <p className="text-sm text-center text-muted-foreground">
              Insufficient balance. Need at least $
              {JOBPUTER_HELP_COST.toFixed(2)} USDC.
            </p>
          ) : (
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSend}
              placeholder="Ask about workflows, resources, pricing..."
              disabled={hasInsufficientBalance}
              isLoading={isLoading}
              maxRows={4}
            />
          )}
        </div>
      </AnimatedDialogContent>
    </AnimatedDialog>
  );
}
