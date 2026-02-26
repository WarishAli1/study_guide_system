"use client";

import { useState } from "react";
import { useSessionStore } from "@/lib/session-store";
import SessionView from "@/components/SessionView";
import CreateSessionModal from "@/components/CreateSessionModal";
import {
    Plus,
    FileText,
    Send,
    Calendar,
    FolderOpen,
} from "lucide-react";

export default function DashboardPage() {
    const { sessions, activeSessionId, getActiveSession, setActiveSession } =
        useSessionStore();
    const [ssModalOpen, setSsModalOpen] = useState(false);
    const activeSession = getActiveSession();

    if (activeSession) {
        return <SessionView session={activeSession} />;
    }

    return (
        <>
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-14">
                    {/* Hero section */}
                    <div className="mb-12">
                        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
                            ExamGuide
                        </h1>
                        <p className="text-sm text-neutral-500 mb-6">
                            Your AI-powered exam preparation assistant.
                        </p>

                        <div className="space-y-2.5 mb-8">
                            <div className="flex items-start gap-3">
                                <span className="text-neutral-300 text-sm mt-0.5 shrink-0">—</span>
                                <p className="text-sm text-neutral-600">
                                    Upload your course notes, syllabus, and past papers to build a personalized study session.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-neutral-300 text-sm mt-0.5 shrink-0">—</span>
                                <p className="text-sm text-neutral-600">
                                    Generate study guides with chapter-level importance scores, time allocation, and exam tips.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-neutral-300 text-sm mt-0.5 shrink-0">—</span>
                                <p className="text-sm text-neutral-600">
                                    Chat with your documents to get answers grounded in your course materials, with inline citations.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-neutral-300 text-sm mt-0.5 shrink-0">—</span>
                                <p className="text-sm text-neutral-600">
                                    Identify frequently asked exam questions and track which topics carry the most marks.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setSsModalOpen(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                                bg-neutral-900 text-white text-sm font-medium
                                hover:bg-neutral-800 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create Session
                        </button>
                    </div>

                    {/* Previous sessions */}
                    {sessions.length > 0 && (
                        <div>
                            <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                                Previous Sessions
                            </h2>
                            <div className="space-y-1.5">
                                {sessions.map((session) => {
                                    const docCount = session.documents.filter(
                                        (d) => d.status === "success"
                                    ).length;
                                    const chatCount = session.conversations.length;
                                    const noteCount = session.documents.filter(
                                        (d) =>
                                            d.type === "notes" &&
                                            d.status === "success"
                                    ).length;
                                    const syllabusCount = session.documents.filter(
                                        (d) =>
                                            d.type === "syllabus" &&
                                            d.status === "success"
                                    ).length;
                                    const pastPaperCount = session.documents.filter(
                                        (d) =>
                                            d.type === "past_paper" &&
                                            d.status === "success"
                                    ).length;
                                    const hasGuide = session.cachedGuide !== null;

                                    return (
                                        <div
                                            key={session.id}
                                            onClick={() =>
                                                setActiveSession(session.id)
                                            }
                                            className="group flex items-center gap-4 px-5 py-4 rounded-xl
                                                border border-neutral-200 hover:border-neutral-300
                                                hover:bg-neutral-50/50 transition-all cursor-pointer"
                                        >
                                            <div
                                                className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center
                                                    justify-center shrink-0 group-hover:bg-neutral-200/70 transition-colors"
                                            >
                                                <FolderOpen className="w-5 h-5 text-neutral-400" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-medium text-neutral-900 truncate">
                                                    {session.name}
                                                </h3>
                                                {session.description && (
                                                    <p className="text-xs text-neutral-400 truncate mt-0.5">
                                                        {session.description}
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-3 mt-1.5">
                                                    {docCount > 0 && (
                                                        <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                                                            <FileText className="w-3 h-3" />
                                                            {docCount} doc
                                                            {docCount !== 1
                                                                ? "s"
                                                                : ""}
                                                            <span className="text-neutral-300 ml-0.5">
                                                                ({noteCount}N ·{" "}
                                                                {syllabusCount}S ·{" "}
                                                                {pastPaperCount}Q)
                                                            </span>
                                                        </span>
                                                    )}
                                                    {chatCount > 0 && (
                                                        <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                                                            <Send className="w-3 h-3" />
                                                            {chatCount} chat
                                                            {chatCount !== 1
                                                                ? "s"
                                                                : ""}
                                                        </span>
                                                    )}
                                                    {hasGuide && (
                                                        <span className="text-[11px] text-neutral-400">
                                                            Guide generated
                                                        </span>
                                                    )}
                                                    {docCount === 0 &&
                                                        chatCount === 0 && (
                                                            <span className="text-[11px] text-neutral-400 italic">
                                                                No documents yet
                                                            </span>
                                                        )}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="flex items-center gap-1 text-xs text-neutral-400">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(
                                                        session.createdAt
                                                    ).toLocaleDateString(
                                                        "en-US",
                                                        {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        }
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <CreateSessionModal
                open={ssModalOpen}
                onClose={() => setSsModalOpen(false)}
            />
        </>
    );
}