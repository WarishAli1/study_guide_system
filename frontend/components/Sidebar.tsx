"use client";

import { useState } from "react";
import {
    BookOpen,
    Plus,
    ChevronDown,
    ChevronRight,
    MessageSquare,
    Trash2,
    Edit3,
    X,
    FolderOpen,
    LogOut,
    Settings,
} from "lucide-react";
import { useWorkspaceStore, WORKSPACE_COLORS } from "@/lib/workspace-store";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import type { Workspace } from "@/lib/types";

interface SidebarProps {
    onCreateWorkspace: () => void;
    onCreateSession: (workspaceId: string) => void;
}

export default function Sidebar({ onCreateWorkspace, onCreateSession }: SidebarProps) {
    const {
        workspaces,
        activeWorkspaceId,
        activeSessionId,
        sidebarOpen,
        setSidebarOpen,
        setActiveWorkspace,
        setActiveSession,
        deleteWorkspace,
        deleteSession,
    } = useWorkspaceStore();

    const { user, logout } = useAuth();
    const router = useRouter();

    const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(
        new Set(activeWorkspaceId ? [activeWorkspaceId] : [])
    );
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const toggleExpand = (wsId: string) => {
        setExpandedWorkspaces((prev) => {
            const next = new Set(prev);
            if (next.has(wsId)) next.delete(wsId);
            else next.add(wsId);
            return next;
        });
    };

    const handleWorkspaceClick = (ws: Workspace) => {
        setActiveWorkspace(ws.id);
        setActiveSession(null);
        if (!expandedWorkspaces.has(ws.id)) {
            setExpandedWorkspaces((prev) => new Set(prev).add(ws.id));
        }
    };

    const handleSessionClick = (wsId: string, sessionId: string) => {
        setActiveWorkspace(wsId);
        setActiveSession(sessionId);
    };

    const handleDeleteWorkspace = (wsId: string) => {
        if (confirmDelete === wsId) {
            deleteWorkspace(wsId);
            setConfirmDelete(null);
        } else {
            setConfirmDelete(wsId);
            setTimeout(() => setConfirmDelete(null), 3000);
        }
    };

    const handleDeleteSession = (e: React.MouseEvent, wsId: string, sessionId: string) => {
        e.stopPropagation();
        deleteSession(wsId, sessionId);
    };

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    return (
        <>
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                className={`
                    fixed top-0 left-0 z-50 h-full bg-gray-950 text-gray-300
                    flex flex-col transition-all duration-300 ease-in-out
                    lg:relative lg:z-auto
                    ${sidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full lg:translate-x-0 lg:w-0"}
                `}
            >
                <div className={`flex flex-col h-full overflow-hidden ${sidebarOpen ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}>
                    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
                        <div className="flex items-center gap-2.5">
                            <BookOpen className="w-6 h-6 text-indigo-400" />
                            <span className="text-lg font-bold text-white tracking-tight">ExamGuide</span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors lg:hidden"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="px-3 py-3">
                        <button
                            onClick={onCreateWorkspace}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                                       bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium
                                       transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Workspace
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-thin">
                        {workspaces.length === 0 ? (
                            <div className="text-center py-10 px-4">
                                <FolderOpen className="w-10 h-10 mx-auto text-gray-700 mb-3" />
                                <p className="text-sm text-gray-500">No workspaces yet</p>
                                <p className="text-xs text-gray-600 mt-1">
                                    Create one to get started
                                </p>
                            </div>
                        ) : (
                            workspaces.map((ws) => {
                                const isExpanded = expandedWorkspaces.has(ws.id);
                                const isActive = activeWorkspaceId === ws.id && !activeSessionId;

                                return (
                                    <div key={ws.id}>
                                        <div
                                            onMouseEnter={() => setHoveredItem(ws.id)}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className={`
                                                group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer
                                                transition-colors text-sm
                                                ${isActive
                                                    ? "bg-gray-800 text-white"
                                                    : "hover:bg-gray-800/60 text-gray-400 hover:text-gray-200"
                                                }
                                            `}
                                            onClick={() => handleWorkspaceClick(ws)}
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleExpand(ws.id);
                                                }}
                                                className="p-0.5 shrink-0"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                ) : (
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                )}
                                            </button>

                                            <div
                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: ws.color }}
                                            />

                                            <span className="flex-1 truncate font-medium">
                                                {ws.name}
                                            </span>

                                            <span className="text-xs text-gray-600 shrink-0">
                                                {ws.sessions.length}
                                            </span>

                                            {(hoveredItem === ws.id) && (
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCreateSession(ws.id);
                                                        }}
                                                        title="New session"
                                                        className="p-1 rounded hover:bg-gray-700 transition-colors"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteWorkspace(ws.id);
                                                        }}
                                                        title={confirmDelete === ws.id ? "Click again to confirm" : "Delete workspace"}
                                                        className={`p-1 rounded transition-colors ${confirmDelete === ws.id
                                                            ? "bg-red-600/20 text-red-400"
                                                            : "hover:bg-gray-700"
                                                            }`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {isExpanded && ws.sessions.length > 0 && (
                                            <div className="ml-5 mt-0.5 space-y-0.5 border-l border-gray-800 pl-3">
                                                {ws.sessions.map((session) => {
                                                    const isSessionActive = activeSessionId === session.id;
                                                    return (
                                                        <div
                                                            key={session.id}
                                                            onMouseEnter={() => setHoveredItem(session.id)}
                                                            onMouseLeave={() => setHoveredItem(null)}
                                                            onClick={() => handleSessionClick(ws.id, session.id)}
                                                            className={`
                                                                group flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer
                                                                transition-colors text-sm
                                                                ${isSessionActive
                                                                    ? "bg-indigo-600/20 text-indigo-300"
                                                                    : "hover:bg-gray-800/40 text-gray-500 hover:text-gray-300"
                                                                }
                                                            `}
                                                        >
                                                            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                                            <span className="flex-1 truncate">{session.name}</span>

                                                            {hoveredItem === session.id && (
                                                                <button
                                                                    onClick={(e) => handleDeleteSession(e, ws.id, session.id)}
                                                                    className="p-1 rounded hover:bg-gray-700 transition-colors shrink-0"
                                                                    title="Delete session"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {isExpanded && ws.sessions.length === 0 && (
                                            <div className="ml-5 mt-1 border-l border-gray-800 pl-3">
                                                <button
                                                    onClick={() => onCreateSession(ws.id)}
                                                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-600
                                                               hover:text-gray-400 transition-colors rounded-md hover:bg-gray-800/40"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add a session
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="border-t border-gray-800 px-3 py-3">
                        <div className="flex items-center gap-3 px-2">
                            {user?.picture && (
                                <img
                                    src={user.picture}
                                    alt={user.name}
                                    className="w-8 h-8 rounded-full shrink-0"
                                    referrerPolicy="no-referrer"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-200 truncate">
                                    {user?.name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                title="Sign out"
                                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-red-400 transition-colors shrink-0"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}