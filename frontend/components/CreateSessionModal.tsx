"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus } from "lucide-react";
import { useSessionStore } from "@/lib/session-store";

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function CreateSessionModal({ open, onClose }: Props) {
    const { createSession } = useSessionStore();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setName("");
            setDescription("");
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        createSession(name.trim(), description.trim());
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4 text-neutral-700" />
                        <h2 className="text-base font-semibold text-neutral-900">New Session</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                    >
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                            Session Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Data Structures Final Prep"
                            className="w-full px-3 py-2 rounded-lg border border-neutral-300
                         focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900
                         outline-none transition-all text-sm"
                            maxLength={60}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                            Description <span className="text-neutral-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of what this session is for..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-neutral-300
                         focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900
                         outline-none transition-all text-sm resize-none"
                            maxLength={200}
                        />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 rounded-lg border border-neutral-300
                         text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex-1 px-4 py-2 rounded-lg bg-neutral-900 text-white
                         text-sm font-medium hover:bg-neutral-800 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}