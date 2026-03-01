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

/* ─── Session Dashboard (onboarding / overview) ──────────────────────── */
function SessionDashboard({ session }: { session: Session }) {
    const { setActiveView, setActiveConversation } = useSessionStore();

    const totalDocs = session.documents.filter((d) => d.status === "success").length;
    const hasSyllabus = session.documents.some(
        (d) => d.type === "syllabus" && d.status === "success"
    );
    const hasGuide = session.cachedGuide !== null;
    const hasChats = session.conversations.length > 0;

    // Show onboarding timeline only when no documents uploaded yet
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
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="max-w-xl mx-auto px-6 py-12">
                    <div className="mb-10">
                        <h1 className="text-xl font-semibold text-neutral-900 mb-1">
                            {session.name}
                        </h1>
                        {session.description && (
                            <p className="text-sm text-neutral-500">
                                {session.description}
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
                                                className={`w-px flex-1 min-h-[48px] ${step.done
                                                    ? "bg-neutral-900"
                                                    : "bg-neutral-200"
                                                    }`}
                                            />
                                        )}
                                    </div>
                                    <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
                                        <div
                                            onClick={step.action}
                                            className={`pt-1 rounded-lg px-3 py-2 -mx-3 -mt-1 transition-colors ${isClickable
                                                ? "cursor-pointer hover:bg-neutral-50"
                                                : ""
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
                                                className={`text-xs mt-0.5 ${isClickable
                                                    ? "text-neutral-500"
                                                    : "text-neutral-400"
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

    // Session overview when documents exist
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
        <div className="flex-1 overflow-y-auto min-h-0">
            <div className="max-w-2xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-xl font-semibold text-neutral-900 mb-1">
                        {session.name}
                    </h1>
                    {session.description && (
                        <p className="text-sm text-neutral-500">{session.description}</p>
                    )}
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                    <div
                        className="border border-neutral-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors"
                        onClick={() => setActiveView("documents")}
                    >
                        <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                            Documents
                        </p>
                        <p className="text-lg font-semibold text-neutral-900">{totalDocs}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                            {noteCount}N · {syllabusCount}S · {pastPaperCount}Q
                        </p>
                    </div>
                    <div
                        className="border border-neutral-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors"
                        onClick={() => {
                            setActiveConversation(null);
                            setActiveView("chat");
                        }}
                    >
                        <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                            Chats
                        </p>
                        <p className="text-lg font-semibold text-neutral-900">
                            {session.conversations.length}
                        </p>
                    </div>
                    <div
                        className={`border border-neutral-200 rounded-lg px-4 py-3 transition-colors ${hasSyllabus
                            ? "cursor-pointer hover:bg-neutral-50"
                            : "opacity-60"
                            }`}
                        onClick={() => hasSyllabus && setActiveView("guide")}
                    >
                        <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                            Study Guide
                        </p>
                        <p className="text-lg font-semibold text-neutral-900">
                            {hasGuide ? "✓" : "—"}
                        </p>
                    </div>
                    <div className="border border-neutral-200 rounded-lg px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                            Created
                        </p>
                        <p className="text-sm font-medium text-neutral-700">
                            {new Date(session.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                            })}
                        </p>
                    </div>
                </div>

                {/* Quick actions */}
                <div className="space-y-2">
                    <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                        Quick Actions
                    </h2>
                    <button
                        onClick={() => setActiveView("documents")}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200
              hover:border-neutral-300 hover:bg-neutral-50 transition-all text-left"
                    >
                        <FileText className="w-4 h-4 text-neutral-400" />
                        <div>
                            <p className="text-sm font-medium text-neutral-700">
                                Manage Documents
                            </p>
                            <p className="text-xs text-neutral-400">
                                Upload or remove study materials
                            </p>
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setActiveConversation(null);
                            setActiveView("chat");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200
              hover:border-neutral-300 hover:bg-neutral-50 transition-all text-left"
                    >
                        <Send className="w-4 h-4 text-neutral-400" />
                        <div>
                            <p className="text-sm font-medium text-neutral-700">
                                New Chat
                            </p>
                            <p className="text-xs text-neutral-400">
                                Ask questions about your documents
                            </p>
                        </div>
                    </button>
                    {hasSyllabus && (
                        <button
                            onClick={() => setActiveView("guide")}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200
                hover:border-neutral-300 hover:bg-neutral-50 transition-all text-left"
                        >
                            <Sparkles className="w-4 h-4 text-neutral-400" />
                            <div>
                                <p className="text-sm font-medium text-neutral-700">
                                    {hasGuide ? "View Study Guide" : "Generate Study Guide"}
                                </p>
                                <p className="text-xs text-neutral-400">
                                    Chapter analysis, priorities & exam tips
                                </p>
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Documents View ─────────────────────────────────────────────────── */
function DocumentsView({ session }: { session: Session }) {
    return (
        <div className="flex-1 overflow-y-auto min-h-0">
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