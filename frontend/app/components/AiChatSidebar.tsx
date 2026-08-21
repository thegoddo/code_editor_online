"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleGenAI } from "@google/genai";
import {
  Bot,
  Check,
  ChevronDown,
  Key,
  Send,
  Settings,
  Trash2,
  User,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type ProviderId = "gemini" | "openai" | "anthropic";
type MessageRole = "user" | "assistant";

interface Provider {
  id: ProviderId;
  name: string;
  model: string;
  color: string;
}

interface Message {
  role: MessageRole;
  content: string;
}

interface AiChatSidebarProps {
  currentCode?: string;
  currentLanguage?: string;
}

const markdownComponents = {
  code({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
    const language = /language-(\w+)/.exec(className ?? "")?.[1];

    if (language) {
      return (
        <SyntaxHighlighter
          {...props}
          language={language}
          style={vscDarkPlus}
          PreTag="div"
          className="my-2 rounded-md text-[11px]"
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }

    return (
      <code {...props} className={className}>
        {children}
      </code>
    );
  },
};

const PROVIDERS: Provider[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    model: "gemini-3.6-flash",
    color: "text-blue-400",
  },
  {
    id: "openai",
    name: "OpenAI",
    model: "gpt-4o-mini",
    color: "text-emerald-400",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    model: "claude-3-5-haiku-latest",
    color: "text-orange-400",
  },
];

const keyStorageName = (provider: ProviderId) => `user_${provider}_api_key`;

export default function AiChatSidebar({
  currentCode = "",
  currentLanguage = "python",
}: AiChatSidebarProps) {
  const [providerId, setProviderId] = useState<ProviderId>(() => {
    if (typeof window === "undefined") return "gemini";
    const storedProvider = localStorage.getItem(
      "user_ai_provider",
    ) as ProviderId | null;
    return storedProvider &&
      PROVIDERS.some((item) => item.id === storedProvider)
      ? storedProvider
      : "gemini";
  });
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>(() => {
    if (typeof window === "undefined") return {};
    return PROVIDERS.reduce<Partial<Record<ProviderId, string>>>(
      (result, item) => {
        const key = localStorage.getItem(keyStorageName(item.id));
        if (key) result[item.id] = key;
        return result;
      },
      {},
    );
  });
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const storedProvider = localStorage.getItem(
      "user_ai_provider",
    ) as ProviderId | null;
    const selectedProvider =
      storedProvider && PROVIDERS.some((item) => item.id === storedProvider)
        ? storedProvider
        : "gemini";
    return !localStorage.getItem(keyStorageName(selectedProvider));
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const provider =
    PROVIDERS.find((item) => item.id === providerId) ?? PROVIDERS[0];
  const apiKey = keys[providerId] ?? "";

  const selectProvider = (nextProvider: ProviderId) => {
    setProviderId(nextProvider);
    localStorage.setItem("user_ai_provider", nextProvider);
    setIsProviderOpen(false);
    setIsConfigOpen(!(keys[nextProvider] ?? "").trim());
    setMessages([]);
  };

  const saveApiKey = () => {
    const key = apiKey.trim();
    setKeys((previous) => ({ ...previous, [providerId]: key }));
    if (key) {
      localStorage.setItem(keyStorageName(providerId), key);
      setIsConfigOpen(false);
    } else {
      localStorage.removeItem(keyStorageName(providerId));
    }
  };

  const makePrompt = (question: string) =>
    `You are an expert programming assistant integrated into an online IDE.\nThe user is currently writing in ${currentLanguage}.\nCurrent editor contents:\n\`\`\`${currentLanguage}\n${currentCode}\n\`\`\`\n\nUser question: ${question}`;

  const requestResponse = async (conversation: Message[], question: string) => {
    const prompt = makePrompt(question);
    if (providerId === "gemini") {
      const ai = new GoogleGenAI({ apiKey });
      const responseStream = await ai.models.generateContentStream({
        model: provider.model,
        contents: [
          ...conversation.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          { role: "user", parts: [{ text: prompt }] },
        ],
      });
      let response = "";
      for await (const chunk of responseStream) response += chunk.text ?? "";
      return response;
    }

    const endpoint =
      providerId === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
    const body =
      providerId === "openai"
        ? {
            model: provider.model,
            messages: [...conversation, { role: "user", content: prompt }],
          }
        : {
            model: provider.model,
            max_tokens: 1024,
            messages: [...conversation, { role: "user", content: prompt }],
          };
    const response = await fetch(endpoint, {
      method: "POST",
      headers:
        providerId === "anthropic"
          ? {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true",
            }
          : {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error?.message ??
          data.error?.type ??
          "The provider rejected the request.",
      );
    return providerId === "openai"
      ? data.choices[0].message.content
      : data.content[0].text;
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !apiKey.trim() || isLoading) return;
    const question = input.trim();
    const conversation = [
      ...messages,
      { role: "user" as const, content: question },
    ];
    setInput("");
    setMessages(conversation);
    setIsLoading(true);
    try {
      const response = await requestResponse(messages, question);
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: response },
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate a response.";
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: `**Error:** ${message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <aside className="h-full w-full min-w-0 flex flex-col border-r border-neutral-800 bg-neutral-950 text-neutral-200">
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-sm">
          <Bot className="w-4 h-4 text-blue-400" /> AI Code Assistant
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMessages([])}
            title="Clear chat"
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsConfigOpen((open) => !open)}
            title="API settings"
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-neutral-800">
        <label className="text-[10px] uppercase tracking-wider text-neutral-500">
          AI provider
        </label>
        <div className="relative mt-1.5">
          <button
            onClick={() => setIsProviderOpen((open) => !open)}
            className="w-full flex items-center justify-between rounded border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs hover:border-neutral-500"
          >
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full bg-current ${provider.color}`}
              />
              {provider.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
          </button>
          {isProviderOpen && (
            <div className="absolute z-10 mt-1 w-full rounded border border-neutral-700 bg-neutral-900 p-1 shadow-xl">
              {PROVIDERS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectProvider(item.id)}
                  className="w-full flex items-center justify-between rounded px-2 py-2 text-left text-xs hover:bg-neutral-800"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full bg-current ${item.color}`}
                    />
                    {item.name}
                  </span>
                  {item.id === providerId && (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isConfigOpen && (
        <div className="p-3 bg-neutral-900 border-b border-neutral-800 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-medium text-neutral-300">
            <Key className="w-3.5 h-3.5 text-yellow-500" /> API key for{" "}
            {provider.name}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(event) =>
                setKeys((previous) => ({
                  ...previous,
                  [providerId]: event.target.value,
                }))
              }
              placeholder="Paste API key"
              className="min-w-0 flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={saveApiKey}
              className="rounded bg-blue-600 px-2.5 text-xs text-white hover:bg-blue-500"
            >
              Save
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            Stored only in this browser and sent directly to {provider.name}.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 text-xs px-4 space-y-2">
            <Bot className="w-8 h-8 text-neutral-600" />
            <p>
              {apiKey
                ? `Ask ${provider.name} about your ${currentLanguage} code.`
                : "Select an AI provider and add its API key to start chatting."}
            </p>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <Bot className={`w-4 h-4 mt-1 flex-shrink-0 ${provider.color}`} />
            )}
            <div
              className={`p-2.5 rounded-lg text-xs leading-relaxed max-w-[85%] break-words ${message.role === "user" ? "bg-blue-600 text-white" : "bg-neutral-900 border border-neutral-800 text-neutral-300"}`}
            >
              <ReactMarkdown components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
            {message.role === "user" && (
              <User className="w-4 h-4 text-neutral-400 mt-1 flex-shrink-0" />
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 italic">
            <Bot className={`w-3.5 h-3.5 animate-pulse ${provider.color}`} />{" "}
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-neutral-800 flex gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            apiKey ? "Ask about your code..." : "Add an API key to chat..."
          }
          disabled={!apiKey || isLoading}
          className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || !apiKey}
          title="Send message"
          className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded flex items-center justify-center"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
}
