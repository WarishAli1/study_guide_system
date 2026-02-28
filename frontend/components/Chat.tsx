"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Send,
    Loader2,
    Sparkles,
    Plus,
} from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import { chatAPI } from "@/lib/api";
import type { ChatResponseData } from "@/lib/api";
import type {
    Session,
    ChatMessage,
} from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { MessageBubble } from "./Citation";

interface Props {
    session: Session;
}

export default function ChatView({ session }: Props) {
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const {
        activeConversationId,
        createConversation,
        addMessageToConversation,
        setActiveConversation,
        getActiveConversation,
        pendingChatPrompt,
        setPendingChatPrompt,
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
            if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop =
                    messagesContainerRef.current.scrollHeight;
            }
        });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages.length, scrollToBottom]);

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
        return () => {
            pendingHandled.current = false;
        };
    }, []);

    const handleNewChat = () => {
        setActiveConversation(null);
        setMessage("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
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
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }

            setIsLoading(true);
            try {
                const currentConv = session.conversations.find(
                    (c) => c.id === convId
                );
                const history = (currentConv?.messages || [])
                    .slice(-10)
                    .map((m) => ({
                        role: m.role,
                        content: m.content,
                    }));

                const res = await chatAPI.send({
                    message: trimmed,
                    subject: session.name,
                    history,
                });

                const data: ChatResponseData = res.data;

                const assistantMsg: ChatMessage = {
                    id: uuidv4(),
                    role: "assistant",
                    content: data.answer,
                    timestamp: new Date().toISOString(),
                    sources: data.sources,
                    relatedQuestions: data.related_questions,
                };
                addMessageToConversation(session.id, convId, assistantMsg);
            } catch (err: any) {
                const errorText =
                    err?.response?.data?.detail ||
                    "Sorry, I couldn't generate a response. Please try again.";
                const errorMsg: ChatMessage = {
                    id: uuidv4(),
                    role: "assistant",
                    content: `⚠️ ${typeof errorText === "string" ? errorText : "An error occurred."}`,
                    timestamp: new Date().toISOString(),
                };
                addMessageToConversation(session.id, convId, errorMsg);
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
        <div className="flex flex-col h-full min-h-0">


            {/* Messages */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto min-h-0"
            >
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[300px]">
                        <div className="text-center max-w-md px-6">
                            <Sparkles className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                            <h3 className="text-base font-medium text-neutral-700 mb-1">
                                {activeConv
                                    ? "Continue your conversation"
                                    : "Start a new chat"}
                            </h3>
                            <p className="text-sm text-neutral-400">
                                {hasNotes
                                    ? "Your answers will be grounded in your uploaded course materials with citations."
                                    : "Upload notes first to get the best answers grounded in your materials."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
                        {messages.map((msg) => (
                            <MessageBubble key={msg.id} message={msg} />
                        ))}
                        {isLoading && (
                            <div className="py-2">
                                <div className="flex items-center gap-2 text-sm text-neutral-400">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Searching notes & generating answer…
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="shrink-0 bg-white px-4 pb-4 pt-2">
                <div className="max-w-3xl mx-auto">
                    <div
                        className="flex items-end gap-2 bg-neutral-50 border border-neutral-200
              rounded-xl px-3 py-2 focus-within:border-neutral-400
              focus-within:bg-white transition-all"
                    >
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
                            className="flex-1 bg-transparent outline-none text-sm resize-none
                py-1 placeholder:text-neutral-400
                disabled:opacity-50 disabled:cursor-not-allowed"
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
                            className="p-1.5 rounded-lg bg-neutral-900 text-white
                hover:bg-neutral-800 disabled:opacity-20
                disabled:cursor-not-allowed transition-colors shrink-0 mb-0.5"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}