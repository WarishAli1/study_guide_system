"use client";

import { useState, useEffect, useRef } from "react";
import { X, MessageSquarePlus } from "lucide-react";
import { useWorkspaceStore } from "@/lib/workspace-store";

interface Props {
    open: boolean;
    workspaceId: string | null;
    onClose: () => void;
}

export default function CreateSessionModal({ open, workspaceId, onClose }: Props) {
    const { createSession, workspaces } = useWorkspaceStore();
    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const workspace = workspaces.find((ws) => ws.id === workspaceId);

    useEffect(() => {
        if (open) {
            setName("");
            setSubject("");
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !subject.trim() || !workspaceId) return;
        createSession(workspaceId, name.trim(), subject.trim());
        onClose();
    };

    if (!open || !workspaceId) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <MessageSquarePlus className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">New Session</h2>
                            {workspace && (
                                <p className="text-xs text-gray-500">
                                    in <span className="font-medium">{workspace.name}</span>
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Session Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Data Structures Exam Prep"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300
                                       focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                                       outline-none transition-all text-sm"
                            maxLength={60}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Subject <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g., Data Structures & Algorithms"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300
                                       focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                                       outline-none transition-all text-sm"
                            maxLength={80}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300
                                       text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim() || !subject.trim()}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white
                                       text-sm font-medium hover:bg-indigo-500 transition-colors
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Session
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}