"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/lib/workspace-store";
import WorkspaceView from "@/components/WorkspaceView";
import SessionView from "@/components/SessionView";
import CreateWorkspaceModal from "@/components/CreateWorkspaceModal";
import CreateSessionModal from "@/components/CreateSessionModal";
import {
    FolderOpen,
    Plus,
    BookOpen,
    Sparkles,
    MessageSquare,
    Upload,
} from "lucide-react";

export default function DashboardPage() {
    const {
        workspaces,
        activeWorkspaceId,
        activeSessionId,
        getActiveWorkspace,
        getActiveSession,
    } = useWorkspaceStore();

    const [wsModalOpen, setWsModalOpen] = useState(false);
    const [ssModalOpen, setSsModalOpen] = useState(false);

    const activeWorkspace = getActiveWorkspace();
    const activeSession = getActiveSession();

    if (activeWorkspace && activeSession) {
        return (
            <SessionView workspace={activeWorkspace} session={activeSession} />
        );
    }

    if (activeWorkspace) {
        return (
            <>
                <WorkspaceView
                    workspace={activeWorkspace}
                    onCreateSession={() => setSsModalOpen(true)}
                />
                <CreateSessionModal
                    open={ssModalOpen}
                    workspaceId={activeWorkspaceId}
                    onClose={() => setSsModalOpen(false)}
                />
            </>
        );
    }

    return (
        <>
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
                        <BookOpen className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Welcome to ExamGuide
                    </h1>
                    <p className="text-gray-500 max-w-md mx-auto">
                        Create a workspace for each course or semester, then add sessions
                        for individual subjects.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                    {[
                        {
                            icon: Upload,
                            title: "Upload Documents",
                            desc: "Syllabus, notes, and past papers",
                            color: "bg-blue-100 text-blue-600",
                        },
                        {
                            icon: Sparkles,
                            title: "Generate Guides",
                            desc: "AI-ranked study priorities",
                            color: "bg-amber-100 text-amber-600",
                        },
                        {
                            icon: MessageSquare,
                            title: "Chat with Docs",
                            desc: "RAG-powered Q&A",
                            color: "bg-emerald-100 text-emerald-600",
                        },
                    ].map((item, i) => (
                        <div
                            key={i}
                            className="bg-white border border-gray-200 rounded-xl p-5 text-center"
                        >
                            <div
                                className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-3`}
                            >
                                <item.icon className="w-6 h-6" />
                            </div>
                            <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                            <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                        </div>
                    ))}
                </div>

                {workspaces.length > 0 ? (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Your Workspaces</h2>
                            <button
                                onClick={() => setWsModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                           bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                New
                            </button>
                        </div>
                        <WorkspaceGrid />
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                        <FolderOpen className="w-14 h-14 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            No workspaces yet
                        </h3>
                        <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                            Create your first workspace to start organizing your study materials.
                        </p>
                        <button
                            onClick={() => setWsModalOpen(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                                       bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create Workspace
                        </button>
                    </div>
                )}
            </div>

            <CreateWorkspaceModal open={wsModalOpen} onClose={() => setWsModalOpen(false)} />
        </>
    );
}

function WorkspaceGrid() {
    const { workspaces, setActiveWorkspace } = useWorkspaceStore();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
                <div
                    key={ws.id}
                    onClick={() => setActiveWorkspace(ws.id)}
                    className="group bg-white border border-gray-200 rounded-xl p-5
                               hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: ws.color }}
                        >
                            {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">
                                {ws.name}
                            </h3>
                            <p className="text-xs text-gray-500 truncate">
                                {ws.description || "No description"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{ws.sessions.length} session{ws.sessions.length !== 1 ? "s" : ""}</span>
                        <span>•</span>
                        <span>
                            {new Date(ws.updatedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                            })}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}