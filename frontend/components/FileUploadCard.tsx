"use client";

import { useState, useRef } from "react";
import {
    Upload,
    FileIcon,
    CheckCircle2,
    XCircle,
    Loader2,
    Trash2,
} from "lucide-react";
import { uploadAPI } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/workspace-store";
import type { SessionDocument } from "@/lib/types";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

interface Props {
    title: string;
    description: string;
    docType: "syllabus" | "notes" | "past_paper";
    icon: React.ReactNode;
    accentColor: string;
    workspaceId: string;
    sessionId: string;
    subject: string;
    existingDocuments: SessionDocument[];
}

export default function FileUploadCard({
    title,
    description,
    docType,
    icon,
    accentColor,
    workspaceId,
    sessionId,
    subject,
    existingDocuments,
}: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const [yearInput, setYearInput] = useState<string>("");
    const [showYearPrompt, setShowYearPrompt] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const { addDocument, updateDocument, removeDocument } = useWorkspaceStore();

    const cardDocs = existingDocuments.filter((d) => d.type === docType);

    const uploadOne = async (file: File, year?: number) => {
        const docId = uuidv4();

        const newDoc: SessionDocument = {
            id: docId,
            name: file.name,
            type: docType,
            uploadedAt: new Date().toISOString(),
            status: "uploading",
            year,
        };

        addDocument(workspaceId, sessionId, newDoc);

        try {
            const res = await uploadAPI.uploadFile(file, docType, subject, sessionId, workspaceId, year);
            updateDocument(workspaceId, sessionId, docId, {
                status: "success",
                uploadId: res.data.upload_id,
            });
            toast.success(`${file.name} uploaded`);
        } catch (err: any) {
            updateDocument(workspaceId, sessionId, docId, {
                status: "error",
                errorMessage: err?.response?.data?.detail || "Upload failed",
            });
            toast.error(
                err?.response?.data?.detail || `Failed to upload ${file.name}`
            );
        }
    };

    const handleFiles = (list: FileList | null) => {
        if (!list) return;
        const files = Array.from(list);

        if (docType === "past_paper") {
            setPendingFiles(files);
            setShowYearPrompt(true);
        } else {
            files.forEach((f) => uploadOne(f));
        }
    };

    const handleYearSubmit = () => {
        const year = parseInt(yearInput, 10);
        if (isNaN(year) || year < 1900 || year > 2100) {
            toast.error("Please enter a valid year (e.g., 2023)");
            return;
        }
        pendingFiles.forEach((f) => uploadOne(f, year));
        setPendingFiles([]);
        setYearInput("");
        setShowYearPrompt(false);
    };

    const handleRemoveDoc = (docId: string) => {
        removeDocument(workspaceId, sessionId, docId);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${accentColor}`}>{icon}</div>
                <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>

            {showYearPrompt && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm font-medium text-amber-800 mb-2">
                        Enter the year for {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""}:
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={yearInput}
                            onChange={(e) => setYearInput(e.target.value)}
                            placeholder="e.g., 2023"
                            className="flex-1 px-3 py-2 rounded-lg border border-amber-300
                                       focus:ring-2 focus:ring-amber-500 focus:border-amber-500
                                       outline-none text-sm"
                            min={1900}
                            max={2100}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleYearSubmit();
                                if (e.key === "Escape") {
                                    setShowYearPrompt(false);
                                    setPendingFiles([]);
                                    setYearInput("");
                                }
                            }}
                            autoFocus
                        />
                        <button
                            onClick={handleYearSubmit}
                            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm
                                       font-medium hover:bg-amber-500 transition-colors"
                        >
                            Upload
                        </button>
                        <button
                            onClick={() => {
                                setShowYearPrompt(false);
                                setPendingFiles([]);
                                setYearInput("");
                            }}
                            className="px-3 py-2 rounded-lg border border-gray-300 text-sm
                                       text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                    ${isDragging
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
                    }`}
            >
                <Upload
                    className={`w-8 h-8 mx-auto mb-3 ${isDragging ? "text-indigo-500" : "text-gray-400"}`}
                />
                <p className="text-sm font-medium text-gray-700">
                    {isDragging ? "Drop files here" : "Drag & drop or click to browse"}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF files supported</p>

                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
            </div>

            {cardDocs.length > 0 && (
                <ul className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                    {cardDocs.map((doc) => (
                        <li
                            key={doc.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
                        >
                            <FileIcon className="w-4 h-4 text-gray-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-700 truncate block">
                                    {doc.name}
                                </span>
                                {doc.year && (
                                    <span className="text-xs text-gray-400">Year: {doc.year}</span>
                                )}
                            </div>

                            {doc.status === "uploading" && (
                                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                            )}
                            {doc.status === "success" && (
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            )}
                            {doc.status === "error" && (
                                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                            )}

                            {doc.status !== "uploading" && (
                                <button
                                    onClick={() => handleRemoveDoc(doc.id)}
                                    className="p-1 rounded opacity-0 group-hover:opacity-100
                                               hover:bg-gray-200 text-gray-400 hover:text-red-500
                                               transition-all shrink-0"
                                    title="Remove"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}