"use client";

import { useState, useEffect } from "react";
import {
    Sparkles,
    Loader2,
    AlertCircle,
    Clock,
    BookOpen,
    ChevronDown,
    ChevronRight,
    CircleHelp,
    RefreshCw,
    HelpCircle,
    BarChart3,
    X,
    Send,
    MessageSquare,
    Tag,
    ArrowLeft,
    TrendingUp,
} from "lucide-react";
import { guideAPI } from "@/lib/api";
import { useSessionStore } from "@/lib/session-store";
import type { Session, StudyGuideReport, GuideChapter, GuideQuestion } from "@/lib/types";
import toast from "react-hot-toast";

interface Props {
    session: Session;
}

type PanelItem =
    | { type: "question"; question: string; freq: number; years: string[]; marks: (number | null)[]; chapterName: string }
    | { type: "keyword"; keyword: string; chapterName: string };

function resolveDisplayTitle(
    report: StudyGuideReport | null,
    sessionName: string
): string {
    if (!report) return sessionName;
    const name = report.subject_name;
    if (
        name &&
        typeof name === "string" &&
        name.trim().length > 0 &&
        name.trim().toLowerCase() !== "general" &&
        name.trim().toLowerCase() !== "default"
    ) {
        return name.trim();
    }
    return sessionName;
}

// Priority config — used in both ChapterRow and the summary
const PRIORITY_STYLES = {
    HIGH: {
        badge: "bg-blue-600 text-white",
        border: "border-blue-200",
        header: "bg-blue-50/40",
        dot: "bg-blue-500",
    },
    MEDIUM: {
        badge: "bg-violet-100 text-violet-700",
        border: "border-violet-100",
        header: "bg-violet-50/30",
        dot: "bg-violet-400",
    },
    LOW: {
        badge: "bg-slate-100 text-slate-500",
        border: "border-slate-200",
        header: "bg-slate-50/30",
        dot: "bg-slate-300",
    },
};

export default function StudyGuideView({ session }: Props) {
    const { setActiveView, setCachedGuide, setActiveConversation, setPendingChatPrompt } =
        useSessionStore();
    const [report, setReport] = useState<StudyGuideReport | null>(session.cachedGuide);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [panelOpen, setPanelOpen] = useState(false);
    const [panelItem, setPanelItem] = useState<PanelItem | null>(null);
    const [expandedChapter, setExpandedChapter] = useState<number | string | null>(null);

    const subjectName = session.name;

    useEffect(() => {
        if (session.cachedGuide && !report) {
            setReport(session.cachedGuide);
        }
    }, [session.cachedGuide]);

    const saveReport = (data: StudyGuideReport) => {
        setReport(data);
        setCachedGuide(session.id, data);
    };

    const handleGenerate = async (useCache = true) => {
        setLoading(true);
        setError(null);
        try {
            const res = await guideAPI.generate(subjectName, useCache);
            saveReport(res.data as StudyGuideReport);
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            const msg =
                typeof detail === "string"
                    ? detail
                    : Array.isArray(detail)
                        ? detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ")
                        : "Failed to generate study guide";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await guideAPI.regenerate(subjectName);
            saveReport(res.data.report as StudyGuideReport);
            toast.success("Study guide regenerated");
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            const msg = typeof detail === "string" ? detail : "Failed to regenerate study guide";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleQuestionClick = (q: GuideQuestion, chapterName: string) => {
        setPanelItem({ type: "question", question: q.question, freq: q.freq, years: q.years, marks: q.marks, chapterName });
        setPanelOpen(true);
    };

    const handleAskInChat = () => {
        if (!panelItem) return;
        let prompt = "";
        if (panelItem.type === "question") {
            const marksInfo = panelItem.marks.filter((m): m is number => m != null);
            const marksStr = marksInfo.length > 0 ? ` (${marksInfo[0]} marks)` : "";
            prompt = `Answer this exam question based on the notes${marksStr}:\n\n${panelItem.question}`;
        } else {
            prompt = `Explain the concept of "${panelItem.keyword}" in detail based on the notes. This topic is from ${panelItem.chapterName}.`;
        }
        setPanelOpen(false);
        setPanelItem(null);
        setActiveConversation(null);
        setPendingChatPrompt(prompt);
        setActiveView("chat");
    };

    // ─── Pre-report states ──────────────────────────────

    if (loading && !report) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#F8FAFF]">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                    <p className="text-sm text-slate-600 font-medium">Generating study guide...</p>
                    <p className="text-xs text-slate-400 mt-1">This may take a moment</p>
                </div>
            </div>
        );
    }

    if (error && !report) {
        return (
            <div className="flex-1 overflow-y-auto bg-[#F8FAFF]">
                <div className="max-w-2xl mx-auto px-6 py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-base font-medium text-slate-700 mb-1">Generation Failed</h3>
                    <p className="text-sm text-red-500 max-w-md mx-auto mb-6">{error}</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button onClick={() => handleGenerate(false)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
                            Retry
                        </button>
                        <button onClick={() => setActiveView("documents")} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                            Go to Documents
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex-1 overflow-y-auto bg-[#F8FAFF]">
                <div className="max-w-2xl mx-auto px-6 py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 mb-2">Study Guide</h3>
                    <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
                        Generate a study guide with chapter analysis, question frequency, and time allocation.
                    </p>
                    <button
                        onClick={() => handleGenerate(true)}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-md shadow-blue-200"
                    >
                        <Sparkles className="w-4 h-4" />
                        Generate Study Guide
                    </button>
                </div>
            </div>
        );
    }

    // ─── Report view ────────────────────────────────────

    const sortedChapters = [...report.chapters].sort((a, b) => {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const priorityDiff = priorityOrder[b.study_priority] - priorityOrder[a.study_priority];
        if (priorityDiff !== 0) return priorityDiff;
        return Number(b.importance_score) - Number(a.importance_score);
    });
    const displayTitle = resolveDisplayTitle(report, session.name);

    return (
        <div className="flex-1 flex overflow-hidden bg-[#F8FAFF]">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{displayTitle}</h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Generated{" "}
                                {new Date(report.generated_at).toLocaleDateString("en-US", {
                                    month: "short", day: "numeric", year: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveView("quiz")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                            >
                                <CircleHelp className="w-3.5 h-3.5" />
                                Generate Quiz
                            </button>
                            <button
                                onClick={handleRegenerate}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                            >
                                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                                Regenerate
                            </button>
                        </div>
                    </div>

                    {loading && (
                        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            <span className="text-xs text-blue-600">Regenerating...</span>
                        </div>
                    )}

                    {/* Summary row */}
                    <div className="flex items-center gap-6 mb-8 px-4 py-3.5 rounded-xl bg-white border border-blue-100 shadow-sm shadow-blue-50">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                <BookOpen className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Chapters</p>
                                <p className="text-sm font-bold text-slate-900">{report.total_chapters}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-blue-100" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-violet-500" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Credit Hours</p>
                                <p className="text-sm font-bold text-slate-900">{report.total_credit_hours ?? "N/A"}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-blue-100" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Total Marks</p>
                                <p className="text-sm font-bold text-slate-900">{report.total_marks ?? "N/A"}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-blue-100" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                <HelpCircle className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Past Questions</p>
                                <p className="text-sm font-bold text-slate-900">{report.total_past_questions}</p>
                            </div>
                        </div>
                    </div>

                    {/* Chapters */}
                    <div className="space-y-2">
                        {sortedChapters.map((ch) => (
                            <ChapterRow
                                key={ch.chapter_id}
                                chapter={ch}
                                isExpanded={expandedChapter === ch.chapter_id}
                                onToggle={() => setExpandedChapter(expandedChapter === ch.chapter_id ? null : ch.chapter_id)}
                                onQuestionClick={handleQuestionClick}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel */}
            <div className={`border-l border-blue-100 bg-white flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${panelOpen ? "w-80" : "w-0"}`}>
                {panelOpen && panelItem && (
                    <div className="flex flex-col h-full w-80">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-50">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${panelItem.type === "question" ? "bg-amber-50" : "bg-violet-50"}`}>
                                    {panelItem.type === "question"
                                        ? <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                                        : <Tag className="w-3.5 h-3.5 text-violet-500" />
                                    }
                                </div>
                                <span className="text-sm font-medium text-slate-700">
                                    {panelItem.type === "question" ? "Question" : "Keyword"}
                                </span>
                            </div>
                            <button
                                onClick={() => setPanelOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">From</p>
                                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1 inline-block">
                                    {panelItem.chapterName.replace(/\n/g, " ")}
                                </p>
                            </div>
                            {panelItem.type === "question" ? (
                                <>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">Question</p>
                                        <p className="text-sm text-slate-800 leading-relaxed">{panelItem.question}</p>
                                    </div>
                                    <div className="space-y-2">
                                        {panelItem.freq > 1 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium w-16">Freq</span>
                                                <span className="text-xs text-blue-700 font-medium bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">×{panelItem.freq}</span>
                                            </div>
                                        )}
                                        {panelItem.years.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium w-16 pt-0.5">Years</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {panelItem.years.map((y, i) => (
                                                        <span key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">{y}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {panelItem.marks.filter((m): m is number => m != null).length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium w-16">Marks</span>
                                                <span className="text-xs text-slate-700 font-medium">
                                                    {[...new Set(panelItem.marks.filter((m): m is number => m != null).map(String))].join(", ")}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">Keyword</p>
                                    <p className="text-base font-medium text-slate-900">{panelItem.keyword}</p>
                                    <p className="text-xs text-slate-400 mt-1">Click below to get a detailed explanation from your notes.</p>
                                </div>
                            )}
                        </div>
                        <div className="px-4 py-3 border-t border-blue-50">
                            <button
                                onClick={handleAskInChat}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                            >
                                <Send className="w-3.5 h-3.5" />
                                {panelItem.type === "question" ? "Answer in Chat" : "Explain in Chat"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Chapter Row ──────────────────────────────────────────────────── */

function ChapterRow({
    chapter,
    isExpanded,
    onToggle,
    onQuestionClick,
}: {
    chapter: GuideChapter;
    isExpanded: boolean;
    onToggle: () => void;
    onQuestionClick: (q: GuideQuestion, chapterName: string) => void;
}) {
    const [showAllQuestions, setShowAllQuestions] = useState(false);
    const [showAllTopics, setShowAllTopics] = useState(false);

    const { setActiveConversation, setPendingChatPrompt, setActiveView } = useSessionStore();

    const priorityStyle = PRIORITY_STYLES[chapter.study_priority];

    const chapterName = chapter.chapter_name;
    const importantTopics = chapter.important_topics || [];
    const faq = chapter.faq || [];
    const repeatedQuestions = faq.filter((q) => q.freq > 1);
    const singleQuestions = faq.filter((q) => q.freq <= 1);
    const displayedQuestions = showAllQuestions ? faq : repeatedQuestions;

    const MAX_VISIBLE_TOPICS = 6;
    const visibleTopics = showAllTopics ? importantTopics : importantTopics.slice(0, MAX_VISIBLE_TOPICS);
    const hasMoreTopics = importantTopics.length > MAX_VISIBLE_TOPICS;

    const handleTopicChat = (topic: string) => {
        const prompt = `Explain the concept of "${topic}" in detail based on the notes. This topic is from ${chapterName}.`;
        setActiveConversation(null);
        setPendingChatPrompt(prompt);
        setActiveView("chat");
    };

    // Freq badge color
    const freqBadgeClass = (freq: number) =>
        freq >= 3
            ? "bg-blue-600 text-white"
            : freq >= 2
            ? "bg-violet-100 text-violet-700"
            : "bg-slate-100 text-slate-500";

    return (
        <div className={`border rounded-xl overflow-hidden bg-white ${priorityStyle.border}`}>
            {/* Chapter header */}
            <button
                onClick={onToggle}
                className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${isExpanded ? priorityStyle.header : "hover:bg-slate-50/60"}`}
            >
                {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}

                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${priorityStyle.badge}`}>
                    {chapter.chapter_id}
                </span>

                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{chapterName}</h3>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    {chapter.marks_distribution != null && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <BarChart3 className="w-3 h-3 text-amber-400" />
                            {chapter.marks_distribution}m
                        </span>
                    )}
                    {chapter.credit_hours != null && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-violet-400" />
                            {chapter.credit_hours}h
                        </span>
                    )}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-blue-400" />
                        {chapter.importance_score.toFixed(1)}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${priorityStyle.badge}`}>
                        {chapter.study_priority}
                    </span>
                </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-4">
                    {/* Key topics */}
                    {importantTopics.length > 0 && (
                        <div className="mb-4">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium flex items-center gap-1.5 mb-2.5">
                                <BookOpen className="w-3 h-3 text-blue-400" />
                                Key Topics ({importantTopics.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {visibleTopics.map((t, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleTopicChat(t)}
                                        className="text-xs text-blue-700 bg-blue-50 border border-blue-100
                                            rounded-md px-2 py-1 hover:bg-blue-100 hover:border-blue-200
                                            transition-colors cursor-pointer group flex items-center gap-1"
                                    >
                                        {t}
                                        <MessageSquare className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                                    </button>
                                ))}
                                {hasMoreTopics && (
                                    <button
                                        onClick={() => setShowAllTopics(!showAllTopics)}
                                        className="text-xs text-slate-400 hover:text-blue-600 px-2 py-1 transition-colors underline underline-offset-2"
                                    >
                                        {showAllTopics ? "Show less" : `+${importantTopics.length - MAX_VISIBLE_TOPICS} more`}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Questions */}
                    {faq.length > 0 ? (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium flex items-center gap-1.5">
                                    <HelpCircle className="w-3 h-3 text-amber-400" />
                                    {showAllQuestions ? "All Past Questions" : "Frequently Asked Questions"}
                                </p>
                                {repeatedQuestions.length > 0 && !showAllQuestions && (
                                    <span className="text-[10px] text-slate-400">
                                        {repeatedQuestions.length} repeated of {faq.length} total
                                    </span>
                                )}
                            </div>

                            {repeatedQuestions.length === 0 && !showAllQuestions && (
                                <div className="text-center py-4 border border-slate-200 rounded-lg bg-slate-50/50">
                                    <p className="text-xs text-slate-400 mb-2">No repeated questions found.</p>
                                    <button
                                        onClick={() => setShowAllQuestions(true)}
                                        className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors inline-flex items-center gap-1.5"
                                    >
                                        <HelpCircle className="w-3 h-3" />
                                        Show all {faq.length} question{faq.length !== 1 ? "s" : ""}
                                    </button>
                                </div>
                            )}

                            {displayedQuestions.length > 0 && (
                                <>
                                    <div className="border border-amber-100 rounded-lg overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-amber-50/60 border-b border-amber-100">
                                                    <th className="text-left px-3 py-2.5 font-medium text-slate-500 uppercase tracking-wider">Question</th>
                                                    <th className="text-center px-3 py-2.5 font-medium text-slate-500 uppercase tracking-wider w-16">Freq</th>
                                                    <th className="text-left px-3 py-2.5 font-medium text-slate-500 uppercase tracking-wider w-28">Years</th>
                                                    <th className="text-center px-3 py-2.5 font-medium text-slate-500 uppercase tracking-wider w-16">Marks</th>
                                                    <th className="w-10 px-2 py-2.5"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-50">
                                                {displayedQuestions.map((q, i) => {
                                                    const validMarks = (q.marks || []).filter((m): m is number => m != null);
                                                    const markDisplay = validMarks.length > 0 ? [...new Set(validMarks.map(String))].join(", ") : "—";
                                                    const years = (q.years || []).map((y) => String(y));
                                                    const yearDisplay = years.length > 0 ? years.slice(0, 3).join(", ") + (years.length > 3 ? "..." : "") : "—";

                                                    return (
                                                        <tr
                                                            key={i}
                                                            className="hover:bg-amber-50/40 transition-colors cursor-pointer group bg-white"
                                                            onClick={() => onQuestionClick(q, chapterName)}
                                                        >
                                                            <td className="px-3 py-2.5 text-slate-700 leading-relaxed break-words">{q.question}</td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <span className={`inline-block min-w-[20px] px-1.5 py-0.5 rounded text-[10px] font-semibold ${freqBadgeClass(q.freq)}`}>
                                                                    {q.freq}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-slate-400">{yearDisplay}</td>
                                                            <td className="px-3 py-2.5 text-center text-slate-500">{markDisplay}</td>
                                                            <td className="px-2 py-2.5">
                                                                <MessageSquare className="w-3 h-3 text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {singleQuestions.length > 0 && (
                                        <div className="mt-2 text-center">
                                            <button
                                                onClick={() => setShowAllQuestions(!showAllQuestions)}
                                                className="text-xs font-medium text-slate-500 hover:text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors inline-flex items-center gap-1.5"
                                            >
                                                {showAllQuestions ? (
                                                    <><ChevronDown className="w-3 h-3 rotate-180" />Show repeated only ({repeatedQuestions.length})</>
                                                ) : (
                                                    <><ChevronDown className="w-3 h-3" />Show all {faq.length} question{faq.length !== 1 ? "s" : ""}</>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400">No past paper questions mapped to this chapter.</p>
                    )}
                </div>
            )}
        </div>
    );
}