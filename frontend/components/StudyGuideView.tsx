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
    Tag,
    HelpCircle,
    BarChart3,
} from "lucide-react";
import { guideAPI } from "@/lib/api";
import { useSessionStore } from "@/lib/session-store";
import type { Session, StudyGuideReport, GuideChapter } from "@/lib/types";
import toast from "react-hot-toast";

interface Props {
    session: Session;
}

function resolveDisplayTitle(report: StudyGuideReport | null, sessionName: string): string {
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
    const { setActiveView, setCachedGuide } = useSessionStore();
    const [report, setReport] = useState<StudyGuideReport | null>(
        session.cachedGuide
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasSyllabus = session.documents.some(
        (d) => d.type === "syllabus" && d.status === "success"
    );
    const hasPastPapers = session.documents.some(
        (d) => d.type === "past_paper" && d.status === "success"
    );

    const subjectName = "general";

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
            saveReport(res.data as StudyGuideReport);
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

    if (!hasSyllabus) {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-16 text-center">
                    <AlertCircle className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-neutral-700 mb-1">
                        Syllabus Required
                    </h3>
                    <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-4">
                        Upload a syllabus document to generate the study guide.
                        Past paper uploads are recommended for question frequency analysis.
                    </p>
                    <button
                        onClick={() => setActiveView("documents")}
                        className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm
                       font-medium hover:bg-neutral-800 transition-colors"
                    >
                        Upload Documents
                    </button>
                </div>
            </div>
        );
    }

    if (!report && !loading && !error) {
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-16 text-center">
                    <Sparkles className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-neutral-700 mb-1">
                        Study Guide
                    </h3>
                    <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-2">
                        Generate a study guide with chapter analysis,
                        question frequency, and time allocation.
                    </p>
                    {!hasPastPapers && (
                        <p className="text-xs text-amber-600 mb-4">
                            Past papers not uploaded. Question frequency will be unavailable.
                        </p>
                    )}
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

    if (loading && !report) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto mb-3" />
                    <p className="text-sm text-neutral-500">Generating study guide...</p>
                    <p className="text-xs text-neutral-400 mt-1">This may take a moment</p>
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
                    <p className="text-sm text-red-500 max-w-md mx-auto mb-4">{error}</p>
                    <button
                        onClick={() => handleGenerate(false)}
                        className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm
                       font-medium hover:bg-neutral-800 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!report) return null;

    const displayTitle = resolveDisplayTitle(report, session.name);

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-6">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-900">
                            {displayTitle}
                        </h2>
                        <p className="text-xs text-neutral-400 mt-0.5">
                            Generated{" "}
                            {new Date(report.generated_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </p>
                    </div>
                    <button
                        onClick={handleRegenerate}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300
                       text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors
                       disabled:opacity-40"
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                        Regenerate
                    </button>
                </div>

                {loading && (
                    <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500" />
                        <span className="text-xs text-neutral-500">Regenerating...</span>
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
                        value={report.total_questions}
                    />
                </div>

                <div className="space-y-3">
                    {report.chapters.map((ch) => (
                        <ChapterCard key={ch.chapter_id} chapter={ch} />
                    ))}
                </div>
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

function ChapterCard({ chapter }: { chapter: GuideChapter }) {
    const [expanded, setExpanded] = useState(false);

    const priorityStyles = {
        HIGH: "bg-neutral-900 text-white",
        MEDIUM: "bg-neutral-200 text-neutral-700",
        LOW: "bg-neutral-100 text-neutral-500",
    };

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
                            {chapter.chapter_name}
                        </h3>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {chapter.recommended_hours > 0 && (
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {chapter.recommended_hours}h
                        </span>
                    )}
                    {chapter.total_questions > 0 && (
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" />
                            {chapter.total_questions}
                        </span>
                    )}
                    <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${priorityStyles[chapter.priority]
                            }`}
                    >
                        {chapter.priority}
                    </span>
                    <span className="text-xs font-mono text-neutral-500 w-8 text-right">
                        {chapter.importance_score}
                    </span>
                </div>
            </button>

            {expanded && (
                <div className="border-t border-neutral-100 px-4 py-4 space-y-4">
                    <div className="flex gap-6 text-xs text-neutral-500">
                        {chapter.credit_hours != null && (
                            <span>Credit Hours: {chapter.credit_hours}</span>
                        )}
                        {chapter.marks_distribution != null && (
                            <span>Marks: {chapter.marks_distribution}</span>
                        )}
                        <span>Importance: {chapter.importance_score}/10</span>
                        <span>Study Time: {chapter.recommended_hours}h</span>
                    </div>

                    {chapter.topics.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-neutral-700 uppercase tracking-wider mb-2">
                                Important Topics
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {chapter.topics.map((t, i) => (
                                    <span
                                        key={i}
                                        className="inline-block px-2 py-0.5 rounded text-xs
                               bg-neutral-100 text-neutral-600"
                                    >
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {chapter.keywords.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-neutral-700 uppercase tracking-wider mb-2">
                                Keywords
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {chapter.keywords.map((k, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
                               border border-neutral-200 text-neutral-500"
                                    >
                                        <Tag className="w-2.5 h-2.5" />
                                        {k}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {chapter.questions.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-neutral-700 uppercase tracking-wider mb-2">
                                Questions by Frequency
                            </h4>
                            <div className="border border-neutral-200 rounded-lg overflow-hidden">
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
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {chapter.questions.map((q, i) => {
                                            const validMarks = (q.marks || []).filter(
                                                (m): m is number => m != null
                                            );
                                            const markDisplay =
                                                validMarks.length > 0
                                                    ? [...new Set(validMarks.map(String))].join(", ")
                                                    : "\u2014";

                                            const years = (q.years || []).map((y) => String(y));
                                            const yearDisplay =
                                                years.length > 0
                                                    ? years.slice(0, 3).join(", ") +
                                                    (years.length > 3 ? "..." : "")
                                                    : "\u2014";

                                            return (
                                                <tr
                                                    key={i}
                                                    className="hover:bg-neutral-50 transition-colors"
                                                >
                                                    <td className="px-3 py-2 text-neutral-700 leading-relaxed">
                                                        {q.question.length > 200
                                                            ? q.question.slice(0, 200) + "..."
                                                            : q.question}
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
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {chapter.questions.length === 0 && (
                        <p className="text-xs text-neutral-400">
                            No past paper questions mapped to this chapter.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}