"use client";

import { useState } from "react";
import {
    Plus,
    MessageSquare,
    Trash2,
    X,
    LogOut,
    Sparkles,
    Send,
    Upload,
    Rocket,
    ArrowLeft,
    CircleHelp,
} from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

interface SidebarProps {
    onCreateSession: () => void;
}

export default function Sidebar({ onCreateSession }: SidebarProps) {
    const {
        sessions,
        activeSessionId,
        activeView,
        activeConversationId,
        sidebarOpen,
        setSidebarOpen,
        setActiveSession,
        setActiveView,
        setActiveConversation,
        deleteConversation,
    } = useSessionStore();
    const { user, logout } = useAuth();
    const router = useRouter();

    const [hoveredChat, setHoveredChat] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const activeSession = sessions.find((s) => s.id === activeSessionId);

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    const handleChatClick = (convId: string) => {
        setActiveConversation(convId);
        setActiveView("chat");
    };

    const handleDeleteChat = (e: React.MouseEvent, convId: string) => {
        e.stopPropagation();
        if (!activeSession) return;
        if (confirmDelete === convId) {
            deleteConversation(activeSession.id, convId);
            setConfirmDelete(null);
        } else {
            setConfirmDelete(convId);
            setTimeout(() => setConfirmDelete(null), 3000);
        }
    };

    const navItems = [
        { id: "quickstart" as const, label: "Quick Start", icon: Rocket },
        { id: "documents" as const, label: "Documents", icon: Upload },
        { id: "guide" as const, label: "Study Guide", icon: Sparkles },
        { id: "quiz" as const, label: "Quiz", icon: CircleHelp },
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
          fixed top-0 left-0 z-50 h-full bg-[#ebebeb]
          text-neutral-600 flex flex-col transition-all duration-300 ease-in-out
          lg:relative lg:z-auto lg:bg-neutral-200/25
          ${sidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full lg:translate-x-0 lg:w-0"}
        `}
            >
                <div
                    className={`flex flex-col h-full overflow-hidden ${sidebarOpen ? "opacity-100" : "opacity-0"
                        } transition-opacity`}
                >
                    {/* Logo */}
                    <div className="flex items-center justify-between px-4 py-4 shrink-0">
                        <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => setActiveSession(null)}
                        >
                            <span className="text-base font-semibold text-neutral-900 tracking-tight">
                                ExamGuide
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 rounded-lg hover:bg-neutral-200 transition-colors lg:hidden"
                        >
                            <X className="w-4 h-4 text-neutral-500" />
                        </button>
                    </div>

                    {activeSession ? (
                        <>
                            {/* Back to dashboard + New Session */}
                            <div className="px-3 pb-2 shrink-0">
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setActiveSession(null)}
                                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md
                      text-xs text-neutral-400 hover:text-neutral-700
                      hover:bg-neutral-200 transition-colors flex-1 min-w-0"
                                    >
                                        <ArrowLeft className="w-3 h-3 shrink-0" />
                                        <span className="truncate">Dashboard</span>
                                    </button>
                                    <button
                                        onClick={onCreateSession}
                                        className="p-1.5 rounded-md hover:bg-neutral-200
                      text-neutral-900 hover:text-neutral-700 transition-colors shrink-0"
                                        title="New Session"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Session header */}
                            <div className="px-4 pb-3 border-b border-neutral-200/50 shrink-0">
                                <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                                    Session
                                </p>
                                <p className="text-sm font-medium text-neutral-900 truncate">
                                    {activeSession.name}
                                </p>
                            </div>

                            {/* Navigation */}
                            <nav className="px-2 py-2 space-y-0.5 border-b border-neutral-200/50 shrink-0">
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
                                                    : "text-neutral-900 hover:bg-neutral-200 hover:text-neutral-900"
                                                }
                      `}
                                        >
                                            <item.icon className="w-3.5 h-3.5" />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </nav>

                            {/* Chat conversations list */}
                            <div className="flex-1 overflow-y-auto min-h-0">
                                <div className="px-3 pt-3 pb-1 flex items-center justify-between">
                                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium px-1">
                                        Chats
                                    </p>
                                    <button
                                        onClick={() => {
                                            setActiveConversation(null);
                                            setActiveView("chat");
                                        }}
                                        className="p-1 rounded-md hover:bg-neutral-200 text-neutral-900
                      hover:text-neutral-700 transition-colors"
                                        title="New Chat"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="px-2 pb-3 space-y-0.5">
                                    {activeSession.conversations.length === 0 ? (
                                        <div className="text-center py-6 px-4">
                                            <MessageSquare className="w-5 h-5 mx-auto text-neutral-300 mb-1.5" />
                                            <p className="text-[11px] text-neutral-400">
                                                No chats yet
                                            </p>
                                        </div>
                                    ) : (
                                        activeSession.conversations.map((conv) => {
                                            const isActive =
                                                activeView === "chat" &&
                                                activeConversationId === conv.id;
                                            const msgCount = conv.messages.length;

                                            return (
                                                <div
                                                    key={conv.id}
                                                    onMouseEnter={() => setHoveredChat(conv.id)}
                                                    onMouseLeave={() => setHoveredChat(null)}
                                                    onClick={() => handleChatClick(conv.id)}
                                                    className={`
                            group flex items-center gap-2 px-2.5 py-2 rounded-lg
                            transition-colors text-sm cursor-pointer
                            ${isActive
                                                            ? "bg-neutral-200/80 text-neutral-900"
                                                            : "hover:bg-neutral-200 text-neutral-900"
                                                        }
                          `}
                                                >
                                                    <Send className="w-3 h-3 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="block truncate text-xs">
                                                            {conv.title}
                                                        </span>
                                                    </div>
                                                    {hoveredChat === conv.id ? (
                                                        <button
                                                            onClick={(e) => handleDeleteChat(e, conv.id)}
                                                            title={
                                                                confirmDelete === conv.id
                                                                    ? "Click again to confirm"
                                                                    : "Delete"
                                                            }
                                                            className={`p-1 rounded transition-colors shrink-0 ${confirmDelete === conv.id
                                                                    ? "bg-red-100 text-red-500"
                                                                    : "hover:bg-neutral-200 text-neutral-400"
                                                                }`}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    ) : (
                                                        msgCount > 0 && (
                                                            <span className="text-[10px] text-neutral-400 shrink-0">
                                                                {msgCount}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* No active session — dashboard sidebar */
                        <div className="flex-1 flex flex-col px-3">
                            <div className="py-3 shrink-0">
                                <button
                                    onClick={onCreateSession}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                    border border-neutral-300 hover:border-neutral-400
                    text-neutral-900 text-sm font-medium
                    hover:bg-neutral-200 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    New Session
                                </button>
                            </div>

                            {sessions.length > 0 && (
                                <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium px-2 mb-1">
                                        Sessions
                                    </p>
                                    {sessions.map((session) => {
                                        const chatCount = session.conversations.length;
                                        return (
                                            <div
                                                key={session.id}
                                                onClick={() => setActiveSession(session.id)}
                                                className="flex items-center gap-2 px-2.5 py-2 rounded-lg
                          hover:bg-neutral-200 text-neutral-900
                          transition-colors cursor-pointer"
                                            >
                                                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <span className="block truncate text-sm">
                                                        {session.name}
                                                    </span>
                                                </div>
                                                {chatCount > 0 && (
                                                    <span className="text-[10px] text-neutral-400 shrink-0">
                                                        {chatCount}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {sessions.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center px-3">
                                    <MessageSquare className="w-8 h-8 text-neutral-200 mb-3" />
                                    <p className="text-xs text-neutral-400 text-center">
                                        Create a session to get started
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* User Footer */}
                    <div className="border-t border-neutral-200 px-3 py-3 shrink-0">
                        <div className="flex items-center gap-3 px-2">
                            {user?.picture && (
                                <img
                                    src={user.picture}
                                    alt={user.name || ""}
                                    className="w-7 h-7 rounded-full shrink-0"
                                    referrerPolicy="no-referrer"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-neutral-900 truncate">
                                    {user?.name}
                                </p>
                                <p className="text-[10px] text-neutral-400 truncate">
                                    {user?.email}
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                title="Sign out"
                                className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-900 hover:text-neutral-600 transition-colors"
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