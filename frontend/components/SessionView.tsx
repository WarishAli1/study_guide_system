"use client";

import { useState } from "react";
import {
    ArrowLeft,
    BookOpen,
    Upload,
    FileText,
    ClipboardList,
    BookText,
    Send,
    Sparkles,
    Edit3,
    Check,
    X,
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/workspace-store";
import FileUploadCard from "./FileUploadCard";
import type { Session, Workspace } from "@/lib/types";

interface Props {
    workspace: Workspace;
    session: Session;
}

export default function SessionView({ workspace, session }: Props) {
    const { setActiveSession, updateSession } = useWorkspaceStore();
    const [activeTab, setActiveTab] = useState<"documents" | "chat" | "guide">("documents");
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(session.name);

    const handleSaveName = () => {
        if (nameValue.trim()) {
            updateSession(workspace.id, session.id, { name: nameValue.trim() });
        } else {
            setNameValue(session.name);
        }
        setEditingName(false);
    };

    const tabs = [
        { id: "documents" as const, label: "Documents", icon: Upload },
        { id: "chat" as const, label: "Chat", icon: Send },
        { id: "guide" as const, label: "Study Guide", icon: Sparkles },
    ];

    const syllabusCount = session.documents.filter(d => d.type === "syllabus").length;
    const notesCount = session.documents.filter(d => d.type === "notes").length;
    const pastPaperCount = session.documents.filter(d => d.type === "past_paper").length;
    const totalDocs = session.documents.filter(d => d.status === "success").length;

    return (
        <div className="flex flex-col h-full">
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center gap-3 mb-3">
                        <button
                            onClick={() => setActiveSession(null)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                            title="Back to workspace"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: workspace.color }}
                        />
                        <span className="text-sm text-gray-500">{workspace.name}</span>
                        <span className="text-gray-300">/</span>

                        {editingName ? (
                            <div className="flex items-center gap-2 flex-1">
                                <input
                                    autoFocus
                                    value={nameValue}
                                    onChange={(e) => setNameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveName();
                                        if (e.key === "Escape") {
                                            setNameValue(session.name);
                                            setEditingName(false);
                                        }
                                    }}
                                    className="text-lg font-semibold text-gray-900 bg-transparent border-b-2 border-indigo-500 outline-none"
                                    maxLength={60}
                                />
                                <button onClick={handleSaveName} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Check className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => { setNameValue(session.name); setEditingName(false); }}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <h1
                                className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1.5"
                                onClick={() => setEditingName(true)}
                            >
                                {session.name}
                                <Edit3 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </h1>
                        )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                        <span className="flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4" />
                            {session.subject}
                        </span>
                        {totalDocs > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                {totalDocs} document{totalDocs !== 1 ? "s" : ""} uploaded
                            </span>
                        )}
                    </div>

                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                    ${activeTab === tab.id
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                    }
                                `}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === "documents" && (
                    <DocumentsTab
                        workspaceId={workspace.id}
                        sessionId={session.id}
                        subject={session.subject}
                        documents={session.documents}
                    />
                )}
                {activeTab === "chat" && <ChatTab />}
                {activeTab === "guide" && <GuideTab totalDocs={totalDocs} />}
            </div>
        </div>
    );
}

interface DocumentsTabProps {
    workspaceId: string;
    sessionId: string;
    subject: string;
    documents: import("@/lib/types").SessionDocument[];
}

function DocumentsTab({ workspaceId, sessionId, subject, documents }: DocumentsTabProps) {
    return (
        <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Upload Documents</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Upload your course materials for <strong>{subject}</strong> to generate a personalised study guide.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <FileUploadCard
                    title="Syllabus"
                    description="Course syllabus with units & topics"
                    docType="syllabus"
                    icon={<BookText className="w-5 h-5 text-blue-600" />}
                    accentColor="bg-blue-100"
                    workspaceId={workspaceId}
                    sessionId={sessionId}
                    subject={subject}
                    existingDocuments={documents}
                />
                <FileUploadCard
                    title="Course Notes"
                    description="Lecture notes & study materials"
                    docType="notes"
                    icon={<FileText className="w-5 h-5 text-emerald-600" />}
                    accentColor="bg-emerald-100"
                    workspaceId={workspaceId}
                    sessionId={sessionId}
                    subject={subject}
                    existingDocuments={documents}
                />
                <FileUploadCard
                    title="Past Questions"
                    description="Previous year exam papers"
                    docType="past_paper"
                    icon={<ClipboardList className="w-5 h-5 text-amber-600" />}
                    accentColor="bg-amber-100"
                    workspaceId={workspaceId}
                    sessionId={sessionId}
                    subject={subject}
                    existingDocuments={documents}
                />
            </div>

            <div className="mt-8 bg-indigo-50 border border-indigo-100 rounded-xl p-6">
                <h3 className="font-semibold text-indigo-900 mb-4">How it works</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        "Upload your syllabus, notes and past question papers above.",
                        "Our AI extracts topics, clusters questions and maps coverage gaps.",
                        "Receive a ranked study guide telling you exactly what to focus on.",
                    ].map((text, i) => (
                        <div key={i} className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {i + 1}
                            </span>
                            <p className="text-sm text-indigo-800">{text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ChatTab() {
    const [message, setMessage] = useState("");

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto px-6">
            <div className="flex-1 flex items-center justify-center py-16">
                <div className="text-center">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Send className="w-7 h-7 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">Chat with your documents</h3>
                    <p className="text-sm text-gray-500 max-w-sm">
                        Upload documents first, then ask questions about your course materials.
                        RAG-powered answers coming soon!
                    </p>
                </div>
            </div>

            <div className="border-t border-gray-100 py-4">
                <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Ask a question about your documents..."
                            rows={1}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300
                                       focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
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
                        className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500
                                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                    Chat functionality will be connected to RAG pipeline
                </p>
            </div>
        </div>
    );
}

function GuideTab({ totalDocs }: { totalDocs: number }) {
    return (
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Study Guide Generator</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                Upload your syllabus, notes, and past papers, then generate a
                personalised study guide ranked by topic importance.
            </p>
            <button
                disabled={totalDocs === 0}
                className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium
                           hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                           inline-flex items-center gap-2"
            >
                <Sparkles className="w-4 h-4" />
                Generate Study Guide
            </button>
            <p className="text-xs text-gray-400 mt-3">
                {totalDocs === 0 ? "Upload documents first" : "Coming soon"}
            </p>
        </div>
    );
}