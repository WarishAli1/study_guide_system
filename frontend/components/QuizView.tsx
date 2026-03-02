"use client";

import { useState, useEffect } from "react";
import {
    Loader2,
    CheckCircle2,
    XCircle,
    RotateCcw,
    BookOpen,
    ArrowRight,
    ArrowLeft,
    MessageSquare,
    Plus,
    Trash2,
    CircleHelp,
    Trophy,
} from "lucide-react";
import { quizAPI } from "@/lib/api";
import { useSessionStore } from "@/lib/session-store";
import type { Session, QuizRecord, QuizQuestion } from "@/lib/types";
import type { QuizData } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

interface Props {
    session: Session;
}

export default function QuizView({ session }: Props) {
    const {
        setActiveView,
        setActiveConversation,
        setPendingChatPrompt,
        addQuizRecord,
        deleteQuizRecord,
    } = useSessionStore();

    const [activeQuiz, setActiveQuiz] = useState<QuizRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showScore, setShowScore] = useState(false);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [revealed, setRevealed] = useState<Record<number, boolean>>({});

    const [hoveredRecord, setHoveredRecord] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const quizRecords = session.quizRecords || [];

    const hasNotes = session.documents.some(
        (d) => d.type === "notes" && d.status === "success"
    );
    const hasSyllabus = session.documents.some(
        (d) => d.type === "syllabus" && d.status === "success"
    );
    const hasPastPapers = session.documents.some(
        (d) => d.type === "past_paper" && d.status === "success"
    );
    const canGenerateQuiz = hasNotes || hasSyllabus || hasPastPapers;

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await quizAPI.generate(session.name);
            const data = res.data as QuizData;

            const record: QuizRecord = {
                id: uuidv4(),
                createdAt: new Date().toISOString(),
                subject: data.subject,
                totalQuestions: data.total_questions,
                answers: {},
                revealed: {},
                questions: data.questions,
            };

            addQuizRecord(session.id, record);
            setActiveQuiz(record);
            setAnswers({});
            setRevealed({});
            setCurrentIndex(0);
            setShowScore(false);
        } catch (err: any) {
            setError(
                err?.response?.data?.detail ||
                "Failed to generate quiz. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleOpenRecord = (record: QuizRecord) => {
        setActiveQuiz(record);
        setAnswers(record.answers || {});
        setRevealed(record.revealed || {});
        setCurrentIndex(0);

        const answeredAll =
            Object.keys(record.revealed || {}).length >= record.totalQuestions;
        setShowScore(answeredAll);
    };

    const handleDeleteRecord = (e: React.MouseEvent, quizId: string) => {
        e.stopPropagation();
        if (confirmDelete === quizId) {
            deleteQuizRecord(session.id, quizId);
            if (activeQuiz?.id === quizId) {
                setActiveQuiz(null);
            }
            setConfirmDelete(null);
        } else {
            setConfirmDelete(quizId);
            setTimeout(() => setConfirmDelete(null), 3000);
        }
    };

    const handleSelect = (questionId: number, option: string) => {
        if (revealed[questionId]) return;

        const newAnswers = { ...answers, [questionId]: option };
        const newRevealed = { ...revealed, [questionId]: true };
        setAnswers(newAnswers);
        setRevealed(newRevealed);

        // Persist to store
        if (activeQuiz) {
            const updated: QuizRecord = {
                ...activeQuiz,
                answers: newAnswers,
                revealed: newRevealed,
            };
            // Update in store by deleting and re-adding
            deleteQuizRecord(session.id, activeQuiz.id);
            addQuizRecord(session.id, updated);
            setActiveQuiz(updated);
        }
    };

    const handleNext = () => {
        if (!activeQuiz) return;
        if (currentIndex < activeQuiz.questions.length - 1) {
            setCurrentIndex((i) => i + 1);
        } else {
            setShowScore(true);
        }
    };

    const handlePrev = () => {
        if (showScore) {
            setShowScore(false);
            return;
        }
        if (currentIndex > 0) {
            setCurrentIndex((i) => i - 1);
        }
    };

    const handleBack = () => {
        setActiveQuiz(null);
        setShowScore(false);
    };

    const handleAskInChat = (question: QuizQuestion) => {
        const prompt = `Explain this in detail: ${question.question}`;
        setActiveConversation(null);
        setPendingChatPrompt(prompt);
        setActiveView("chat");
    };

    // ─── Loading ───────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto mb-3" />
                    <p className="text-sm text-neutral-500">
                        Generating quiz from your documents…
                    </p>
                </div>
            </div>
        );
    }

    // ─── Quiz list (no active quiz) ────────────────────────
    if (!activeQuiz) {
        return (
            <div className="flex flex-col h-full overflow-y-auto">
                <div className="max-w-3xl mx-auto w-full px-6 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
                                Quiz
                            </h2>
                            <p className="text-sm text-neutral-400 mt-0.5">
                                Test your knowledge with MCQ quizzes
                            </p>
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={!canGenerateQuiz}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                bg-neutral-900 text-white text-sm font-medium
                hover:bg-neutral-800 disabled:opacity-40
                disabled:cursor-not-allowed transition-colors"
                            title={
                                canGenerateQuiz
                                    ? "Generate a new quiz"
                                    : "Upload documents first"
                            }
                        >
                            <Plus className="w-4 h-4" />
                            New Quiz
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {!canGenerateQuiz && (
                        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
                            <p className="text-xs text-amber-700">
                                Upload at least one document (notes, syllabus, or past papers)
                                to generate quizzes.
                            </p>
                        </div>
                    )}

                    {/* Quiz records */}
                    {quizRecords.length > 0 ? (
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-3">
                                Previous Quizzes
                            </p>
                            <div className="space-y-2">
                                {[...quizRecords].reverse().map((record) => {
                                    const answeredCount = Object.keys(
                                        record.revealed || {}
                                    ).length;
                                    const correctCount = record.questions.filter(
                                        (q) => (record.answers || {})[q.id] === q.correct
                                    ).length;
                                    const isComplete = answeredCount >= record.totalQuestions;

                                    return (
                                        <div
                                            key={record.id}
                                            onClick={() => handleOpenRecord(record)}
                                            onMouseEnter={() => setHoveredRecord(record.id)}
                                            onMouseLeave={() => setHoveredRecord(null)}
                                            className="border border-neutral-200 rounded-xl px-4 py-3.5
                        hover:border-neutral-300 hover:bg-neutral-50
                        cursor-pointer transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <CircleHelp className="w-4 h-4 text-neutral-400 shrink-0" />
                                                        <p className="text-sm font-medium text-neutral-900">
                                                            {record.totalQuestions} Questions
                                                        </p>
                                                        {isComplete && (
                                                            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                                                <Trophy className="w-3 h-3" />
                                                                {correctCount}/{record.totalQuestions}
                                                            </span>
                                                        )}
                                                        {!isComplete && answeredCount > 0 && (
                                                            <span className="text-xs text-neutral-400">
                                                                {answeredCount}/{record.totalQuestions} answered
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-neutral-400 mt-1 ml-6">
                                                        {new Date(record.createdAt).toLocaleDateString(
                                                            "en-US",
                                                            {
                                                                month: "short",
                                                                day: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            }
                                                        )}
                                                    </p>
                                                </div>
                                                {hoveredRecord === record.id ? (
                                                    <button
                                                        onClick={(e) => handleDeleteRecord(e, record.id)}
                                                        title={
                                                            confirmDelete === record.id
                                                                ? "Click again to confirm"
                                                                : "Delete quiz"
                                                        }
                                                        className={`p-1.5 rounded-md transition-colors shrink-0 ${confirmDelete === record.id
                                                                ? "bg-red-100 text-red-500"
                                                                : "hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600"
                                                            }`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <ArrowRight className="w-4 h-4 text-neutral-300 shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        canGenerateQuiz && (
                            <div className="text-center py-12 border border-dashed border-neutral-200 rounded-xl">
                                <CircleHelp className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                                <p className="text-sm text-neutral-500 mb-1">No quizzes yet</p>
                                <p className="text-xs text-neutral-400">
                                    Generate your first quiz to test your knowledge
                                </p>
                            </div>
                        )
                    )}
                </div>
            </div>
        );
    }

    // ─── Active quiz ───────────────────────────────────────
    const currentQuestion = activeQuiz.questions[currentIndex];
    const answeredCount = Object.keys(revealed).length;
    const totalQuestions = activeQuiz.totalQuestions;
    const correctCount = activeQuiz.questions.filter(
        (q) => answers[q.id] === q.correct
    ).length;
    const progressPercent =
        totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

    // Score screen
    if (showScore) {
        return (
            <div className="flex flex-col h-full min-h-0">
                <div className="shrink-0 h-1 bg-neutral-100">
                    <div
                        className="h-full bg-neutral-900 transition-all duration-500 ease-out"
                        style={{ width: "100%" }}
                    />
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-3xl font-semibold text-neutral-900 mb-6">
                            {correctCount}/{totalQuestions}
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleBack}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                  border border-neutral-300 text-sm font-medium text-neutral-600
                  hover:bg-neutral-50 transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                All Quizzes
                            </button>
                            <button
                                onClick={handleGenerate}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                  bg-neutral-900 text-white text-sm font-medium
                  hover:bg-neutral-800 transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                New Quiz
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Progress bar */}
            <div className="shrink-0 h-1 bg-neutral-100">
                <div
                    className="h-full bg-neutral-900 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Question area */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="max-w-xl mx-auto px-6 py-10">
                    <p className="text-xs text-neutral-400 mb-4">
                        {currentIndex + 1} / {totalQuestions}
                    </p>

                    <h2 className="text-base font-medium text-neutral-900 leading-relaxed mb-8">
                        {currentQuestion.question}
                    </h2>

                    <div className="space-y-2.5">
                        {(["A", "B", "C", "D"] as const).map((label) => {
                            const text =
                                currentQuestion.options[
                                label as keyof typeof currentQuestion.options
                                ];
                            const isCorrect = label === currentQuestion.correct;
                            const isSelected = label === answers[currentQuestion.id];
                            const isRevealed = !!revealed[currentQuestion.id];
                            const isWrong = isRevealed && isSelected && !isCorrect;
                            const showCorrectHighlight = isRevealed && isCorrect;

                            let borderClass = "border-neutral-200";
                            let bgClass = "bg-white hover:bg-neutral-50";
                            let textClass = "text-neutral-700";
                            let labelBg = "bg-neutral-100 text-neutral-500";
                            let cursor = "cursor-pointer";
                            let extraBorder = "";

                            if (isRevealed) {
                                cursor = "cursor-default";
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
                                    extraBorder = "border-dashed";
                                } else {
                                    bgClass = "bg-white";
                                    textClass = "text-neutral-400";
                                    labelBg = "bg-neutral-50 text-neutral-400";
                                }
                            }

                            return (
                                <button
                                    key={label}
                                    onClick={() => handleSelect(currentQuestion.id, label)}
                                    disabled={isRevealed}
                                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg
                    border ${borderClass} ${bgClass} ${cursor}
                    transition-all text-left ${extraBorder}`}
                                >
                                    <span
                                        className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center
                      text-xs font-semibold ${labelBg} transition-colors`}
                                    >
                                        {label}
                                    </span>
                                    <span className={`text-sm ${textClass} flex-1`}>{text}</span>
                                    {isRevealed && isSelected && isCorrect && (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                    )}
                                    {isWrong && (
                                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                    )}
                                    {showCorrectHighlight &&
                                        !isSelected &&
                                        answers[currentQuestion.id] && (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        )}
                                </button>
                            );
                        })}
                    </div>

                    {revealed[currentQuestion.id] && (
                        <div className="mt-5 space-y-3">
                            <div className="flex items-start gap-2">
                                <BookOpen className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs text-neutral-600 leading-relaxed">
                                        {currentQuestion.explanation}
                                    </p>
                                    {(currentQuestion.source.chapter_name ||
                                        currentQuestion.source.subtopic_name) && (
                                            <p className="text-[11px] text-neutral-400 mt-1">
                                                Source:{" "}
                                                {[
                                                    currentQuestion.source.chapter_name,
                                                    currentQuestion.source.subtopic_name,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" › ")}
                                            </p>
                                        )}
                                </div>
                            </div>

                            <button
                                onClick={() => handleAskInChat(currentQuestion)}
                                className="flex items-center gap-1.5 text-xs text-neutral-400
                  hover:text-neutral-600 transition-colors"
                            >
                                <MessageSquare className="w-3 h-3" />
                                Ask in Chat
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <div className="shrink-0 bg-white border-t border-neutral-100 px-6 py-3">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <button
                        onClick={currentIndex === 0 ? handleBack : handlePrev}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              text-sm text-neutral-500 hover:text-neutral-700
              hover:bg-neutral-50 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {currentIndex === 0 ? "All Quizzes" : "Previous"}
                    </button>

                    <button
                        onClick={handleGenerate}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              text-xs text-neutral-400 hover:text-neutral-600
              hover:bg-neutral-50 transition-colors"
                    >
                        <RotateCcw className="w-3 h-3" />
                        New Quiz
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!revealed[currentQuestion.id]}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              text-sm text-neutral-500 hover:text-neutral-700
              hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed
              transition-colors"
                    >
                        {currentIndex === totalQuestions - 1 ? "Finish" : "Next"}
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}