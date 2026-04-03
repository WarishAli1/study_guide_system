"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Sparkles, Plus } from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import { chatAPI } from "@/lib/api";
import type { ChatResponseData } from "@/lib/api";
import type { Session, ChatMessage } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { MessageBubble } from "./Citation";

interface Props { session: Session; }

export default function ChatView({ session }: Props) {
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const {
        activeConversationId, createConversation, addMessageToConversation,
        setActiveConversation, getActiveConversation,
        pendingChatPrompt, setPendingChatPrompt,
        setActiveView,
    } = useSessionStore();

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pendingHandled = useRef(false);

    const activeConv = getActiveConversation();
    const messages = activeConv?.messages || [];
    const hasNotes = session.documents.some(
        (d) => d.type === "notes" && d.status === "success"
    );

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            if (messagesContainerRef.current)
                messagesContainerRef.current.scrollTop =
                    messagesContainerRef.current.scrollHeight;
        });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);

    useEffect(() => {
        if (pendingChatPrompt && !pendingHandled.current) {
            pendingHandled.current = true;
            setMessage(pendingChatPrompt);
            setPendingChatPrompt(null);
            setTimeout(() => {
                textareaRef.current?.focus();
                if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                    textareaRef.current.style.height =
                        Math.min(textareaRef.current.scrollHeight, 120) + "px";
                }
            }, 100);
        }
    }, [pendingChatPrompt, setPendingChatPrompt]);

    useEffect(() => {
        return () => { pendingHandled.current = false; };
    }, []);

    const handleNewChat = () => {
        setActiveConversation(null);
        setMessage("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        setTimeout(() => textareaRef.current?.focus(), 100);
    };

    const sendMessage = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || isLoading) return;

            let convId = activeConversationId;
            if (!convId) {
                const newConv = createConversation(session.id);
                convId = newConv.id;
            }

            const userMsg: ChatMessage = {
                id: uuidv4(),
                role: "user",
                content: trimmed,
                timestamp: new Date().toISOString(),
            };

            addMessageToConversation(session.id, convId, userMsg);
            setMessage("");
            if (textareaRef.current) textareaRef.current.style.height = "auto";
            setIsLoading(true);

            try {
                const currentConv = session.conversations.find((c) => c.id === convId);
                const history = (currentConv?.messages || [])
                    .slice(-10)
                    .map((m) => ({ role: m.role, content: m.content }));

                const res = await chatAPI.send({
                    message: trimmed,
                    subject: session.name,
                    history,
                });

                const data: ChatResponseData = res.data;
                const sources = data.sources.map((source) => ({
                    ...source,
                    source_text: source.source_text ?? "",
                }));

                const assistantMsg: ChatMessage = {
                    id: uuidv4(),
                    role: "assistant",
                    content: data.answer,
                    timestamp: new Date().toISOString(),
                    sources,
                    relatedQuestions: data.related_questions,
                    inlineQuestion: data.inline_question ?? undefined,
                };

                addMessageToConversation(session.id, convId, assistantMsg);
            } catch (err: any) {
                const errorText =
                    err?.response?.data?.detail ||
                    "Sorry, I couldn't generate a response.";
                addMessageToConversation(session.id, convId, {
                    id: uuidv4(),
                    role: "assistant",
                    content: `⚠️ ${typeof errorText === "string" ? errorText : "An error occurred."
                        }`,
                    timestamp: new Date().toISOString(),
                });
            } finally {
                setIsLoading(false);
            }
        },
        [
            isLoading,
            activeConversationId,
            session.id,
            session.name,
            session.conversations,
            createConversation,
            addMessageToConversation,
        ]
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(message);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 bg-[#F8FAFF]">
            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[300px]">
                        <div className="text-center max-w-md px-6">
                            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-800 mb-2">
                                {activeConv
                                    ? "Continue your conversation"
                                    : "Ask your documents anything"}
                            </h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                {hasNotes
                                    ? "Answers are grounded in your uploaded course materials with citations."
                                    : "Upload notes first to get answers grounded in your materials."}
                            </p>
                            {!hasNotes && (
                                <div className="mt-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 inline-block">
                                    <p className="text-xs text-amber-700">No notes uploaded yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                onNavigateToQuiz={() => setActiveView("quiz")}
                            />
                        ))}
                        {isLoading && (
                            <div className="py-2">
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 w-fit">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                    <span className="text-sm text-blue-600">
                                        Searching notes & generating answer…
                                    </span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="shrink-0 bg-white border-t border-blue-50 px-4 pb-4 pt-3">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-end gap-2 bg-white border border-blue-100 rounded-xl px-3 py-2 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
                        <textarea
                            ref={textareaRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                hasNotes
                                    ? "Ask about your documents…"
                                    : "Upload notes for grounded answers…"
                            }
                            rows={1}
                            disabled={isLoading}
                            className="flex-1 bg-transparent outline-none text-sm resize-none py-1 placeholder:text-slate-300 text-slate-800 max-h-[120px]"
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = "auto";
                                target.style.height =
                                    Math.min(target.scrollHeight, 120) + "px";
                            }}
                        />
                        <button
                            onClick={() => sendMessage(message)}
                            disabled={!message.trim() || isLoading}
                            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-1.5 text-center">
                        Press <kbd className="font-mono">Enter</kbd> to send ·{" "}
                        <kbd className="font-mono">Shift+Enter</kbd> for new line
                    </p>
                </div>
            </div>
        </div>
    );
}