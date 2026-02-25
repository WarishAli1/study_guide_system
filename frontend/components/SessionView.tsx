"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Send,
    FileText,
    CheckCircle2,
    Circle,
    Loader2,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    Sparkles,
} from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import { chatAPI } from "@/lib/api";
import type { ChatResponseData } from "@/lib/api";
import FileUploadCard from "./FileUploadCard";
import StudyGuideView from "./StudyGuideView";
import type {
    Session,
    ChatMessage,
    ChatSource,
} from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

interface Props {
    session: Session;
}

export default function SessionView({ session }: Props) {
    const { activeView } = useSessionStore();

    return (
        <div className="flex flex-col h-full">
            {activeView === "dashboard" && <SessionDashboard session={session} />}
            {activeView === "documents" && <DocumentsView session={session} />}
            {activeView === "chat" && <ChatView session={session} />}
            {activeView === "guide" && <StudyGuideView session={session} />}
        </div>
    );
}

/* ─── Session Dashboard ──────────────────────────────────────────────── */

function SessionDashboard({ session }: { session: Session }) {
    const { setActiveView } = useSessionStore();

    const totalDocs = session.documents.filter((d) => d.status === "success").length;
    const hasSyllabus = session.documents.some(
        (d) => d.type === "syllabus" && d.status === "success"
    );
    const hasGuide = session.cachedGuide !== null;

    const steps = [
        {
            id: "create",
            label: "Create Session",
            description: "Set up your study session",
            done: true,
            action: undefined,
        },
        {
            id: "ingest",
            label: "Ingest Documents",
            description: "Upload syllabus, notes, and past papers",
            done: totalDocs > 0,
            action: () => setActiveView("documents"),
        },
        {
            id: "guide",
            label: "Get Study Insights",
            description: "Generate a study guide from your materials",
            done: hasGuide,
            action: hasSyllabus || hasGuide ? () => setActiveView("guide") : undefined,
        },
        {
            id: "chat",
            label: "Chat With Your Documents",
            description: "Ask questions and get course based answers",
            done: false,
            action: () => setActiveView("chat"),
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto px-6 py-12">
                <div className="mb-10">
                    <h1 className="text-xl font-semibold text-neutral-900 mb-1">
                        {session.name}
                    </h1>
                    {session.description && (
                        <p className="text-sm text-neutral-500">{session.description}</p>
                    )}
                    {totalDocs > 0 && (
                        <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {totalDocs} document{totalDocs !== 1 ? "s" : ""} uploaded
                        </p>
                    )}
                </div>

                <div className="relative">
                    {steps.map((step, index) => {
                        const isLast = index === steps.length - 1;
                        const isClickable = !!step.action;
                        return (
                            <div key={step.id} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className="relative z-10">
                                        {step.done ? (
                                            <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full border-2 border-neutral-300 bg-white flex items-center justify-center">
                                                <Circle className="w-3 h-3 text-neutral-300" />
                                            </div>
                                        )}
                                    </div>
                                    {!isLast && (
                                        <div
                                            className={`w-px flex-1 min-h-[48px] ${step.done ? "bg-neutral-900" : "bg-neutral-200"
                                                }`}
                                        />
                                    )}
                                </div>
                                <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
                                    <div
                                        onClick={step.action}
                                        className={`pt-1 rounded-lg px-3 py-2 -mx-3 -mt-1 transition-colors ${isClickable ? "cursor-pointer hover:bg-neutral-50" : ""
                                            }`}
                                    >
                                        <h3
                                            className={`text-sm font-medium ${step.done
                                                    ? "text-neutral-900"
                                                    : isClickable
                                                        ? "text-neutral-700"
                                                        : "text-neutral-400"
                                                }`}
                                        >
                                            {step.label}
                                        </h3>
                                        <p
                                            className={`text-xs mt-0.5 ${isClickable ? "text-neutral-500" : "text-neutral-400"
                                                }`}
                                        >
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ─── Documents View ─────────────────────────────────────────────────── */

function DocumentsView({ session }: { session: Session }) {
    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-6">
                <div className="mb-5">
                    <h2 className="text-base font-semibold text-neutral-900">Documents</h2>
                    <p className="text-sm text-neutral-500 mt-0.5">
                        Upload and manage your study materials
                    </p>
                </div>
                <FileUploadCard sessionId={session.id} existingDocuments={session.documents} />
            </div>
        </div>
    );
}

/* ─── Chat View ──────────────────────────────────────────────────────── */

function ChatView({ session }: { session: Session }) {
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { addMessage, pendingChatPrompt, setPendingChatPrompt } = useSessionStore();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pendingHandled = useRef(false);

    const hasNotes = session.documents.some(
        (d) => d.type === "notes" && d.status === "success"
    );

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [session.messages]);

    // Handle pending chat prompt from study guide
    useEffect(() => {
        if (pendingChatPrompt && !pendingHandled.current) {
            pendingHandled.current = true;
            setMessage(pendingChatPrompt);
            setPendingChatPrompt(null);

            // Auto-focus the textarea
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

    // Reset the handled flag when component unmounts or prompt changes
    useEffect(() => {
        return () => {
            pendingHandled.current = false;
        };
    }, []);

    const sendMessage = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed || isLoading) return;

            const userMsg: ChatMessage = {
                id: uuidv4(),
                role: "user",
                content: trimmed,
                timestamp: new Date().toISOString(),
            };
            addMessage(session.id, userMsg);
            setMessage("");

            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }

            setIsLoading(true);

            try {
                const history = session.messages.slice(-10).map((m) => ({
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
                addMessage(session.id, assistantMsg);
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
                addMessage(session.id, errorMsg);
            } finally {
                setIsLoading(false);
            }
        },
        [isLoading, session.id, session.name, session.messages, addMessage]
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(message);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto">
                {session.messages.length === 0 && !message ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center max-w-md px-6">
                            <Sparkles className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                            <h3 className="text-base font-medium text-neutral-700 mb-1">
                                Ask anything about your notes
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
                        {session.messages.map((msg) => (
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

            {/* Input area */}
            <div className="bg-white px-4 pb-4 pt-2">
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

/* ─── Citation Popover ───────────────────────────────────────────────── */

function CitationPopover({
    source,
    onClose,
}: {
    source: ChatSource;
    onClose: () => void;
}) {
    const popRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popRef.current && !popRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const chapterDisplay = (source.chapter_name || "").replace(/\n/g, " ");

    return (
        <div ref={popRef} className="citation-popover">
            <div className="flex items-center gap-1.5 mb-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-neutral-900 text-white text-[10px] font-bold">
                    {source.index}
                </span>
                <span className="font-medium text-neutral-700">Source</span>
            </div>
            <div className="space-y-1 text-neutral-600">
                <p>
                    <span className="text-neutral-400">Chapter:</span> {chapterDisplay}
                </p>
                <p>
                    <span className="text-neutral-400">Section:</span>{" "}
                    {source.subtopic_name}
                </p>
            </div>
        </div>
    );
}

/* ─── Inline Citation Button ─────────────────────────────────────────── */

function InlineCitation({
    index,
    sources,
}: {
    index: number;
    sources: ChatSource[];
}) {
    const [open, setOpen] = useState(false);
    const source = sources.find((s) => s.index === index);

    if (!source) {
        return (
            <span className="citation-btn" title="Source not found">
                {index}
            </span>
        );
    }

    return (
        <span className="relative inline-block">
            <button
                className="citation-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen(!open);
                }}
                title={`Source ${index}: ${source.subtopic_name}`}
            >
                {index}
            </button>
            {open && <CitationPopover source={source} onClose={() => setOpen(false)} />}
        </span>
    );
}

/* ─── Markdown renderer with citations + KaTeX ───────────────────────── */

function MarkdownWithCitations({
    content,
    sources,
}: {
    content: string;
    sources: ChatSource[];
}) {
    const processTextWithCitations = useCallback(
        (text: string): React.ReactNode[] => {
            const parts = text.split(/(\[\d+\])/g);
            return parts.map((part, i) => {
                const match = part.match(/^\[(\d+)\]$/);
                if (match) {
                    const idx = parseInt(match[1], 10);
                    return <InlineCitation key={i} index={idx} sources={sources} />;
                }
                return part;
            });
        },
        [sources]
    );

    const components: Components = {
        p: ({ children }) => (
            <p>{processChildren(children, processTextWithCitations)}</p>
        ),
        li: ({ children }) => (
            <li>{processChildren(children, processTextWithCitations)}</li>
        ),
        strong: ({ children }) => (
            <strong>{processChildren(children, processTextWithCitations)}</strong>
        ),
        em: ({ children }) => (
            <em>{processChildren(children, processTextWithCitations)}</em>
        ),
        td: ({ children }) => (
            <td>{processChildren(children, processTextWithCitations)}</td>
        ),
        th: ({ children }) => (
            <th>{processChildren(children, processTextWithCitations)}</th>
        ),
        h1: ({ children }) => (
            <h1>{processChildren(children, processTextWithCitations)}</h1>
        ),
        h2: ({ children }) => (
            <h2>{processChildren(children, processTextWithCitations)}</h2>
        ),
        h3: ({ children }) => (
            <h3>{processChildren(children, processTextWithCitations)}</h3>
        ),
        h4: ({ children }) => (
            <h4>{processChildren(children, processTextWithCitations)}</h4>
        ),
        code: ({ className, children, ...props }) => {
            return (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        },
        pre: ({ children }) => <pre>{children}</pre>,
    };

    return (
        <div className="chat-markdown text-sm">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={components}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

function processChildren(
    children: React.ReactNode,
    processor: (text: string) => React.ReactNode[]
): React.ReactNode {
    if (typeof children === "string") {
        return <>{processor(children)}</>;
    }
    if (Array.isArray(children)) {
        return (
            <>
                {children.map((child, i) => {
                    if (typeof child === "string") {
                        return <span key={i}>{processor(child)}</span>;
                    }
                    return child;
                })}
            </>
        );
    }
    return children;
}

/* ─── Message Bubble ─────────────────────────────────────────────────── */

function MessageBubble({ message }: { message: ChatMessage }) {
    const [showRelated, setShowRelated] = useState(false);

    const isUser = message.role === "user";
    const hasRelated = message.relatedQuestions && message.relatedQuestions.length > 0;

    if (isUser) {
        return (
            <div className="flex justify-end">
                <div className="bg-neutral-100 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                    <p className="text-sm text-neutral-900">{message.content}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <MarkdownWithCitations
                content={message.content}
                sources={message.sources || []}
            />

            {hasRelated && (
                <div className="pt-1">
                    <button
                        onClick={() => setShowRelated(!showRelated)}
                        className="flex items-center gap-1.5 text-xs text-neutral-400
                            hover:text-neutral-600 transition-colors"
                    >
                        <HelpCircle className="w-3 h-3" />
                        {message.relatedQuestions!.length} related past question
                        {message.relatedQuestions!.length !== 1 ? "s" : ""}
                        {showRelated ? (
                            <ChevronUp className="w-3 h-3" />
                        ) : (
                            <ChevronDown className="w-3 h-3" />
                        )}
                    </button>
                    {showRelated && (
                        <div className="mt-1.5 space-y-1">
                            {message.relatedQuestions!.map((q, i) => (
                                <div
                                    key={i}
                                    className="text-xs bg-amber-50 rounded px-2.5 py-1.5 border border-amber-100"
                                >
                                    <p className="text-neutral-700 line-clamp-2">{q.question}</p>
                                    <div className="flex gap-2 mt-1 text-amber-600">
                                        {q.freq > 1 && <span>×{q.freq} times</span>}
                                        {q.years.length > 0 && <span>{q.years.join(", ")}</span>}
                                        {q.marks.length > 0 && (
                                            <span>{q.marks.join(", ")} marks</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}