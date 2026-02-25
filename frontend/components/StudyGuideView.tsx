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
    RefreshCw,
    HelpCircle,
    BarChart3,
    X,
    Send,
    MessageSquare,
    Tag,
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

export default function StudyGuideView({ session }: Props) {
    const { setActiveView, setCachedGuide, navigateToChatWithPrompt } =
        useSessionStore();
    const [report, setReport] = useState<StudyGuideReport | null>(
        session.cachedGuide
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [panelOpen, setPanelOpen] = useState(false);
    const [panelItem, setPanelItem] = useState<PanelItem | null>(null);

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
                        ? detail
                            .map((d: any) => d.msg || JSON.stringify(d))
                            .join("; ")
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
            const msg =
                typeof detail === "string"
                    ? detail
                    : "Failed to regenerate study guide";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleQuestionClick = (q: GuideQuestion, chapterName: string) => {
        setPanelItem({
            type: "question",
            question: q.question,
            freq: q.freq,
            years: q.years,
            marks: q.marks,
            chapterName,
        });
        setPanelOpen(true);
    };

    const handleKeywordClick = (keyword: string, chapterName: string) => {
        setPanelItem({
            type: "keyword",
            keyword,
            chapterName,
        });
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
        navigateToChatWithPrompt(prompt);
    };

    if (loading && !report) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto mb-3" />
                    <p className="text-sm text-neutral-500">
                        Generating study guide...
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                        This may take a moment
                    </p>
                </div>
            </div>
        );
    }

    if (error && !report) {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-16 text-center">
                    <AlertCircle className="w-8 h-8 text-red-300 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-neutral-700 mb-1">
                        Generation Failed
                    </h3>
                    <p className="text-sm text-red-500 max-w-md mx-auto mb-4">
                        {error}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => handleGenerate(false)}
                            className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm
                                font-medium hover:bg-neutral-800 transition-colors"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => setActiveView("documents")}
                            className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-sm
                                font-medium hover:bg-neutral-50 transition-colors"
                        >
                            Go to Documents
                        </button>
                    </div>
                    {error.toLowerCase().includes("syllabus") && (
                        <p className="text-xs text-neutral-400 mt-4">
                            Make sure your syllabus document is uploaded and
                            processed successfully.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-16 text-center">
                    <Sparkles className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-neutral-700 mb-1">
                        Study Guide
                    </h3>
                    <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-2">
                        Generate a study guide with chapter analysis, question
                        frequency, and time allocation.
                    </p>
                    <button
                        onClick={() => handleGenerate(true)}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-lg bg-neutral-900 text-white text-sm
                            font-medium hover:bg-neutral-800 transition-colors
                            disabled:opacity-40 disabled:cursor-not-allowed
                            inline-flex items-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" />
                        Generate Study Guide
                    </button>
                </div>
            </div>
        );
    }

    const sortedChapters = [...report.chapters].sort((a, b) => {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const priorityDiff =
            priorityOrder[b.study_priority] - priorityOrder[a.study_priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.importance_score - a.importance_score;
    });

    const displayTitle = resolveDisplayTitle(report, session.name);

    return (
        <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-6">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-900">
                                {displayTitle}
                            </h2>
                            <p className="text-xs text-neutral-400 mt-0.5">
                                Generated{" "}
                                {new Date(
                                    report.generated_at
                                ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRegenerate}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300
                                    text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors
                                    disabled:opacity-40"
                            >
                                <RefreshCw
                                    className={`w-3 h-3 ${loading ? "animate-spin" : ""
                                        }`}
                                />
                                Regenerate
                            </button>

                            {panelItem && !panelOpen && (
                                <button
                                    onClick={() => setPanelOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                        bg-neutral-900 text-white text-xs font-medium
                                        hover:bg-neutral-800 transition-colors"
                                >
                                    <MessageSquare className="w-3 h-3" />
                                    Ask in Chat
                                </button>
                            )}
                        </div>
                    </div>

                    {loading && (
                        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500" />
                            <span className="text-xs text-neutral-500">
                                Regenerating...
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                        <SummaryCard
                            icon={<BookOpen className="w-4 h-4" />}
                            label="Chapters"
                            value={report.total_chapters}
                        />
                        <SummaryCard
                            icon={<Clock className="w-4 h-4" />}
                            label="Credit Hours"
                            value={report.total_credit_hours ?? "N/A"}
                        />
                        <SummaryCard
                            icon={<BarChart3 className="w-4 h-4" />}
                            label="Total Marks"
                            value={report.total_marks ?? "N/A"}
                        />
                        <SummaryCard
                            icon={<HelpCircle className="w-4 h-4" />}
                            label="Past Questions"
                            value={report.total_past_questions}
                        />
                    </div>

                    <div className="space-y-3">
                        {sortedChapters.map((ch) => (
                            <ChapterCard
                                key={ch.chapter_id}
                                chapter={ch}
                                onQuestionClick={handleQuestionClick}
                                onKeywordClick={handleKeywordClick}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div
                className={`border-l border-neutral-200 bg-white flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${panelOpen ? "w-80" : "w-0"
                    }`}
            >
                {panelOpen && panelItem && (
                    <div className="flex flex-col h-full w-80">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                            <div className="flex items-center gap-2">
                                {panelItem.type === "question" ? (
                                    <HelpCircle className="w-4 h-4 text-neutral-500" />
                                ) : (
                                    <Tag className="w-4 h-4 text-neutral-500" />
                                )}
                                <span className="text-sm font-medium text-neutral-700">
                                    {panelItem.type === "question"
                                        ? "Question"
                                        : "Keyword"}
                                </span>
                            </div>
                            <button
                                onClick={() => setPanelOpen(false)}
                                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400
                                    hover:text-neutral-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                                    From
                                </p>
                                <p className="text-xs text-neutral-600 bg-neutral-50 rounded px-2 py-1 inline-block">
                                    {panelItem.chapterName.replace(/\n/g, " ")}
                                </p>
                            </div>

                            {panelItem.type === "question" ? (
                                <>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1.5">
                                            Question
                                        </p>
                                        <p className="text-sm text-neutral-800 leading-relaxed">
                                            {panelItem.question}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        {panelItem.freq > 1 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium w-16">
                                                    Freq
                                                </span>
                                                <span className="text-xs text-neutral-700 font-medium bg-neutral-100 rounded px-1.5 py-0.5">
                                                    ×{panelItem.freq}
                                                </span>
                                            </div>
                                        )}
                                        {panelItem.years.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium w-16 pt-0.5">
                                                    Years
                                                </span>
                                                <div className="flex flex-wrap gap-1">
                                                    {panelItem.years.map(
                                                        (y, i) => (
                                                            <span
                                                                key={i}
                                                                className="text-xs text-neutral-600 bg-neutral-50 rounded px-1.5 py-0.5"
                                                            >
                                                                {y}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {panelItem.marks.filter(
                                            (m): m is number => m != null
                                        ).length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium w-16">
                                                        Marks
                                                    </span>
                                                    <span className="text-xs text-neutral-700 font-medium">
                                                        {[
                                                            ...new Set(
                                                                panelItem.marks
                                                                    .filter(
                                                                        (
                                                                            m
                                                                        ): m is number =>
                                                                            m !=
                                                                            null
                                                                    )
                                                                    .map(String)
                                                            ),
                                                        ].join(", ")}
                                                    </span>
                                                </div>
                                            )}
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1.5">
                                        Keyword
                                    </p>
                                    <p className="text-base font-medium text-neutral-900">
                                        {panelItem.keyword}
                                    </p>
                                    <p className="text-xs text-neutral-400 mt-1">
                                        Click below to get a detailed explanation
                                        from your notes.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="px-4 py-3 border-t border-neutral-100">
                            <button
                                onClick={handleAskInChat}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                                    rounded-lg bg-neutral-900 text-white text-sm font-medium
                                    hover:bg-neutral-800 transition-colors"
                            >
                                <Send className="w-3.5 h-3.5" />
                                {panelItem.type === "question"
                                    ? "Answer in Chat"
                                    : "Explain in Chat"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
}) {
    return (
        <div className="border border-neutral-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-neutral-400 mb-1">
                {icon}
                <span className="text-[11px] uppercase tracking-wider font-medium">
                    {label}
                </span>
            </div>
            <p className="text-lg font-semibold text-neutral-900">{value}</p>
        </div>
    );
}

function ChapterCard({
    chapter,
    onQuestionClick,
    onKeywordClick,
}: {
    chapter: GuideChapter;
    onQuestionClick: (q: GuideQuestion, chapterName: string) => void;
    onKeywordClick: (keyword: string, chapterName: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [showAllQuestions, setShowAllQuestions] = useState(false);

    const priorityStyles = {
        HIGH: "bg-neutral-900 text-white",
        MEDIUM: "bg-neutral-200 text-neutral-700",
        LOW: "bg-neutral-100 text-neutral-500",
    };

    const studyPriority = chapter.study_priority;
    const recommendedHours = chapter.recommended_study;
    const importantTopics = chapter.important_topics || [];
    const faq = chapter.faq || [];
    const chapterName = chapter.chapter_name;

    // Split into repeated (freq > 1) and single-occurrence (freq === 1)
    const repeatedQuestions = faq.filter((q) => q.freq > 1);
    const singleQuestions = faq.filter((q) => q.freq <= 1);
    const displayedQuestions = showAllQuestions ? faq : repeatedQuestions;

    return (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50
                    transition-colors text-left"
            >
                {expanded ? (
                    <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400 font-mono">
                            Ch. {chapter.chapter_id}
                        </span>
                        <h3 className="text-sm font-medium text-neutral-900 truncate">
                            {chapterName}
                        </h3>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {recommendedHours && (
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {recommendedHours
                                .replace("hours", "h")
                                .replace("hour", "h")}
                        </span>
                    )}
                    {chapter.total_past_questions > 0 && (
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" />
                            {chapter.total_past_questions}
                        </span>
                    )}
                    <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${priorityStyles[studyPriority]}`}
                    >
                        {studyPriority}
                    </span>
                    <span className="text-xs font-mono text-neutral-500 w-8 text-right">
                        {chapter.importance_score.toFixed(1)}
                    </span>
                </div>
            </button>

            {expanded && (
                <div className="border-t border-neutral-100 px-4 py-4 space-y-4">
                    <div className="flex gap-6 text-xs text-neutral-500 flex-wrap">
                        {chapter.credit_hours != null && (
                            <span>Credit Hours: {chapter.credit_hours}</span>
                        )}
                        {chapter.marks_distribution != null && (
                            <span>Marks: {chapter.marks_distribution}</span>
                        )}
                        <span>
                            Importance:{" "}
                            {chapter.importance_score.toFixed(1)}/10
                        </span>
                        <span>Study Time: {recommendedHours}</span>
                    </div>

                    {importantTopics.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-neutral-700 uppercase tracking-wider mb-2">
                                Important Topics
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {importantTopics.map((t, i) => (
                                    <button
                                        key={i}
                                        onClick={() =>
                                            onKeywordClick(t, chapterName)
                                        }
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
                                            bg-neutral-100 text-neutral-600
                                            hover:bg-neutral-200 hover:text-neutral-800
                                            transition-colors cursor-pointer group"
                                    >
                                        {t}
                                        <MessageSquare className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {faq.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-medium text-neutral-700 uppercase tracking-wider">
                                    {showAllQuestions
                                        ? "All Past Questions"
                                        : "Frequently Asked Questions"}
                                </h4>
                                {repeatedQuestions.length > 0 && !showAllQuestions && (
                                    <span className="text-[10px] text-neutral-400">
                                        Showing {repeatedQuestions.length} repeated of {faq.length} total
                                    </span>
                                )}
                            </div>

                            {repeatedQuestions.length === 0 && !showAllQuestions && (
                                <div className="text-center py-4 border border-neutral-200 rounded-lg">
                                    <p className="text-xs text-neutral-400 mb-2">
                                        No repeated questions found for this chapter.
                                    </p>
                                    <button
                                        onClick={() => setShowAllQuestions(true)}
                                        className="text-xs font-medium text-neutral-600 hover:text-neutral-900
                                            px-3 py-1.5 rounded-md border border-neutral-300
                                            hover:bg-neutral-50 transition-colors inline-flex items-center gap-1.5"
                                    >
                                        <HelpCircle className="w-3 h-3" />
                                        Show all {faq.length} question{faq.length !== 1 ? "s" : ""}
                                    </button>
                                </div>
                            )}

                            {displayedQuestions.length > 0 && (
                                <>
                                    <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-neutral-50 border-b border-neutral-200">
                                                    <th className="text-left px-3 py-2 font-medium text-neutral-500 uppercase tracking-wider">
                                                        Question
                                                    </th>
                                                    <th className="text-center px-3 py-2 font-medium text-neutral-500 uppercase tracking-wider w-16">
                                                        Freq
                                                    </th>
                                                    <th className="text-left px-3 py-2 font-medium text-neutral-500 uppercase tracking-wider w-28">
                                                        Years
                                                    </th>
                                                    <th className="text-center px-3 py-2 font-medium text-neutral-500 uppercase tracking-wider w-16">
                                                        Marks
                                                    </th>
                                                    <th className="w-10 px-2 py-2"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100">
                                                {displayedQuestions.map((q, i) => {
                                                    const validMarks = (
                                                        q.marks || []
                                                    ).filter(
                                                        (m): m is number =>
                                                            m != null
                                                    );
                                                    const markDisplay =
                                                        validMarks.length > 0
                                                            ? [
                                                                ...new Set(
                                                                    validMarks.map(
                                                                        String
                                                                    )
                                                                ),
                                                            ].join(", ")
                                                            : "\u2014";

                                                    const years = (
                                                        q.years || []
                                                    ).map((y) => String(y));
                                                    const yearDisplay =
                                                        years.length > 0
                                                            ? years
                                                                .slice(0, 3)
                                                                .join(", ") +
                                                            (years.length > 3
                                                                ? "..."
                                                                : "")
                                                            : "\u2014";

                                                    const isRepeated = q.freq > 1;

                                                    return (
                                                        <tr
                                                            key={i}
                                                            className={`hover:bg-neutral-50 transition-colors cursor-pointer group ${!isRepeated && showAllQuestions
                                                                ? "bg-white"
                                                                : ""
                                                                }`}
                                                            onClick={() =>
                                                                onQuestionClick(
                                                                    q,
                                                                    chapterName
                                                                )
                                                            }
                                                        >
                                                            <td className="px-3 py-2 text-neutral-700 leading-relaxed break-words">
                                                                {q.question}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                <span
                                                                    className={`inline-block min-w-[20px] px-1.5 py-0.5 rounded text-[10px] font-semibold ${q.freq >= 3
                                                                        ? "bg-neutral-900 text-white"
                                                                        : q.freq >= 2
                                                                            ? "bg-neutral-200 text-neutral-700"
                                                                            : "bg-neutral-100 text-neutral-500"
                                                                        }`}
                                                                >
                                                                    {q.freq}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-neutral-400">
                                                                {yearDisplay}
                                                            </td>
                                                            <td className="px-3 py-2 text-center text-neutral-500">
                                                                {markDisplay}
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <MessageSquare className="w-3 h-3 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                                                onClick={() =>
                                                    setShowAllQuestions(!showAllQuestions)
                                                }
                                                className="text-xs font-medium text-neutral-500 hover:text-neutral-800
                                                    px-3 py-1.5 rounded-md
                                                    hover:bg-neutral-100 transition-colors
                                                    inline-flex items-center gap-1.5"
                                            >
                                                {showAllQuestions ? (
                                                    <>
                                                        <ChevronDown className="w-3 h-3 rotate-180" />
                                                        Show repeated only ({repeatedQuestions.length})
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="w-3 h-3" />
                                                        Show all {faq.length} question{faq.length !== 1 ? "s" : ""}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {faq.length === 0 && (
                        <p className="text-xs text-neutral-400">
                            No past paper questions mapped to this chapter.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}