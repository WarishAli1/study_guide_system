"use client";

import { useState } from "react";
import {
    Loader2, CheckCircle2, XCircle, RotateCcw, BookOpen,
    ArrowRight, ArrowLeft, MessageSquare, Plus, Trash2,
    CircleHelp, Trophy,
} from "lucide-react";
import { quizAPI } from "@/lib/api";
import { useSessionStore } from "@/lib/session-store";
import type { Session, QuizRecord, QuizQuestion, QuizData } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

interface Props { session: Session; }

export default function QuizView({ session }: Props) {
    const { setActiveView, setActiveConversation, setPendingChatPrompt, addQuizRecord, deleteQuizRecord } = useSessionStore();

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
    const canGenerateQuiz = session.documents.some((d) => d.status === "success");

    const handleGenerate = async (newQuiz = false) => {
        setLoading(true);
        setError(null);
        try {
            const res = await quizAPI.generate(session.name, newQuiz);
            const data = res.data as QuizData;
            const record: QuizRecord = {
                id: uuidv4(), createdAt: new Date().toISOString(),
                subject: data.subject, totalQuestions: data.total_questions,
                answers: {}, revealed: {}, questions: data.questions,
            };
            addQuizRecord(session.id, record);
            setActiveQuiz(record); setAnswers({}); setRevealed({});
            setCurrentIndex(0); setShowScore(false);
        } catch (err: any) {
            setError(err?.response?.data?.detail || "Failed to generate quiz.");
        } finally { setLoading(false); }
    };

    const handleOpenRecord = (record: QuizRecord) => {
        setActiveQuiz(record);
        setAnswers(record.answers || {}); setRevealed(record.revealed || {});
        setCurrentIndex(0);
        setShowScore(Object.keys(record.revealed || {}).length >= record.totalQuestions);
    };

    const handleDeleteRecord = (e: React.MouseEvent, quizId: string) => {
        e.stopPropagation();
        if (confirmDelete === quizId) {
            deleteQuizRecord(session.id, quizId);
            if (activeQuiz?.id === quizId) setActiveQuiz(null);
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
        setAnswers(newAnswers); setRevealed(newRevealed);
        if (activeQuiz) {
            const updated = { ...activeQuiz, answers: newAnswers, revealed: newRevealed };
            deleteQuizRecord(session.id, activeQuiz.id);
            addQuizRecord(session.id, updated);
            setActiveQuiz(updated);
        }
    };

    const handleNext = () => {
        if (!activeQuiz) return;
        currentIndex < activeQuiz.questions.length - 1 ? setCurrentIndex((i) => i + 1) : setShowScore(true);
    };

    const handlePrev = () => {
        if (showScore) { setShowScore(false); return; }
        if (currentIndex > 0) setCurrentIndex((i) => i - 1);
    };

    const handleAskInChat = (question: QuizQuestion) => {
        setActiveConversation(null);
        setPendingChatPrompt(`Explain this in detail: ${question.question}`);
        setActiveView("chat");
    };

    // Loading
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full bg-[#F8FAFF]">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                    <p className="text-sm text-slate-600 font-medium">Generating quiz from your documents...</p>
                </div>
            </div>
        );
    }

    // Quiz list
    if (!activeQuiz) {
        return (
            <div className="flex flex-col h-full overflow-y-auto bg-[#F8FAFF]">
                <div className="max-w-5xl mx-auto w-full px-6 py-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Quiz</h2>
                            <p className="text-sm text-slate-400 mt-0.5">Test your knowledge with MCQ quizzes</p>
                        </div>
                        <button
                            onClick={() => handleGenerate(true)} disabled={!canGenerateQuiz}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
                        >
                            <Plus className="w-4 h-4" /> New Quiz
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {!canGenerateQuiz && (
                        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
                            <p className="text-xs text-amber-700">Upload at least one document to generate quizzes.</p>
                        </div>
                    )}

                    {quizRecords.length > 0 ? (
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-3">Previous Quizzes</p>
                            <div className="space-y-2">
                                {[...quizRecords].reverse().map((record) => {
                                    const answeredCount = Object.keys(record.revealed || {}).length;
                                    const correctCount = record.questions.filter((q) => (record.answers || {})[q.id] === q.correct).length;
                                    const isComplete = answeredCount >= record.totalQuestions;
                                    const scorePercent = isComplete ? Math.round((correctCount / record.totalQuestions) * 100) : null;
                                    const scorePillClass = scorePercent == null ? "" :
                                        scorePercent >= 70 ? "text-emerald-600 bg-emerald-50 border border-emerald-100" :
                                        scorePercent >= 40 ? "text-amber-600 bg-amber-50 border border-amber-100" :
                                        "text-red-500 bg-red-50 border border-red-100";

                                    return (
                                        <div
                                            key={record.id}
                                            onClick={() => handleOpenRecord(record)}
                                            onMouseEnter={() => setHoveredRecord(record.id)}
                                            onMouseLeave={() => setHoveredRecord(null)}
                                            className="border border-blue-100 rounded-xl px-4 py-3.5 bg-white hover:border-blue-200 hover:shadow-sm hover:shadow-blue-50 cursor-pointer transition-all"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                            <CircleHelp className="w-3.5 h-3.5 text-blue-500" />
                                                        </div>
                                                        <p className="text-sm font-medium text-slate-900">{record.totalQuestions} Questions</p>
                                                        {isComplete && scorePercent !== null && (
                                                            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium ${scorePillClass}`}>
                                                                <Trophy className="w-3 h-3" />{correctCount}/{record.totalQuestions}
                                                            </span>
                                                        )}
                                                        {!isComplete && answeredCount > 0 && (
                                                            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                                                                {answeredCount}/{record.totalQuestions} answered
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 mt-1 ml-9">
                                                        {new Date(record.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                    </p>
                                                </div>
                                                {hoveredRecord === record.id ? (
                                                    <button
                                                        onClick={(e) => handleDeleteRecord(e, record.id)}
                                                        className={`p-1.5 rounded-md transition-colors shrink-0 ${confirmDelete === record.id ? "bg-red-100 text-red-500" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <ArrowRight className="w-4 h-4 text-blue-300 shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : canGenerateQuiz && (
                        <div className="text-center py-12 border-2 border-dashed border-blue-100 rounded-xl bg-blue-50/20">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
                                <CircleHelp className="w-6 h-6 text-blue-400" />
                            </div>
                            <p className="text-sm text-slate-500 mb-1 font-medium">No quizzes yet</p>
                            <p className="text-xs text-slate-400">Generate your first quiz to test your knowledge</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const currentQuestion = activeQuiz.questions[currentIndex];
    const answeredCount = Object.keys(revealed).length;
    const totalQuestions = activeQuiz.totalQuestions;
    const correctCount = activeQuiz.questions.filter((q) => answers[q.id] === q.correct).length;
    const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

    // Score screen
    if (showScore) {
        const scorePercent = Math.round((correctCount / totalQuestions) * 100);
        const scoreColor = scorePercent >= 70 ? "text-emerald-600" : scorePercent >= 40 ? "text-amber-500" : "text-red-500";
        const scoreBg = scorePercent >= 70 ? "bg-emerald-50 border-emerald-100" : scorePercent >= 40 ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100";
        return (
            <div className="flex flex-col h-full min-h-0 bg-[#F8FAFF]">
                <div className="shrink-0 h-1 bg-blue-100"><div className="h-full bg-blue-500 w-full" /></div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-2 mb-6 ${scoreBg}`}>
                            <Trophy className={`w-10 h-10 ${scoreColor}`} />
                        </div>
                        <p className={`text-4xl font-bold mb-1 ${scoreColor}`}>{correctCount}/{totalQuestions}</p>
                        <p className="text-sm text-slate-400 mb-8">{scorePercent}% correct</p>
                        <div className="flex items-center gap-3 justify-center">
                            <button onClick={() => { setActiveQuiz(null); setShowScore(false); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                                <ArrowLeft className="w-3.5 h-3.5" /> All Quizzes
                            </button>
                            <button onClick={() => handleGenerate(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
                                <RotateCcw className="w-3.5 h-3.5" /> New Quiz
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0 bg-[#F8FAFF]">
            {/* Progress bar */}
            <div className="shrink-0 h-1 bg-blue-100">
                <div className="h-full bg-blue-500 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="max-w-xl mx-auto px-6 py-10">
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-xs text-slate-400">
                            Question <span className="font-semibold text-slate-600">{currentIndex + 1}</span> of {totalQuestions}
                        </p>
                        <span className="text-xs text-slate-400">{answeredCount} answered</span>
                    </div>

                    <h2 className="text-base font-medium text-slate-900 leading-relaxed mb-8">{currentQuestion.question}</h2>

                    <div className="space-y-2.5">
                        {(["A", "B", "C", "D"] as const).map((label) => {
                            const text = currentQuestion.options[label as keyof typeof currentQuestion.options];
                            const isCorrect = label === currentQuestion.correct;
                            const isSelected = label === answers[currentQuestion.id];
                            const isRevealed = !!revealed[currentQuestion.id];
                            const isWrong = isRevealed && isSelected && !isCorrect;
                            const showCorrectHighlight = isRevealed && isCorrect;

                            let borderClass = "border-slate-200";
                            let bgClass = "bg-white hover:bg-blue-50/40 hover:border-blue-200";
                            let textClass = "text-slate-700";
                            let labelBg = "bg-slate-100 text-slate-500";
                            let cursor = "cursor-pointer";
                            let extraBorder = "";

                            if (isRevealed) {
                                cursor = "cursor-default";
                                if (isSelected && isCorrect) {
                                    borderClass = "border-emerald-300"; bgClass = "bg-emerald-50";
                                    textClass = "text-emerald-900"; labelBg = "bg-emerald-200 text-emerald-800";
                                } else if (isWrong) {
                                    borderClass = "border-red-300"; bgClass = "bg-red-50";
                                    textClass = "text-red-900"; labelBg = "bg-red-200 text-red-800";
                                } else if (showCorrectHighlight && !isSelected) {
                                    borderClass = "border-emerald-300"; bgClass = "bg-white";
                                    textClass = "text-emerald-800"; labelBg = "bg-emerald-100 text-emerald-700";
                                    extraBorder = "border-dashed";
                                } else {
                                    bgClass = "bg-white"; textClass = "text-slate-400"; labelBg = "bg-slate-50 text-slate-400";
                                }
                            }

                            return (
                                <button
                                    key={label}
                                    onClick={() => handleSelect(currentQuestion.id, label)}
                                    disabled={isRevealed}
                                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg border ${borderClass} ${bgClass} ${cursor} transition-all text-left ${extraBorder}`}
                                >
                                    <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold ${labelBg} transition-colors`}>{label}</span>
                                    <span className={`text-sm ${textClass} flex-1`}>{text}</span>
                                    {isRevealed && isSelected && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                                    {isWrong && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                                    {showCorrectHighlight && !isSelected && answers[currentQuestion.id] && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>

                    {revealed[currentQuestion.id] && (
                        <div className="mt-5 space-y-3">
                            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-blue-50 border border-blue-100">
                                <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs text-slate-700 leading-relaxed">{currentQuestion.explanation}</p>
                                    {(currentQuestion.source.chapter_name || currentQuestion.source.subtopic_name) && (
                                        <p className="text-[11px] text-blue-500 mt-1">
                                            Source: {[currentQuestion.source.chapter_name, currentQuestion.source.subtopic_name].filter(Boolean).join(" › ")}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => handleAskInChat(currentQuestion)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors">
                                <MessageSquare className="w-3 h-3" /> Ask in Chat
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <div className="shrink-0 bg-white border-t border-blue-50 px-6 py-3">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <button onClick={currentIndex === 0 ? () => { setActiveQuiz(null); setShowScore(false); } : handlePrev} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" />{currentIndex === 0 ? "All Quizzes" : "Previous"}
                    </button>
                    <button onClick={() => handleGenerate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <RotateCcw className="w-3 h-3" /> New Quiz
                    </button>
                    <button onClick={handleNext} disabled={!revealed[currentQuestion.id]} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        {currentIndex === totalQuestions - 1 ? "Finish" : "Next"}<ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}