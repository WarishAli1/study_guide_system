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
} from "lucide-react";
import { quizAPI } from "@/lib/api";
import { useSessionStore } from "@/lib/session-store";
import type { Session } from "@/lib/types";
import type { QuizData, QuizQuestion } from "@/lib/types";

interface Props {
    session: Session;
}

export default function QuizView({ session }: Props) {
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [revealed, setRevealed] = useState<Record<number, boolean>>({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showScore, setShowScore] = useState(false);

    const { setActiveView, setActiveConversation, setPendingChatPrompt } =
        useSessionStore();

    // Auto-generate on mount
    useEffect(() => {
        handleGenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setQuiz(null);
        setAnswers({});
        setRevealed({});
        setCurrentIndex(0);
        setShowScore(false);
        try {
            const res = await quizAPI.generate(session.name);
            setQuiz(res.data as QuizData);
        } catch (err: any) {
            setError(
                err?.response?.data?.detail ||
                "Failed to generate quiz. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (questionId: number, option: string) => {
        if (revealed[questionId]) return;
        setAnswers((prev) => ({ ...prev, [questionId]: option }));
        setRevealed((prev) => ({ ...prev, [questionId]: true }));
    };

    const handleNext = () => {
        if (!quiz) return;
        if (currentIndex < quiz.questions.length - 1) {
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

    const handleAskInChat = (question: QuizQuestion) => {
        const prompt = `Explain this in detail: ${question.question}`;
        setActiveConversation(null);
        setPendingChatPrompt(prompt);
        setActiveView("chat");
    };

    const answeredCount = Object.keys(revealed).length;
    const totalQuestions = quiz?.total_questions || 0;
    const correctCount = quiz
        ? quiz.questions.filter((q) => answers[q.id] === q.correct).length
        : 0;
    const progressPercent =
        totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

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

    if (error && !quiz) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center max-w-sm px-6">
                    <p className="text-sm text-red-500 mb-4">{error}</p>
                    <button
                        onClick={handleGenerate}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
              bg-neutral-900 text-white text-sm font-medium
              hover:bg-neutral-800 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!quiz) return null;

    const currentQuestion = quiz.questions[currentIndex];

    // Score screen
    if (showScore) {
        return (
            <div className="flex flex-col h-full min-h-0">
                {/* Progress bar — full */}
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
                                onClick={handleGenerate}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                  bg-neutral-900 text-white text-sm font-medium
                  hover:bg-neutral-800 transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Try Another Quiz
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
                    {/* Question counter */}
                    <p className="text-xs text-neutral-400 mb-4">
                        {currentIndex + 1} / {totalQuestions}
                    </p>

                    {/* Question text */}
                    <h2 className="text-base font-medium text-neutral-900 leading-relaxed mb-8">
                        {currentQuestion.question}
                    </h2>

                    {/* Options */}
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

                    {/* Explanation — shown after answering */}
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

                            {/* Ask in Chat button */}
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
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              text-sm text-neutral-500 hover:text-neutral-700
              hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed
              transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Previous
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