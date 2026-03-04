"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useSessionStore } from "@/lib/session-store";
import SessionView from "@/components/SessionView";
import {
    Plus,
    MessageSquare,
    Trash2,
    FileText,
    Send,
    Sparkles,
    CircleHelp,
    BookOpen,
} from "lucide-react";

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

    return <DashboardHome />;
}

function DashboardHome() {
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

    const features = [
        {
            icon: <FileText className="w-4 h-4" />,
            title: "Document Processing",
            desc: "Upload syllabus, notes, and past papers with content extraction.",
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100",
        },
        {
            icon: <Send className="w-4 h-4" />,
            title: "Ask Questions About Your Documents",
            desc: "Ask questions and get answers grounded in your uploaded documents with citations.",
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100",
        },
        {
            icon: <Sparkles className="w-4 h-4" />,
            title: "Study Guide Generation",
            desc: "Analyze syllabus and past papers to identify important chapters and exam patterns.",
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100",
        },
        {
            icon: <CircleHelp className="w-4 h-4" />,
            title: "Take Quiz Tests",
            desc: "Generate MCQ quizzes based on your course materials to test your knowledge.",
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100",
        },
    ];

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-[#F8FAFF]">
            <div className="max-w-5xl mx-auto w-full px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                            Dashboard
                        </h1>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Manage your study sessions
                        </p>
                    </div>
                    {sessions.length > 0 && (
                        <button
                            onClick={handleCreateSession}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                bg-blue-600 text-white text-sm font-medium
                hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                        >
                            <Plus className="w-4 h-4" />
                            Create Session
                        </button>
                    )}
                </div>

                {sessions.length > 0 ? (
                    /* Sessions grid */
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-3">
                            Your Sessions
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sessions.map((session) => {
                                const docCount = session.documents.filter(
                                    (d) => d.status === "success"
                                ).length;
                                const chatCount = session.conversations.length;

                                return (
                                    <div
                                        key={session.id}
                                        onClick={() => setActiveSession(session.id)}
                                        onMouseEnter={() => setHoveredSession(session.id)}
                                        onMouseLeave={() => setHoveredSession(null)}
                                        className="relative border border-blue-100 rounded-xl px-4 py-4
                      bg-white hover:border-blue-300 hover:shadow-sm hover:shadow-blue-100
                      cursor-pointer transition-all group"
                                    >
                                        {/* Blue left accent bar */}
                                        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-sm font-semibold text-slate-900 truncate">
                                                    {session.name}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <FileText className="w-3 h-3 text-blue-400" />
                                                        {docCount} doc{docCount !== 1 ? "s" : ""}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MessageSquare className="w-3 h-3 text-amber-400" />
                                                        {chatCount} chat{chatCount !== 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="shrink-0 ml-3">
                                                {hoveredSession === session.id ? (
                                                    <button
                                                        onClick={(e) => handleDeleteSession(e, session.id)}
                                                        title={
                                                            confirmDelete === session.id
                                                                ? "Click again to confirm"
                                                                : "Delete session"
                                                        }
                                                        className={`p-1.5 rounded-md transition-colors ${confirmDelete === session.id
                                                            ? "bg-red-100 text-red-500"
                                                            : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                                            }`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] text-slate-300">
                                                        {new Date(session.createdAt).toLocaleDateString(
                                                            "en-US",
                                                            { month: "short", day: "numeric" }
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Empty state with info */
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
                            <BookOpen className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mb-2">
                            Welcome to ExamGuide
                        </h2>
                        <p className="text-sm text-slate-500 text-center max-w-md mb-8">
                            A system that helps you prepare for your exam. Upload your course
                            materials and get study assistance.
                        </p>

                        <button
                            onClick={handleCreateSession}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                bg-blue-600 text-white text-sm font-medium
                hover:bg-blue-700 transition-colors mb-10 shadow-md shadow-blue-200"
                        >
                            <Plus className="w-4 h-4" />
                            Create Your First Session
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                            {features.map((f, i) => (
                                <div
                                    key={i}
                                    className={`flex items-start gap-3.5 px-4 py-4 rounded-xl
                    bg-white border ${f.border} hover:shadow-sm transition-shadow`}
                                >
                                    <div className={`shrink-0 w-9 h-9 rounded-lg ${f.bg} border ${f.border}
                    flex items-center justify-center ${f.color}`}>
                                        {f.icon}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800 mb-0.5">
                                            {f.title}
                                        </p>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            {f.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}