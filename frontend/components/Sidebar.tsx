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
    LayoutDashboard,
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
        { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
        { id: "documents" as const, label: "Documents", icon: Upload },
        { id: "guide" as const, label: "Study Guide", icon: Sparkles },
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
                <div
                    className={`flex flex-col h-full overflow-hidden ${sidebarOpen ? "opacity-100" : "opacity-0"
                        } transition-opacity`}
                >
                    {/* Logo */}
                    <div className="flex items-center justify-between px-4 py-4">
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
                            {/* Session header */}
                            <div className="px-4 pb-3 border-b border-neutral-200/50">
                                <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1">
                                    Session
                                </p>
                                <p className="text-sm font-medium text-neutral-900 truncate">
                                    {activeSession.name}
                                </p>
                            </div>

                            {/* Navigation */}
                            <nav className="px-2 py-2 space-y-0.5 border-b border-neutral-200/50">
                                {navItems.map((item) => {
                                    const isActive = activeView === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setActiveView(item.id);
                                                if (item.id !== "chat") {
                                                    // Don't clear conversation when navigating away
                                                }
                                            }}
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
                                        className="p-1 rounded-md hover:bg-neutral-200 text-neutral-400
                                            hover:text-neutral-600 transition-colors"
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
                                                    onMouseEnter={() =>
                                                        setHoveredChat(conv.id)
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredChat(null)
                                                    }
                                                    onClick={() =>
                                                        handleChatClick(conv.id)
                                                    }
                                                    className={`
                                                        group flex items-center gap-2 px-2.5 py-2 rounded-lg
                                                        transition-colors text-sm cursor-pointer
                                                        ${isActive
                                                            ? "bg-neutral-200/80 text-neutral-900"
                                                            : "hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700"
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
                                                            onClick={(e) =>
                                                                handleDeleteChat(
                                                                    e,
                                                                    conv.id
                                                                )
                                                            }
                                                            title={
                                                                confirmDelete ===
                                                                    conv.id
                                                                    ? "Click again to confirm"
                                                                    : "Delete"
                                                            }
                                                            className={`p-1 rounded transition-colors shrink-0 ${confirmDelete ===
                                                                    conv.id
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
                        /* No active session */
                        <div className="flex-1 flex flex-col items-center justify-center px-6">
                            <MessageSquare className="w-8 h-8 text-neutral-200 mb-3" />
                            <p className="text-xs text-neutral-400 text-center mb-4">
                                Create a session to get started
                            </p>
                            <button
                                onClick={onCreateSession}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg
                                    bg-neutral-900 text-white text-sm font-medium
                                    hover:bg-neutral-800 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                New Session
                            </button>
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
                                <p className="text-xs font-medium text-neutral-700 truncate">
                                    {user?.name}
                                </p>
                                <p className="text-[10px] text-neutral-400 truncate">
                                    {user?.email}
                                </p>
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