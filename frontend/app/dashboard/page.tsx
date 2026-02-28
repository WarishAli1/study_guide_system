"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useSessionStore } from "@/lib/session-store";
import SessionView from "@/components/SessionView";
import { Plus, MessageSquare, Trash2 } from "lucide-react";

export default function DashboardPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const { getActiveSession } = useSessionStore();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.replace("/login");
    }, [isAuthenticated, isLoading, router]);

    if (isLoading || !isAuthenticated) return null;

    const activeSession = getActiveSession();

    if (activeSession) {
        return <SessionView session={activeSession} />;
    }

    return <SessionsHome />;
}

function SessionsHome() {
    const { sessions, setActiveSession, deleteSession } = useSessionStore();

    const [hoveredSession, setHoveredSession] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const handleCreateSession = () => {
        window.dispatchEvent(new CustomEvent("open-create-session-modal"));
    };

    const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (confirmDelete === sessionId) {
            deleteSession(sessionId);
            setConfirmDelete(null);
        } else {
            setConfirmDelete(sessionId);
            setTimeout(() => setConfirmDelete(null), 3000);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            {/* Sessions list at the top */}
            {sessions.length > 0 && (
                <div className="px-6 pt-6">
                    <div className="max-w-md mx-auto">
                        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-2 px-1">
                            Your Sessions
                        </p>
                        <div className="space-y-1">
                            {sessions.map((session) => {
                                const chatCount = session.conversations.length;
                                const docCount = session.documents.filter(
                                    (d) => d.status === "success"
                                ).length;

                                return (
                                    <div
                                        key={session.id}
                                        onClick={() => setActiveSession(session.id)}
                                        onMouseEnter={() => setHoveredSession(session.id)}
                                        onMouseLeave={() => setHoveredSession(null)}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg
                      hover:bg-neutral-50 cursor-pointer transition-colors
                      border border-transparent hover:border-neutral-200 group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                                            <MessageSquare className="w-4 h-4 text-neutral-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-neutral-900 truncate">
                                                {session.name}
                                            </p>
                                            <p className="text-[11px] text-neutral-400">
                                                {docCount} doc{docCount !== 1 ? "s" : ""} · {chatCount} chat
                                                {chatCount !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                        {hoveredSession === session.id ? (
                                            <button
                                                onClick={(e) => handleDeleteSession(e, session.id)}
                                                title={
                                                    confirmDelete === session.id
                                                        ? "Click again to confirm"
                                                        : "Delete session"
                                                }
                                                className={`p-1.5 rounded-md transition-colors shrink-0 ${confirmDelete === session.id
                                                        ? "bg-red-100 text-red-500"
                                                        : "hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600"
                                                    }`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-neutral-300 shrink-0">
                                                {new Date(session.createdAt).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Create button centered in remaining space */}
            <div className="flex-1 flex items-center justify-center px-6">
                <button
                    onClick={handleCreateSession}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
            bg-neutral-900 text-white text-sm font-medium
            hover:bg-neutral-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Session
                </button>
            </div>
        </div>
    );
}