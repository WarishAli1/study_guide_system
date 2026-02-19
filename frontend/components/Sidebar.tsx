"use client";

import { useState } from "react";
import {
    BookOpen,
    Plus,
    MessageSquare,
    Trash2,
    X,
    LogOut,
    FileText,
    Upload,
    Send,
    Sparkles,
    LayoutDashboard,
} from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import type { Session } from "@/lib/types";

interface SidebarProps {
    onCreateSession: () => void;
}

export default function Sidebar({ onCreateSession }: SidebarProps) {
    const {
        sessions,
        activeSessionId,
        activeView,
        sidebarOpen,
        setSidebarOpen,
        setActiveSession,
        setActiveView,
        deleteSession,
    } = useSessionStore();

    const { user, logout } = useAuth();
    const router = useRouter();

    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const activeSession = sessions.find((s) => s.id === activeSessionId);

    const handleSessionClick = (session: Session) => {
        setActiveSession(session.id);
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

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    const navItems = [
        { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
        { id: "documents" as const, label: "Documents", icon: Upload },
        { id: "guide" as const, label: "Study Guide", icon: Sparkles },
        { id: "chat" as const, label: "Chat", icon: Send },
    ];

    return (
        <>
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                className={`
          fixed top-0 left-0 z-50 h-full bg-[#fafafa] border-r border-neutral-200
          text-neutral-600 flex flex-col transition-all duration-300 ease-in-out
          lg:relative lg:z-auto
          ${sidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full lg:translate-x-0 lg:w-0"}
        `}
            >
                <div className={`flex flex-col h-full overflow-hidden ${sidebarOpen ? "opacity-100" : "opacity-0"} transition-opacity`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-200">
                        <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => setActiveSession(null)}
                        >
                            <BookOpen className="w-5 h-5 text-neutral-800" />
                            <span className="text-base font-semibold text-neutral-900 tracking-tight">ExamGuide</span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 rounded-lg hover:bg-neutral-200 transition-colors lg:hidden"
                        >
                            <X className="w-4 h-4 text-neutral-500" />
                        </button>
                    </div>

                    {/* Session Nav — shown when a session is active */}
                    {activeSession && (
                        <div className="border-b border-neutral-200">
                            <div className="px-4 py-3">
                                <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1">Session</p>
                                <p className="text-sm font-medium text-neutral-900 truncate">{activeSession.name}</p>
                            </div>
                            <nav className="px-2 pb-2 space-y-0.5">
                                {navItems.map((item) => {
                                    const isActive = activeView === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveView(item.id)}
                                            className={`
                        w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md
                        text-sm transition-colors
                        ${isActive
                                                    ? "bg-neutral-200/80 text-neutral-900 font-medium"
                                                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                                                }
                      `}
                                        >
                                            <item.icon className="w-3.5 h-3.5" />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    )}

                    {/* New Session Button */}
                    <div className="px-3 py-3">
                        <button
                            onClick={onCreateSession}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                         border border-neutral-300 hover:border-neutral-400
                         text-neutral-600 text-sm font-medium
                         hover:bg-neutral-100 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Session
                        </button>
                    </div>

                    {/* Sessions List */}
                    <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium px-2 mb-1">
                            Sessions
                        </p>
                        {sessions.length === 0 ? (
                            <div className="text-center py-8 px-4">
                                <MessageSquare className="w-6 h-6 mx-auto text-neutral-300 mb-2" />
                                <p className="text-xs text-neutral-400">No sessions yet</p>
                            </div>
                        ) : (
                            sessions.map((session) => {
                                const isActive = activeSessionId === session.id;
                                const docCount = session.documents.filter((d) => d.status === "success").length;

                                return (
                                    <div
                                        key={session.id}
                                        onMouseEnter={() => setHoveredItem(session.id)}
                                        onMouseLeave={() => setHoveredItem(null)}
                                        onClick={() => handleSessionClick(session)}
                                        className={`
                      group flex items-center gap-2 px-2.5 py-2 rounded-lg
                      transition-colors text-sm cursor-pointer
                      ${isActive
                                                ? "bg-neutral-200/80 text-neutral-900"
                                                : "hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700"
                                            }
                    `}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="block truncate text-sm">{session.name}</span>
                                        </div>
                                        {docCount > 0 && hoveredItem !== session.id && (
                                            <span className="text-[10px] text-neutral-400 shrink-0">
                                                {docCount}
                                                <FileText className="w-2.5 h-2.5 inline ml-0.5" />
                                            </span>
                                        )}
                                        {hoveredItem === session.id && (
                                            <button
                                                onClick={(e) => handleDeleteSession(e, session.id)}
                                                title={confirmDelete === session.id ? "Click again to confirm" : "Delete"}
                                                className={`p-1 rounded transition-colors shrink-0 ${confirmDelete === session.id
                                                        ? "bg-red-100 text-red-500"
                                                        : "hover:bg-neutral-200 text-neutral-400"
                                                    }`}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* User Footer */}
                    <div className="border-t border-neutral-200 px-3 py-3">
                        <div className="flex items-center gap-3 px-2">
                            {user?.picture && (
                                <img
                                    src={user.picture}
                                    alt={user.name}
                                    className="w-7 h-7 rounded-full shrink-0"
                                    referrerPolicy="no-referrer"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-neutral-700 truncate">
                                    {user?.name}
                                </p>
                                <p className="text-[10px] text-neutral-400 truncate">{user?.email}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                title="Sign out"
                                className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 transition-colors"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}