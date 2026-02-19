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
import { useSessionStore } from "@/lib/session-store";
import type { SessionDocument } from "@/lib/types";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

interface Props {
    sessionId: string;
    existingDocuments: SessionDocument[];
}

export default function FileUploadCard({
    sessionId,
    existingDocuments,
}: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const [yearInput, setYearInput] = useState<string>("");
    const [showYearPrompt, setShowYearPrompt] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [docTypeForUpload, setDocTypeForUpload] = useState<string>("notes");
    const inputRef = useRef<HTMLInputElement>(null);

    const { addDocument, updateDocument, removeDocument } = useSessionStore();

    const uploadOne = async (file: File, docType: string, year?: number) => {
        const docId = uuidv4();
        const newDoc: SessionDocument = {
            id: docId,
            name: file.name,
            type: docType as SessionDocument["type"],
            uploadedAt: new Date().toISOString(),
            status: "uploading",
            year,
        };

        addDocument(sessionId, newDoc);

        try {
            const res = await uploadAPI.uploadFile(file, docType, sessionId, year);
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

    const handleFiles = (list: FileList | null, docType: string) => {
        if (!list) return;
        const files = Array.from(list);

        if (docType === "past_paper") {
            setPendingFiles(files);
            setDocTypeForUpload(docType);
            setShowYearPrompt(true);
        } else {
            files.forEach((f) => uploadOne(f, docType));
        }
    };

    const handleYearSubmit = () => {
        const year = parseInt(yearInput, 10);
        if (isNaN(year) || year < 1900 || year > 2100) {
            toast.error("Please enter a valid year (e.g., 2023)");
            return;
        }
        pendingFiles.forEach((f) => uploadOne(f, docTypeForUpload, year));
        setPendingFiles([]);
        setYearInput("");
        setShowYearPrompt(false);
    };

    const handleRemoveDoc = (docId: string) => {
        removeDocument(sessionId, docId);
    };

    const docTypes = [
        { value: "syllabus", label: "Syllabus" },
        { value: "notes", label: "Notes" },
        { value: "past_paper", label: "Past Paper" },
    ];

    const [selectedDocType, setSelectedDocType] = useState("notes");

    return (
        <div className="space-y-4">
            {/* Upload area */}
            <div className="flex items-end gap-3 mb-2">
                <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Document Type</label>
                    <select
                        value={selectedDocType}
                        onChange={(e) => setSelectedDocType(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-neutral-200 text-sm
                       focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900
                       outline-none bg-white"
                    >
                        {docTypes.map((dt) => (
                            <option key={dt.value} value={dt.value}>{dt.label}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => inputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm
                     font-medium hover:bg-neutral-800 transition-colors
                     flex items-center gap-2"
                >
                    <Upload className="w-4 h-4" />
                    Upload Files
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        handleFiles(e.target.files, selectedDocType);
                        e.target.value = "";
                    }}
                />
            </div>

            {/* Drop zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files, selectedDocType);
                }}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragging
                        ? "border-neutral-400 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
            >
                <Upload className={`w-6 h-6 mx-auto mb-2 ${isDragging ? "text-neutral-600" : "text-neutral-300"}`} />
                <p className="text-xs text-neutral-500">
                    {isDragging ? "Drop files here" : "Or drag & drop PDF files here"}
                </p>
            </div>

            {/* Year prompt for past papers */}
            {showYearPrompt && (
                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
                    <p className="text-sm text-neutral-700 mb-2">
                        Enter the year for {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""}:
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={yearInput}
                            onChange={(e) => setYearInput(e.target.value)}
                            placeholder="e.g., 2023"
                            className="flex-1 px-3 py-2 rounded-lg border border-neutral-300
                         focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900
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
                            className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
                        >
                            Upload
                        </button>
                        <button
                            onClick={() => {
                                setShowYearPrompt(false);
                                setPendingFiles([]);
                                setYearInput("");
                            }}
                            className="px-3 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Files table */}
            {existingDocuments.length > 0 && (
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-200">
                                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs uppercase tracking-wider">File</th>
                                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs uppercase tracking-wider">Type</th>
                                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs uppercase tracking-wider">Year</th>
                                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs uppercase tracking-wider">Uploaded</th>
                                <th className="px-4 py-2.5 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {existingDocuments.map((doc) => (
                                <tr key={doc.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <FileIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                            <span className="truncate max-w-[200px] text-neutral-700">{doc.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-600 capitalize">
                                            {doc.type === "past_paper" ? "Past Paper" : doc.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-neutral-500">
                                        {doc.year || "—"}
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
                                            <span className="flex items-center gap-1.5 text-red-500" title={doc.errorMessage}>
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