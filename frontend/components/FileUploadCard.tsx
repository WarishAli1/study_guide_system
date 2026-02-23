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
    Info,
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

// Reordered: Notes first, then Syllabus, then Past Paper
const DOC_TYPES = [
    { value: "notes", label: "Notes", icon: FileText },
    { value: "syllabus", label: "Syllabus", icon: BookOpen },
    { value: "past_paper", label: "Past Paper", icon: ClipboardList },
] as const;

type DocTypeValue = (typeof DOC_TYPES)[number]["value"];

export default function FileUploadCard({
    sessionId,
    existingDocuments,
}: Props) {
    const [isDragging, setIsDragging] = useState(false);
    // The type selected for UPLOADING new files
    const [selectedDocType, setSelectedDocType] = useState<string>("notes");
    // The type filter for the file LIST — null means "show all"
    const [filterDocType, setFilterDocType] = useState<DocTypeValue | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        addDocument,
        updateDocument,
        removeDocument,
        getActiveSession,
        sessions,
        activeSessionId,
    } = useSessionStore();
    const activeSession = getActiveSession();

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
            const session = sessions.find((s) => s.id === sessionId);
            const subject = session?.name || "general";

            const res = await uploadAPI.uploadFile(file, docType, subject);

            updateDocument(sessionId, docId, {
                status: "success",
                uploadId: res.data.upload_id,
            });
            toast.success(`${file.name} uploaded`);
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            let errorMsg = `Failed to upload ${file.name}`;
            if (typeof detail === "string") errorMsg = detail;
            else if (Array.isArray(detail))
                errorMsg = detail
                    .map((d: any) => d.msg || JSON.stringify(d))
                    .join("; ");

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

    const handleRemoveDoc = async (
        docId: string,
        doc: SessionDocument,
        uploadId?: number
    ) => {
        if (uploadId) {
            try {
                const session = sessions.find((s) => s.id === sessionId);
                const subject = session?.name || "general";
                const docType = doc.type;
                await uploadAPI.deleteUpload(subject, docType);
            } catch (err) {
                toast.error("Failed to delete file from server");
                return;
            }
        }
        removeDocument(sessionId, docId);
        toast.success("Document removed");
    };

    const docCounts = {
        notes: existingDocuments.filter(
            (d) => d.type === "notes" && d.status === "success"
        ).length,
        syllabus: existingDocuments.filter(
            (d) => d.type === "syllabus" && d.status === "success"
        ).length,
        past_paper: existingDocuments.filter(
            (d) => d.type === "past_paper" && d.status === "success"
        ).length,
    };

    // Handle clicking a doc type button:
    // - Sets the upload type
    // - Toggles the filter (click same type again → show all)
    const handleDocTypeClick = (value: string) => {
        setSelectedDocType(value);

        if (filterDocType === value) {
            // Clicking the already-active filter → clear filter (show all)
            setFilterDocType(null);
        } else {
            // Activate filter for this type
            setFilterDocType(value as DocTypeValue);
        }
    };

    // Filtered documents for the table
    const displayedDocuments = filterDocType
        ? existingDocuments.filter((d) => d.type === filterDocType)
        : existingDocuments;

    return (
        <div className="space-y-4">
            {/* Top row: Doc type selector + helper note */}
            <div className="flex items-start justify-between gap-4">
                {/* Doc type segmented control */}
                <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-2">
                        Document Type
                    </label>
                    <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50">
                        {DOC_TYPES.map((dt) => {
                            const isSelected = selectedDocType === dt.value;
                            const isFiltered = filterDocType === dt.value;
                            const Icon = dt.icon;
                            const count = docCounts[dt.value as keyof typeof docCounts];

                            return (
                                <button
                                    key={dt.value}
                                    onClick={() => handleDocTypeClick(dt.value)}
                                    className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm
                    font-medium transition-all
                    ${isSelected
                                            ? "bg-white text-neutral-900 shadow-sm"
                                            : "text-neutral-500 hover:text-neutral-700"
                                        }
                    ${isFiltered && isSelected
                                            ? "ring-2 ring-neutral-900/20"
                                            : ""
                                        }
                  `}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {dt.label}
                                    {count > 0 && (
                                        <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected
                                                ? "bg-neutral-100 text-neutral-600"
                                                : "bg-neutral-200/50 text-neutral-400"
                                                }`}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Helper note */}
                <div className="flex items-start gap-1.5 mt-5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 max-w-[260px]">
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                        Upload in order: <span className="font-semibold">Notes</span> first,
                        then <span className="font-semibold">Syllabus</span>, and finally{" "}
                        <span className="font-semibold">Past Papers</span>.
                    </p>
                </div>
            </div>

            {/* Filter indicator */}
            {filterDocType && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">
                        Showing:{" "}
                        <span className="font-medium text-neutral-700 capitalize">
                            {filterDocType === "past_paper" ? "Past Papers" : filterDocType}
                        </span>{" "}
                        only
                    </span>
                    <button
                        onClick={() => setFilterDocType(null)}
                        className="text-xs text-neutral-400 hover:text-neutral-600 underline transition-colors"
                    >
                        Show all
                    </button>
                </div>
            )}

            {/* Upload button + drop zone */}
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                }}
                className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          cursor-pointer
          ${isDragging
                        ? "border-neutral-400 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    }
        `}
                onClick={() => inputRef.current?.click()}
            >
                <Upload
                    className={`w-6 h-6 mx-auto mb-2 ${isDragging ? "text-neutral-600" : "text-neutral-300"
                        }`}
                />
                <p className="text-sm text-neutral-600 font-medium mb-0.5">
                    Click to upload or drag and drop
                </p>
                <p className="text-xs text-neutral-400">PDF files only</p>
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
            {displayedDocuments.length > 0 && (
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
                            {displayedDocuments.map((doc) => (
                                <tr
                                    key={doc.id}
                                    className="hover:bg-neutral-50 transition-colors"
                                >
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
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                                                Uploading
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
                                                onClick={() =>
                                                    handleRemoveDoc(doc.id, doc, doc.uploadId)
                                                }
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

            {filterDocType && displayedDocuments.length === 0 && existingDocuments.length > 0 && (
                <div className="text-center py-8 border border-neutral-200 rounded-lg">
                    <FileIcon className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">
                        No {filterDocType === "past_paper" ? "past paper" : filterDocType} files uploaded yet.
                    </p>
                </div>
            )}
        </div>
    );
}