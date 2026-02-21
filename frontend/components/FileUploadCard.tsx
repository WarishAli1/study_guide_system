"use client";

import { useState, useRef } from "react";
import {
    Upload,
    FileIcon,
    CheckCircle2,
    XCircle,
    Loader2,
    Trash2,
    BookOpen,
    FileText,
    ClipboardList,
} from "lucide-react";
import { uploadAPI } from "@/lib/api";
import { useSessionStore } from "@/lib/session-store";
import type { SessionDocument } from "@/lib/types";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

interface Props {
    sessionId: string;
    existingDocuments: SessionDocument[];
}

const DOC_TYPES = [
    { value: "syllabus", label: "Syllabus", icon: BookOpen },
    { value: "notes", label: "Notes", icon: FileText },
    { value: "past_paper", label: "Past Paper", icon: ClipboardList },
] as const;

export default function FileUploadCard({
    sessionId,
    existingDocuments,
}: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState<string>("syllabus");
    const inputRef = useRef<HTMLInputElement>(null);

    const { addDocument, updateDocument, removeDocument } = useSessionStore();

    const uploadOne = async (file: File, docType: string) => {
        const docId = uuidv4();
        const newDoc: SessionDocument = {
            id: docId,
            name: file.name,
            type: docType as SessionDocument["type"],
            uploadedAt: new Date().toISOString(),
            status: "uploading",
        };

        addDocument(sessionId, newDoc);

        try {
            const res = await uploadAPI.uploadFile(file, docType, sessionId);
            updateDocument(sessionId, docId, {
                status: "success",
                uploadId: res.data.upload_id,
            });
            toast.success(`${file.name} uploaded`);
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            let errorMsg = `Failed to upload ${file.name}`;
            if (typeof detail === "string") {
                errorMsg = detail;
            } else if (Array.isArray(detail)) {
                errorMsg = detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
            }
            updateDocument(sessionId, docId, {
                status: "error",
                errorMessage: errorMsg,
            });
            toast.error(errorMsg);
        }
    };

    const handleFiles = (list: FileList | null) => {
        if (!list) return;
        Array.from(list).forEach((f) => uploadOne(f, selectedDocType));
    };

    const handleRemoveDoc = (docId: string) => {
        removeDocument(sessionId, docId);
    };

    const docCounts = {
        syllabus: existingDocuments.filter(d => d.type === "syllabus" && d.status === "success").length,
        notes: existingDocuments.filter(d => d.type === "notes" && d.status === "success").length,
        past_paper: existingDocuments.filter(d => d.type === "past_paper" && d.status === "success").length,
    };

    return (
        <div className="space-y-4">
            {/* Doc type segmented control */}
            <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">
                    Document Type
                </label>
                <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50">
                    {DOC_TYPES.map((dt) => {
                        const isActive = selectedDocType === dt.value;
                        const Icon = dt.icon;
                        const count = docCounts[dt.value as keyof typeof docCounts];
                        return (
                            <button
                                key={dt.value}
                                onClick={() => setSelectedDocType(dt.value)}
                                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm
                  font-medium transition-all
                  ${isActive
                                        ? "bg-white text-neutral-900 shadow-sm"
                                        : "text-neutral-500 hover:text-neutral-700"
                                    }
                `}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {dt.label}
                                {count > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-neutral-100 text-neutral-600" : "bg-neutral-200/50 text-neutral-400"
                                        }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Upload button + drop zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                }}
                className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${isDragging
                        ? "border-neutral-400 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    }
        `}
                onClick={() => inputRef.current?.click()}
            >
                <Upload className={`w-6 h-6 mx-auto mb-2 ${isDragging ? "text-neutral-600" : "text-neutral-300"}`} />
                <p className="text-sm text-neutral-600 font-medium mb-0.5">
                    Click to upload or drag and drop
                </p>
                <p className="text-xs text-neutral-400">
                    PDF files only
                </p>
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

            {/* Files table */}
            {existingDocuments.length > 0 && (
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-200">
                                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                                    File
                                </th>
                                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                                    Uploaded
                                </th>
                                <th className="px-4 py-2.5 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {existingDocuments.map((doc) => (
                                <tr key={doc.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <FileIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                            <span className="truncate max-w-[200px] text-neutral-700">
                                                {doc.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-600 capitalize">
                                            {doc.type === "past_paper" ? "Past Paper" : doc.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        {doc.status === "uploading" && (
                                            <span className="flex items-center gap-1.5 text-neutral-500">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading
                                            </span>
                                        )}
                                        {doc.status === "success" && (
                                            <span className="flex items-center gap-1.5 text-green-600">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Done
                                            </span>
                                        )}
                                        {doc.status === "error" && (
                                            <span
                                                className="flex items-center gap-1.5 text-red-500"
                                                title={doc.errorMessage}
                                            >
                                                <XCircle className="w-3.5 h-3.5" /> Failed
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-neutral-400 text-xs">
                                        {new Date(doc.uploadedAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        {doc.status !== "uploading" && (
                                            <button
                                                onClick={() => handleRemoveDoc(doc.id)}
                                                className="p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-red-500 transition-colors"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}