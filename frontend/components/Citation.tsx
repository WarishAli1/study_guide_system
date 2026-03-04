"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    FileText,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    X,
    BookOpen,
} from "lucide-react";
import type {
    ChatMessage,
    ChatSource,
} from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

/* ─── Citation Modal ─────────────────────────────────────────────────── */
function CitationModal({
    source,
    onClose,
}: {
    source: ChatSource;
    onClose: () => void;
}) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const chapterDisplay = (source.chapter_name || "").replace(/\n/g, " ");

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative bg-white rounded-2xl border border-blue-100 shadow-xl shadow-blue-100/40
          w-[90%] max-w-lg max-h-[60vh] overflow-hidden flex flex-col z-10"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-blue-50 bg-blue-50/30 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-bold">
                            {source.index}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-900">
                            Source Citation
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400
              hover:text-slate-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Chapter info */}
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">
                            Chapter
                        </p>
                        <div className="flex items-start gap-2">
                            <BookOpen className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-sm font-medium text-slate-800">
                                {chapterDisplay}
                            </p>
                        </div>
                    </div>

                    {/* Section info */}
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">
                            Section
                        </p>
                        <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-slate-700">
                                {source.subtopic_name}
                            </p>
                        </div>
                    </div>

                    {/* Location path */}
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">
                            Location
                        </p>
                        <div className="bg-blue-50/60 rounded-lg px-3 py-2.5 border border-blue-100">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                <span className="font-medium text-blue-700">{chapterDisplay}</span>
                                <span className="text-blue-200">›</span>
                                <span className="font-medium text-slate-600">§ {source.subtopic_id}</span>
                                <span className="text-blue-200">›</span>
                                <span className="text-slate-500">{source.subtopic_name}</span>
                            </div>
                        </div>
                    </div>

                    {/* Referenced text snippet */}
                    {source.source_text ? (
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">
                                Referenced Text
                            </p>
                            <div className="bg-blue-50/40 rounded-lg px-3 py-2.5 border border-blue-100 max-h-48 overflow-y-auto">
                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                                    {source.source_text}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                            <p className="text-xs text-amber-700 leading-relaxed">
                                This information was retrieved from your uploaded notes.
                                Review the original document for full details.
                            </p>
                        </div>
                    )}
                </div>
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
        <>
            <button
                className="citation-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen(true);
                }}
                title={`Source ${index}: ${source.subtopic_name}`}
            >
                {index}
            </button>
            {open && (
                <CitationModal source={source} onClose={() => setOpen(false)} />
            )}
        </>
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
            <strong>
                {processChildren(children, processTextWithCitations)}
            </strong>
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
export function MessageBubble({ message }: { message: ChatMessage }) {
    const [showRelated, setShowRelated] = useState(false);

    const isUser = message.role === "user";
    const hasRelated =
        message.relatedQuestions && message.relatedQuestions.length > 0;

    if (isUser) {
        return (
            <div className="flex justify-end">
                <div className="bg-slate-100 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">
                        {message.content}
                    </p>
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
                        className="flex items-center gap-1.5 text-xs text-slate-400
              hover:text-blue-600 transition-colors"
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
                                    className="text-xs bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-100"
                                >
                                    <p className="text-slate-700 line-clamp-2">
                                        {q.question}
                                    </p>
                                    <div className="flex gap-2 mt-1 text-amber-600">
                                        {q.freq > 1 && <span>×{q.freq} times</span>}
                                        {q.years.length > 0 && (
                                            <span>{q.years.join(", ")}</span>
                                        )}
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