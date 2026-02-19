"use client";

import { useState } from "react";
import {
    Upload,
    Send,
    Sparkles,
    FileText,
    CheckCircle2,
    Circle,
    ArrowRight,
} from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import FileUploadCard from "./FileUploadCard";
import type { Session } from "@/lib/types";

interface Props {
    session: Session;
}

export default function SessionView({ session }: Props) {
    const { activeView, setActiveView } = useSessionStore();

    return (
        <div className="flex flex-col h-full">
            {activeView === "dashboard" && (
                <SessionDashboard session={session} />
            )}
            {activeView === "documents" && (
                <DocumentsView session={session} />
            )}
            {activeView === "chat" && <ChatView />}
            {activeView === "guide" && <GuideView session={session} />}
        </div>
    );
}

/* ─── Dashboard / Quick Start ──────────────────────────────────────── */

function SessionDashboard({ session }: { session: Session }) {
    const { setActiveView } = useSessionStore();
    const totalDocs = session.documents.filter((d) => d.status === "success").length;

    const steps = [
        {
            id: "create",
            label: "Create Session",
            description: "Set up your study session",
            done: true,
            action: undefined,
        },
        {
            id: "ingest",
            label: "Ingest Documents",
            description: "Upload syllabus, notes, and past papers",
            done: totalDocs > 0,
            action: () => setActiveView("documents"),
        },
        {
            id: "guide",
            label: "Get Study Insights",
            description: "Generate a ranked study guide from your materials",
            done: false,
            action: () => setActiveView("guide"),
        },
        {
            id: "chat",
            label: "Chat With Your Documents",
            description: "Ask questions and get RAG-powered answers",
            done: false,
            action: () => setActiveView("chat"),
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto px-6 py-12">
                {/* Session header */}
                <div className="mb-10">
                    <h1 className="text-xl font-semibold text-neutral-900 mb-1">
                        {session.name}
                    </h1>
                    {session.description && (
                        <p className="text-sm text-neutral-500">{session.description}</p>
                    )}
                    {totalDocs > 0 && (
                        <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {totalDocs} document{totalDocs !== 1 ? "s" : ""} uploaded
                        </p>
                    )}
                </div>

                {/* Timeline */}
                <div className="relative">
                    {steps.map((step, index) => {
                        const isLast = index === steps.length - 1;

                        return (
                            <div key={step.id} className="flex gap-4 group">
                                {/* Timeline column */}
                                <div className="flex flex-col items-center">
                                    {/* Circle / Check */}
                                    <div className="relative z-10">
                                        {step.done ? (
                                            <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full border-2 border-neutral-300 bg-white flex items-center justify-center">
                                                <Circle className="w-3 h-3 text-neutral-300" />
                                            </div>
                                        )}
                                    </div>
                                    {/* Connector line */}
                                    {!isLast && (
                                        <div className={`w-px flex-1 min-h-[48px] ${step.done ? "bg-neutral-900" : "bg-neutral-200"
                                            }`} />
                                    )}
                                </div>

                                {/* Content */}
                                <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
                                    <div className={`pt-1 ${step.action ? "cursor-pointer group" : ""}`}>
                                        <h3
                                            className={`text-sm font-medium ${step.done ? "text-neutral-900" : "text-neutral-600"
                                                }`}
                                        >
                                            {step.label}
                                        </h3>
                                        <p className="text-xs text-neutral-400 mt-0.5">
                                            {step.description}
                                        </p>
                                        {step.action && !step.done && (
                                            <button
                                                onClick={step.action}
                                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium
                                   text-neutral-500 hover:text-neutral-900 transition-colors"
                                            >
                                                Get started
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                        )}
                                        {step.action && step.done && (
                                            <button
                                                onClick={step.action}
                                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium
                                   text-neutral-400 hover:text-neutral-700 transition-colors"
                                            >
                                                View
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ─── Documents ────────────────────────────────────────────────────── */

function DocumentsView({ session }: { session: Session }) {
    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-6">
                <div className="mb-5">
                    <h2 className="text-base font-semibold text-neutral-900">Documents</h2>
                    <p className="text-sm text-neutral-500 mt-0.5">
                        Upload and manage your study materials
                    </p>
                </div>
                <FileUploadCard
                    sessionId={session.id}
                    existingDocuments={session.documents}
                />
            </div>
        </div>
    );
}

/* ─── Chat ─────────────────────────────────────────────────────────── */

function ChatView() {
    const [message, setMessage] = useState("");

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto px-6">
            <div className="flex-1 flex items-center justify-center py-16">
                <div className="text-center">
                    <Send className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-neutral-700 mb-1">
                        Chat with your documents
                    </h3>
                    <p className="text-sm text-neutral-400 max-w-sm">
                        Upload documents first, then ask questions. RAG-powered answers coming soon.
                    </p>
                </div>
            </div>

            <div className="border-t border-neutral-100 py-4">
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Ask a question about your documents..."
                            rows={1}
                            className="w-full px-3 py-2.5 rounded-lg border border-neutral-300
                         focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900
                         outline-none transition-all text-sm resize-none"
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = "auto";
                                target.style.height = Math.min(target.scrollHeight, 120) + "px";
                            }}
                        />
                    </div>
                    <button
                        disabled={!message.trim()}
                        className="p-2.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Study Guide ──────────────────────────────────────────────────── */

function GuideView({ session }: { session: Session }) {
    const totalDocs = session.documents.filter((d) => d.status === "success").length;

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-16 text-center">
                <Sparkles className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                <h3 className="text-base font-medium text-neutral-700 mb-1">
                    Study Guide Generator
                </h3>
                <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-6">
                    Upload your syllabus, notes, and past papers, then generate a
                    personalised study guide ranked by topic importance.
                </p>
                <button
                    disabled={totalDocs === 0}
                    className="px-5 py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium
                     hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                     inline-flex items-center gap-2"
                >
                    <Sparkles className="w-4 h-4" />
                    Generate Study Guide
                </button>
                <p className="text-xs text-neutral-400 mt-3">
                    {totalDocs === 0 ? "Upload documents first" : "Coming soon"}
                </p>
            </div>
        </div>
    );
}