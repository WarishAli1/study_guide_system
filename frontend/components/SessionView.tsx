"use client";

import { useSessionStore } from "@/lib/session-store";
import ChatView from "./Chat";
import QuizView from "./QuizView";
import FileUploadCard from "./FileUploadCard";
import StudyGuideView from "./StudyGuideView";
import type { Session } from "@/lib/types";
import {
    Send,
    FileText,
    CheckCircle2,
    Circle,
    Sparkles,
    BookOpen,
    MessageCircle,
    GraduationCap,
    CalendarDays,
    ArrowRight,
} from "lucide-react";

interface Props {
    session: Session;
}

export default function SessionView({ session }: Props) {
    const { activeView } = useSessionStore();

    return (
        <div className="flex flex-col h-full min-h-0">
            {activeView === "dashboard" && <SessionDashboard session={session} />}
            {activeView === "documents" && <DocumentsView session={session} />}
            {activeView === "chat" && <ChatView session={session} />}
            {activeView === "guide" && <StudyGuideView session={session} />}
            {activeView === "quiz" && <QuizView session={session} />}
        </div>
    );
}



/* ─── Session Dashboard ──────────────────────────────────────────────── */
function SessionDashboard({ session }: { session: Session }) {
    const { setActiveView, setActiveConversation } = useSessionStore();

    const totalDocs = session.documents.filter((d) => d.status === "success").length;
    const hasSyllabus = session.documents.some(
        (d) => d.type === "syllabus" && d.status === "success"
    );
    const hasGuide = session.cachedGuide !== null;
    const showOnboarding = totalDocs === 0;

    if (showOnboarding) {
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
                done: false,
                action: () => setActiveView("documents"),
            },
            {
                id: "guide",
                label: "Get Study Insights",
                description: "Generate a study guide from your materials",
                done: false,
                action: undefined,
            },
            {
                id: "chat",
                label: "Chat With Your Documents",
                description: "Ask questions and get course based answers",
                done: false,
                action: undefined,
            },
        ];

        return (
            <div className="flex-1 overflow-y-auto min-h-0 bg-gradient-to-b from-slate-50 to-white">
                <div className="max-w-xl mx-auto px-6 py-12">
                    {/* Header */}
                    <div className="mb-10">
                        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 mb-4">
                            <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-xs font-medium text-indigo-600">New Session</span>
                        </div>
                        <h1 className="text-2xl font-bold text-neutral-900 mb-1 tracking-tight">
                            {session.name}
                        </h1>
                        {session.description && (
                            <p className="text-sm text-neutral-500">{session.description}</p>
                        )}
                    </div>

                    {/* Steps */}
                    <div className="relative">
                        {steps.map((step, index) => {
                            const isLast = index === steps.length - 1;
                            const isClickable = !!step.action;
                            return (
                                <div key={step.id} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="relative z-10">
                                            {step.done ? (
                                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
                                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full border-2 border-neutral-200 bg-white flex items-center justify-center">
                                                    <Circle className="w-3 h-3 text-neutral-300" />
                                                </div>
                                            )}
                                        </div>
                                        {!isLast && (
                                            <div
                                                className={`w-px flex-1 min-h-[48px] ${
                                                    step.done ? "bg-indigo-200" : "bg-neutral-200"
                                                }`}
                                            />
                                        )}
                                    </div>
                                    <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
                                        <div
                                            onClick={step.action}
                                            className={`pt-1 rounded-xl px-3 py-2 -mx-3 -mt-1 transition-all ${
                                                isClickable
                                                    ? "cursor-pointer hover:bg-indigo-50/60 group"
                                                    : ""
                                            }`}
                                        >
                                            <h3
                                                className={`text-sm font-semibold flex items-center gap-1.5 ${
                                                    step.done
                                                        ? "text-neutral-900"
                                                        : isClickable
                                                        ? "text-neutral-700 group-hover:text-indigo-700"
                                                        : "text-neutral-400"
                                                }`}
                                            >
                                                {step.label}
                                                {isClickable && (
                                                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
                                                )}
                                            </h3>
                                            <p
                                                className={`text-xs mt-0.5 ${
                                                    isClickable ? "text-neutral-500" : "text-neutral-400"
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

    // Session overview
    const noteCount = session.documents.filter(
        (d) => d.type === "notes" && d.status === "success"
    ).length;
    const syllabusCount = session.documents.filter(
        (d) => d.type === "syllabus" && d.status === "success"
    ).length;
    const pastPaperCount = session.documents.filter(
        (d) => d.type === "past_paper" && d.status === "success"
    ).length;

    return (
        <div className="flex-1 overflow-y-auto min-h-0 bg-gradient-to-b from-slate-50 to-white">
            <div className="max-w-2xl mx-auto px-6 py-10">

                {/* Header */}
                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 mb-3">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-xs font-medium text-indigo-600">Study Session</span>
                    </div>
                    <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-1">
                        {session.name}
                    </h1>
                    {session.description && (
                        <p className="text-sm text-neutral-500">{session.description}</p>
                    )}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                    <div
                        className="group relative rounded-xl border border-neutral-200 bg-white px-4 py-4 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all overflow-hidden"
                        onClick={() => setActiveView("documents")}
                    >
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-300 rounded-t-xl" />
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <BookOpen className="w-4 h-4 text-indigo-400 mb-2 relative z-10" />
                        <p className="text-2xl font-bold text-neutral-900 relative z-10">{totalDocs}</p>
                        <p className="text-[11px] font-medium text-neutral-500 mt-0.5 relative z-10">Documents</p>
                        <p className="text-[10px] text-neutral-400 mt-1 relative z-10">
                            {noteCount}N · {syllabusCount}S · {pastPaperCount}Q
                        </p>
                    </div>

                    <div
                        className="group relative rounded-xl border border-neutral-200 bg-white px-4 py-4 cursor-pointer hover:border-sky-200 hover:shadow-sm transition-all overflow-hidden"
                        onClick={() => { setActiveConversation(null); setActiveView("chat"); }}
                    >
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-sky-300 rounded-t-xl" />
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <MessageCircle className="w-4 h-4 text-sky-400 mb-2 relative z-10" />
                        <p className="text-2xl font-bold text-neutral-900 relative z-10">{session.conversations.length}</p>
                        <p className="text-[11px] font-medium text-neutral-500 mt-0.5 relative z-10">Chats</p>
                    </div>

                    <div
                        className={`group relative rounded-xl border border-neutral-200 bg-white px-4 py-4 transition-all overflow-hidden ${
                            hasSyllabus ? "cursor-pointer hover:border-teal-200 hover:shadow-sm" : "opacity-50"
                        }`}
                        onClick={() => hasSyllabus && setActiveView("guide")}
                    >
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-teal-300 rounded-t-xl" />
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Sparkles className="w-4 h-4 text-teal-400 mb-2 relative z-10" />
                        <p className="text-2xl font-bold text-neutral-900 relative z-10">{hasGuide ? "✓" : "—"}</p>
                        <p className="text-[11px] font-medium text-neutral-500 mt-0.5 relative z-10">Study Guide</p>
                    </div>

                    <div className="relative rounded-xl border border-neutral-200 bg-white px-4 py-4 overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-neutral-200 rounded-t-xl" />
                        <CalendarDays className="w-4 h-4 text-neutral-300 mb-2 relative z-10" />
                        <p className="text-lg font-bold text-neutral-900 relative z-10">
                            {new Date(session.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                        <p className="text-[11px] font-medium text-neutral-500 mt-0.5 relative z-10">Created</p>
                    </div>
                </div>

                {/* Quick actions */}
                <div>
                    <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">
                        Quick Actions
                    </h2>
                    <div className="space-y-2">
                        <button
                            onClick={() => setActiveView("documents")}
                            className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-neutral-200 bg-white
                                hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left"
                        >
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors shrink-0">
                                <FileText className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-neutral-800">Manage Documents</p>
                                <p className="text-xs text-neutral-400">Upload or remove study materials</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>

                        <button
                            onClick={() => { setActiveConversation(null); setActiveView("chat"); }}
                            className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-neutral-200 bg-white
                                hover:border-sky-200 hover:bg-sky-50/30 transition-all text-left"
                        >
                            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center group-hover:bg-sky-100 transition-colors shrink-0">
                                <Send className="w-4 h-4 text-sky-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-neutral-800">New Chat</p>
                                <p className="text-xs text-neutral-400">Ask questions about your documents</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>

                        {hasSyllabus && (
                            <button
                                onClick={() => setActiveView("guide")}
                                className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-neutral-200 bg-white
                                    hover:border-teal-200 hover:bg-teal-50/30 transition-all text-left"
                            >
                                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors shrink-0">
                                    <Sparkles className="w-4 h-4 text-teal-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-neutral-800">
                                        {hasGuide ? "View Study Guide" : "Generate Study Guide"}
                                    </p>
                                    <p className="text-xs text-neutral-400">Chapter analysis, priorities & exam tips</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Documents View ─────────────────────────────────────────────────── */
function DocumentsView({ session }: { session: Session }) {
    return (
        <div className="flex-1 overflow-y-auto min-h-0 bg-gradient-to-b from-slate-50 to-white">
            <div className="max-w-5xl mx-auto px-6 py-6">
                <div className="mb-5">
                    <h2 className="text-base font-bold text-neutral-900 tracking-tight">Documents</h2>
                    <p className="text-sm text-neutral-500 mt-0.5">
                        Upload and manage your study materials
                    </p>
                </div>
                <FileUploadCard sessionId={session.id} existingDocuments={session.documents} />
            </div>
        </div>
    );
}