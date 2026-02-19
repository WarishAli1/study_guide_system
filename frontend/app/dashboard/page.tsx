"use client";

import { useState } from "react";
import { useSessionStore } from "@/lib/session-store";
import SessionView from "@/components/SessionView";
import CreateSessionModal from "@/components/CreateSessionModal";
import { Plus, MessageSquare, BookOpen } from "lucide-react";

export default function DashboardPage() {
    const { sessions, activeSessionId, getActiveSession, setActiveSession } = useSessionStore();
    const [ssModalOpen, setSsModalOpen] = useState(false);
    const activeSession = getActiveSession();

    if (activeSession) {
        return <SessionView session={activeSession} />;
    }

    return (
        <>
            <div className="max-w-2xl mx-auto px-6 py-16">
                <div className="text-center mb-10">
                    <BookOpen className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                    <h1 className="text-xl font-semibold text-neutral-900 mb-1">
                        Welcome to ExamGuide
                    </h1>
                    <p className="text-sm text-neutral-500 max-w-md mx-auto">
                        Create a session to start uploading your study materials and generating exam guides.
                    </p>
                </div>

                {sessions.length > 0 ? (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-medium text-neutral-700">Your Sessions</h2>
                            <button
                                onClick={() => setSsModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
                            >
                                <Plus className="w-3 h-3" />
                                New
                            </button>
                        </div>
                        <div className="space-y-1">
                            {sessions.map((session) => {
                                const docCount = session.documents.filter((d) => d.status === "success").length;
                                return (
                                    <div
                                        key={session.id}
                                        onClick={() => setActiveSession(session.id)}
                                        className="flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200
                               hover:border-neutral-300 hover:bg-neutral-50 transition-all cursor-pointer"
                                    >
                                        <MessageSquare className="w-4 h-4 text-neutral-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-medium text-neutral-900 truncate">
                                                {session.name}
                                            </h3>
                                            {session.description && (
                                                <p className="text-xs text-neutral-400 truncate">{session.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-neutral-400 shrink-0">
                                            {docCount > 0 && <span>{docCount} doc{docCount !== 1 ? "s" : ""}</span>}
                                            <span>
                                                {new Date(session.updatedAt).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <button
                            onClick={() => setSsModalOpen(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                         bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create Your First Session
                        </button>
                    </div>
                )}
            </div>

            <CreateSessionModal open={ssModalOpen} onClose={() => setSsModalOpen(false)} />
        </>
    );
}