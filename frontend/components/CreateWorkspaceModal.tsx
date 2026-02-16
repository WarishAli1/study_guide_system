"use client";

import { useState, useEffect, useRef } from "react";
import { X, FolderPlus } from "lucide-react";
import { useWorkspaceStore, WORKSPACE_COLORS } from "@/lib/workspace-store";

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function CreateWorkspaceModal({ open, onClose }: Props) {
    const { createWorkspace } = useWorkspaceStore();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState(WORKSPACE_COLORS[0]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setName("");
            setDescription("");
            setColor(WORKSPACE_COLORS[Math.floor(Math.random() * WORKSPACE_COLORS.length)]);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        createWorkspace(name.trim(), description.trim(), color);
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-xl">
                            <FolderPlus className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">New Workspace</h2>
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
                            Workspace Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Computer Science Semester 4"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300
                                       focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                                       outline-none transition-all text-sm"
                            maxLength={50}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this workspace..."
                            rows={2}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300
                                       focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                                       outline-none transition-all text-sm resize-none"
                            maxLength={200}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Color
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {WORKSPACE_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded-full transition-all ${color === c
                                        ? "ring-2 ring-offset-2 ring-gray-900 scale-110"
                                        : "hover:scale-110"
                                        }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
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
                            disabled={!name.trim()}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white
                                       text-sm font-medium hover:bg-indigo-500 transition-colors
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Workspace
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}