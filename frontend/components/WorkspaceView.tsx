"use client";

import { useState } from "react";
import {
    Plus,
    MessageSquare,
    Calendar,
    BookOpen,
    Trash2,
    MoreHorizontal,
    FileText,
    Edit3,
    Check,
    X,
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/workspace-store";
import type { Workspace } from "@/lib/types";

interface Props {
    workspace: Workspace;
    onCreateSession: () => void;
}

export default function WorkspaceView({ workspace, onCreateSession }: Props) {
    const { setActiveSession, deleteSession, updateWorkspace } = useWorkspaceStore();
    const [editingName, setEditingName] = useState(false);
    const [editingDesc, setEditingDesc] = useState(false);
    const [nameValue, setNameValue] = useState(workspace.name);
    const [descValue, setDescValue] = useState(workspace.description);

    const handleSaveName = () => {
        if (nameValue.trim()) {
            updateWorkspace(workspace.id, { name: nameValue.trim() });
        } else {
            setNameValue(workspace.name);
        }
        setEditingName(false);
    };

    const handleSaveDesc = () => {
        updateWorkspace(workspace.id, { description: descValue.trim() });
        setEditingDesc(false);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="mb-8">
                <div className="flex items-start gap-4 mb-3">
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shrink-0"
                        style={{ backgroundColor: workspace.color }}
                    >
                        {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        {editingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    value={nameValue}
                                    onChange={(e) => setNameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveName();
                                        if (e.key === "Escape") {
                                            setNameValue(workspace.name);
                                            setEditingName(false);
                                        }
                                    }}
                                    className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-indigo-500 outline-none flex-1"
                                    maxLength={50}
                                />
                                <button onClick={handleSaveName} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Check className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => {
                                        setNameValue(workspace.name);
                                        setEditingName(false);
                                    }}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <h1
                                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-2"
                                onClick={() => setEditingName(true)}
                            >
                                {workspace.name}
                                <Edit3 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </h1>
                        )}

                        {editingDesc ? (
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    autoFocus
                                    value={descValue}
                                    onChange={(e) => setDescValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveDesc();
                                        if (e.key === "Escape") {
                                            setDescValue(workspace.description);
                                            setEditingDesc(false);
                                        }
                                    }}
                                    placeholder="Add a description..."
                                    className="text-sm text-gray-500 bg-transparent border-b border-gray-300 outline-none flex-1"
                                    maxLength={200}
                                />
                                <button onClick={handleSaveDesc} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Check className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <p
                                className="text-sm text-gray-500 mt-1 cursor-pointer hover:text-gray-700 transition-colors"
                                onClick={() => {
                                    setDescValue(workspace.description);
                                    setEditingDesc(true);
                                }}
                            >
                                {workspace.description || "Click to add description..."}
                            </p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Created {formatDate(workspace.createdAt)}
                            </span>
                            <span>{workspace.sessions.length} session{workspace.sessions.length !== 1 ? "s" : ""}</span>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={onCreateSession}
                className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3
                           border-2 border-dashed border-gray-300 rounded-xl
                           text-sm font-medium text-gray-500 hover:text-indigo-600
                           hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
            >
                <Plus className="w-4 h-4" />
                Create New Session
            </button>

            {workspace.sessions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workspace.sessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => setActiveSession(session.id)}
                            className="group relative bg-white border border-gray-200 rounded-xl p-5
                                       hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-indigo-100 rounded-lg">
                                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm">
                                            {session.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <BookOpen className="w-3 h-3" />
                                            {session.subject}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteSession(workspace.id, session.id);
                                    }}
                                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100
                                               hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                                    title="Delete session"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    {session.documents.length} document{session.documents.length !== 1 ? "s" : ""}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    {session.messages.length} message{session.messages.length !== 1 ? "s" : ""}
                                </span>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                                Updated {formatDate(session.updatedAt)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
                    <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">No sessions yet</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                        Create a session to start uploading documents and generating study guides for a subject.
                    </p>
                </div>
            )}
        </div>
    );
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}