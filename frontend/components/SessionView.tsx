"use client";

import { useSessionStore } from "@/lib/session-store";
import ChatView from "./Chat";
import FileUploadCard from "./FileUploadCard";
import StudyGuideView from "./StudyGuideView";
import QuizView from "./QuizView";
import type { Session } from "@/lib/types";
import {
    Send,
    FileText,
    CheckCircle,
    Circle,
    Sparkles,
    CircleHelp,
} from "lucide-react";

interface Props {
    session: Session;
}

export default function SessionView({ session }: Props) {
    const { activeView } = useSessionStore();

    return (
        <div className="flex flex-col h-full min-h-0">
            {activeView === "quickstart" && <QuickStartView session={session} />}
            {activeView === "documents" && <DocumentsView session={session} />}
            {activeView === "chat" && <ChatView session={session} />}
            {activeView === "guide" && <StudyGuideView session={session} />}
            {activeView === "quiz" && <QuizView session={session} />}
        </div>
    );
}

/* ─── Quick Start (onboarding timeline) ──────────────────────────── */
function QuickStartView({ session }: { session: Session }) {
    const { setActiveView, setActiveConversation } = useSessionStore();

    const totalDocs = session.documents.filter((d) => d.status === "success").length;
    const hasSyllabus = session.documents.some(
        (d) => d.type === "syllabus" && d.status === "success"
    );
    const hasNotes = session.documents.some(
        (d) => d.type === "notes" && d.status === "success"
    );
    const hasGuide = session.cachedGuide !== null && session.cachedGuide !== undefined;
    const hasChats = session.conversations.length > 0;

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
            done: totalDocs > 0,
            action: () => setActiveView("documents"),
        },
        {
            id: "guide",
            label: "Get Study Insights",
            description: "Generate a study guide from your materials",
            done: hasGuide,
            action: hasSyllabus ? () => setActiveView("guide") : undefined,
        },
        {
            id: "quiz",
            label: "Test Your Knowledge",
            description: "Generate quizzes from your course materials",
            done: (session.quizRecords || []).length > 0,
            action: totalDocs > 0 ? () => setActiveView("quiz") : undefined,
        },
        {
            id: "chat",
            label: "Chat With Your Documents",
            description: "Ask questions and get course-based answers",
            done: hasChats,
            action: hasNotes
                ? () => {
                    setActiveConversation(null);
                    setActiveView("chat");
                }
                : undefined,
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
                        <p className="text-sm text-neutral-500">{session.description}</p>
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
                                                <CheckCircle className="w-4 h-4 text-white" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full border-2 border-neutral-300 bg-white flex items-center justify-center">
                                                <Circle className="w-3 h-3 text-neutral-300" />
                                            </div>
                                        )}
                                    </div>
                                    {!isLast && (
                                        <div
                                            className={`w-px flex-1 min-h-[48px] ${step.done ? "bg-neutral-900" : "bg-neutral-200"
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