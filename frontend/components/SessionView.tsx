"use client";

import { useState } from "react";
import {
    Upload,
    Send,
    FileText,
    CheckCircle2,
    Circle,
} from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import FileUploadCard from "./FileUploadCard";
import StudyGuideView from "./StudyGuideView";
import type { Session } from "@/lib/types";

interface Props {
    session: Session;
}

export default function SessionView({ session }: Props) {
    const { activeView } = useSessionStore();

    return (
        <div className="flex flex-col h-full">
            {activeView === "dashboard" && <SessionDashboard session={session} />}
            {activeView === "documents" && <DocumentsView session={session} />}
            {activeView === "chat" && <ChatView />}
            {activeView === "guide" && <StudyGuideView session={session} />}
        </div>
    );
}

function SessionDashboard({ session }: { session: Session }) {
    const { setActiveView } = useSessionStore();
    const totalDocs = session.documents.filter((d) => d.status === "success").length;
    const hasSyllabus = session.documents.some(
        (d) => d.type === "syllabus" && d.status === "success"
    );
    const hasGuide = session.cachedGuide !== null;

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
            description: "Generate a study guide from your materials",
            done: hasGuide,
            action: hasSyllabus || hasGuide ? () => setActiveView("guide") : undefined,
        },
        {
            id: "chat",
            label: "Chat With Your Documents",
            description: "Ask questions and get course based answers",
            done: false,
            action: () => setActiveView("chat"),
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto px-6 py-12">
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

                <div className="relative">
                    {steps.map((step, index) => {
                        const isLast = index === steps.length - 1;
                        const isClickable = !!step.action;

                        return (
                            <div key={step.id} className="flex gap-4">
                                <div className="flex flex-col items-center">
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
                                    {!isLast && (
                                        <div
                                            className={`w-px flex-1 min-h-[48px] ${step.done ? "bg-neutral-900" : "bg-neutral-200"
                                                }`}
                                        />
                                    )}
                                </div>

                                <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
                                    <div
                                        onClick={step.action}
                                        className={`pt-1 rounded-lg px-3 py-2 -mx-3 -mt-1 transition-colors ${isClickable
                                            ? "cursor-pointer hover:bg-neutral-50"
                                            : ""
                                            }`}
                                    >
                                        <h3
                                            className={`text-sm font-medium ${step.done
                                                ? "text-neutral-900"
                                                : isClickable
                                                    ? "text-neutral-700"
                                                    : "text-neutral-400"
                                                }`}
                                        >
                                            {step.label}
                                        </h3>
                                        <p
                                            className={`text-xs mt-0.5 ${isClickable ? "text-neutral-500" : "text-neutral-400"
                                                }`}
                                        >
                                            {step.description}
                                        </p>
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