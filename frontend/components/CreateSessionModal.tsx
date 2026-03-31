"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Sparkles } from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import toast from "react-hot-toast";

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
        try {
            createSession(name.trim(), description.trim());
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Failed to create session");
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl shadow-blue-100/50 w-full max-w-md overflow-hidden border border-blue-100">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-blue-50 bg-blue-50/30">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                            <Plus className="w-3.5 h-3.5 text-white" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-900">New Session</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Session Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Data Structures Final Prep"
                            className="w-full px-3 py-2 rounded-lg border border-blue-200
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         outline-none transition-all text-sm text-slate-900
                         placeholder:text-slate-300 bg-white"
                            maxLength={60}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Description{" "}
                            <span className="text-slate-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of what this session is for..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-blue-200
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         outline-none transition-all text-sm resize-none text-slate-900
                         placeholder:text-slate-300 bg-white"
                            maxLength={200}
                        />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 rounded-lg border border-blue-200
                         text-sm font-medium text-slate-600 hover:bg-blue-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white
                         text-sm font-medium hover:bg-blue-700 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed
                         shadow-sm shadow-blue-200 flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Create Session
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}