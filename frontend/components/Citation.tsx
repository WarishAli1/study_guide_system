"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    FileText,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    X,
    BookOpen,
    CheckCircle2,
    XCircle,
    ArrowRight,
    CircleHelp,
} from "lucide-react";
import type {
    ChatMessage,
    ChatSource,
    InlineQuizQuestion,
} from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

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

/* ─── Inline Quiz Question ───────────────────────────────────────── */
function InlineQuizCard({
    question,
    onTakeQuiz,
}: {
    question: InlineQuizQuestion;
    onTakeQuiz: () => void;
}) {
    const [selected, setSelected] = useState<string | null>(null);
    const [revealed, setRevealed] = useState(false);
    const [quizPromptDismissed, setQuizPromptDismissed] = useState(false);

    const labels = ["A", "B", "C", "D"] as const;

    const handleSelect = (label: string) => {
        if (revealed) return;
        setSelected(label);
        setRevealed(true);
    };

    return (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-blue-100 bg-blue-50/60">
                <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
                    <CircleHelp className="w-3 h-3 text-white" />
                </div>
                <p className="text-xs font-semibold text-blue-700">Quick Check</p>
                <span className="text-[10px] text-blue-400 ml-auto">Test your understanding</span>
            </div>

            {/* Question */}
            <div className="px-3.5 py-3">
                <p className="text-sm text-slate-800 font-medium leading-relaxed mb-3">
                    {question.question}
                </p>

                {/* Options */}
                <div className="space-y-2">
                    {labels.map((label) => {
                        const text = question.options[label];
                        const isCorrect = label === question.correct;
                        const isSelected = label === selected;
                        const isRevealed = revealed;
                        const isWrong = isRevealed && isSelected && !isCorrect;
                        const showCorrectHighlight = isRevealed && isCorrect;

                        let borderClass = "border-slate-200";
                        let bgClass = "bg-white hover:bg-blue-50/40 hover:border-blue-200";
                        let textClass = "text-slate-700";
                        let labelBg = "bg-slate-100 text-slate-500";
                        const cursor = revealed ? "cursor-default" : "cursor-pointer";

                        if (isRevealed) {
                            if (isSelected && isCorrect) {
                                borderClass = "border-emerald-300";
                                bgClass = "bg-emerald-50";
                                textClass = "text-emerald-900";
                                labelBg = "bg-emerald-200 text-emerald-800";
                            } else if (isWrong) {
                                borderClass = "border-red-300";
                                bgClass = "bg-red-50";
                                textClass = "text-red-900";
                                labelBg = "bg-red-200 text-red-800";
                            } else if (showCorrectHighlight && !isSelected) {
                                borderClass = "border-emerald-300";
                                bgClass = "bg-white";
                                textClass = "text-emerald-800";
                                labelBg = "bg-emerald-100 text-emerald-700";
                            } else {
                                bgClass = "bg-white";
                                textClass = "text-slate-400";
                                labelBg = "bg-slate-50 text-slate-400";
                            }
                        }

                        return (
                            <button
                                key={label}
                                onClick={() => handleSelect(label)}
                                disabled={isRevealed}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${cursor} transition-all`}
                            >
                                <span
                                    className={`shrink-0 w-5 h-5 rounded text-[10px] font-semibold flex items-center justify-center ${labelBg}`}
                                >
                                    {label}
                                </span>
                                <span className={`text-xs ${textClass} flex-1 text-left`}>{text}</span>
                                {isRevealed && isSelected && isCorrect && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                )}
                                {isWrong && (
                                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                )}
                                {showCorrectHighlight && !isSelected && selected && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Explanation */}
                {revealed && (
                    <div className="mt-3 px-3 py-2.5 rounded-lg bg-white border border-blue-100">
                        <p className="text-xs text-slate-600 leading-relaxed">
                            {question.explanation}
                        </p>
                        {(question.source.chapter_name || question.source.subtopic_name) && (
                            <p className="text-[10px] text-blue-400 mt-1">
                                Source:{" "}
                                {[question.source.chapter_name, question.source.subtopic_name]
                                    .filter(Boolean)
                                    .join(" › ")}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Quiz CTA */}
            {revealed && !quizPromptDismissed && (
                <div className="px-3.5 pb-3 pt-0">
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-blue-600 text-white">
                        <p className="text-xs font-medium">
                            Want to test your full knowledge?
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={onTakeQuiz}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-blue-600 text-xs font-semibold hover:bg-blue-50 transition-colors"
                            >
                                Take Quiz
                                <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => setQuizPromptDismissed(true)}
                                className="p-1 rounded-md hover:bg-blue-500 transition-colors text-blue-200 hover:text-white"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Message Bubble ─────────────────────────────────────────────────── */
export function MessageBubble({
    message,
    onNavigateToQuiz,
}: {
    message: ChatMessage;
    onNavigateToQuiz?: () => void;
}) {
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

            {/* Inline Quiz Question */}
            {message.inlineQuestion && (
                <InlineQuizCard
                    question={message.inlineQuestion}
                    onTakeQuiz={() => onNavigateToQuiz?.()}
                />
            )}

            {/* Related Past Questions */}
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
                                    <p className="text-slate-700 line-clamp-2">{q.question}</p>
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