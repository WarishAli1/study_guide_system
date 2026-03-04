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

const DOC_TYPES = [
    {
        value: "notes",
        label: "Notes",
        icon: FileText,
        tab: {
            active: "text-blue-700 border-blue-100",
            icon: "text-blue-500",
            badge: "bg-blue-100 text-blue-600",
            ring: "ring-blue-200",
        },
        pill: "bg-blue-50 text-blue-600 border-blue-100",
        fileIcon: "text-blue-300",
        dropzone: "border-blue-100 hover:border-blue-300 hover:bg-blue-50/30",
        dropzoneActive: "border-blue-400 bg-blue-50",
        iconBg: "bg-blue-50",
        iconBgActive: "bg-blue-100",
        uploadIcon: "text-blue-400",
        uploadIconActive: "text-blue-600",
        tableHeader: "bg-blue-50/60 border-blue-100",
        tableHover: "hover:bg-blue-50/40",
        tableBorder: "border-blue-100",
        emptyBorder: "border-blue-100 bg-blue-50/30",
        emptyIcon: "text-blue-200",
        filterText: "text-blue-700",
        filterUnderline: "hover:text-blue-600",
    },
    {
        value: "syllabus",
        label: "Syllabus",
        icon: BookOpen,
        tab: {
            active: "text-violet-700 border-violet-100",
            icon: "text-violet-500",
            badge: "bg-violet-100 text-violet-600",
            ring: "ring-violet-200",
        },
        pill: "bg-violet-50 text-violet-600 border-violet-100",
        fileIcon: "text-violet-300",
        dropzone: "border-violet-100 hover:border-violet-300 hover:bg-violet-50/30",
        dropzoneActive: "border-violet-400 bg-violet-50",
        iconBg: "bg-violet-50",
        iconBgActive: "bg-violet-100",
        uploadIcon: "text-violet-400",
        uploadIconActive: "text-violet-600",
        tableHeader: "bg-violet-50/60 border-violet-100",
        tableHover: "hover:bg-violet-50/40",
        tableBorder: "border-violet-100",
        emptyBorder: "border-violet-100 bg-violet-50/30",
        emptyIcon: "text-violet-200",
        filterText: "text-violet-700",
        filterUnderline: "hover:text-violet-600",
    },
    {
        value: "past_paper",
        label: "Past Paper",
        icon: ClipboardList,
        tab: {
            active: "text-amber-700 border-amber-100",
            icon: "text-amber-500",
            badge: "bg-amber-100 text-amber-600",
            ring: "ring-amber-200",
        },
        pill: "bg-amber-50 text-amber-600 border-amber-100",
        fileIcon: "text-amber-300",
        dropzone: "border-amber-100 hover:border-amber-300 hover:bg-amber-50/30",
        dropzoneActive: "border-amber-400 bg-amber-50",
        iconBg: "bg-amber-50",
        iconBgActive: "bg-amber-100",
        uploadIcon: "text-amber-400",
        uploadIconActive: "text-amber-600",
        tableHeader: "bg-amber-50/60 border-amber-100",
        tableHover: "hover:bg-amber-50/40",
        tableBorder: "border-amber-100",
        emptyBorder: "border-amber-100 bg-amber-50/30",
        emptyIcon: "text-amber-200",
        filterText: "text-amber-700",
        filterUnderline: "hover:text-amber-600",
    },
] as const;

type DocTypeValue = (typeof DOC_TYPES)[number]["value"];

function getDocTypeConfig(value: string) {
    return DOC_TYPES.find((d) => d.value === value) ?? DOC_TYPES[0];
}

export default function FileUploadCard({ sessionId, existingDocuments }: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState<string>("notes");
    const [filterDocType, setFilterDocType] = useState<DocTypeValue | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { addDocument, updateDocument, removeDocument, sessions } = useSessionStore();

    const activeConfig = getDocTypeConfig(selectedDocType);

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
            updateDocument(sessionId, docId, { status: "success", uploadId: res.data.upload_id });
            toast.success(`${file.name} uploaded`);
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            let errorMsg = `Failed to upload ${file.name}`;
            if (typeof detail === "string") errorMsg = detail;
            else if (Array.isArray(detail))
                errorMsg = detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
            updateDocument(sessionId, docId, { status: "error", errorMessage: errorMsg });
            toast.error(errorMsg);
        }
    };

    const handleFiles = (list: FileList | null) => {
        if (!list) return;
        Array.from(list).forEach((f) => uploadOne(f, selectedDocType));
    };

    const handleRemoveDoc = async (docId: string, doc: SessionDocument, uploadId?: number) => {
        if (uploadId) {
            try {
                const session = sessions.find((s) => s.id === sessionId);
                const subject = session?.name || "general";
                await uploadAPI.deleteUpload(subject, doc.type);
            } catch {
                toast.error("Failed to delete file from server");
                return;
            }
        }
        removeDocument(sessionId, docId);
        toast.success("Document removed");
    };

    const docCounts = {
        notes: existingDocuments.filter((d) => d.type === "notes" && d.status === "success").length,
        syllabus: existingDocuments.filter((d) => d.type === "syllabus" && d.status === "success").length,
        past_paper: existingDocuments.filter((d) => d.type === "past_paper" && d.status === "success").length,
    };

    const handleDocTypeClick = (value: string) => {
        setSelectedDocType(value);
        setFilterDocType(filterDocType === value ? null : (value as DocTypeValue));
    };

    const displayedDocuments = filterDocType
        ? existingDocuments.filter((d) => d.type === filterDocType)
        : existingDocuments;

    return (
        <div className="space-y-4">
            {/* Top row */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">
                        Document Type
                    </label>
                    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
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
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                    ${isSelected
                                            ? `bg-white shadow-sm border ${dt.tab.active}`
                                            : "text-slate-500 hover:text-slate-700"
                                        }
                    ${isFiltered && isSelected ? `ring-2 ${dt.tab.ring}` : ""}
                  `}
                                >
                                    <Icon className={`w-3.5 h-3.5 ${isSelected ? dt.tab.icon : ""}`} />
                                    {dt.label}
                                    {count > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                            isSelected ? dt.tab.badge : "bg-slate-200/50 text-slate-400"
                                        }`}>
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
                    <span className="text-xs text-slate-500">
                        Showing:{" "}
                        <span className={`font-medium capitalize ${getDocTypeConfig(filterDocType).filterText}`}>
                            {filterDocType === "past_paper" ? "Past Papers" : filterDocType}
                        </span>{" "}
                        only
                    </span>
                    <button
                        onClick={() => setFilterDocType(null)}
                        className={`text-xs text-slate-400 underline transition-colors ${getDocTypeConfig(filterDocType).filterUnderline}`}
                    >
                        Show all
                    </button>
                </div>
            )}

            {/* Drop zone — color shifts with selected doc type */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isDragging ? activeConfig.dropzoneActive : activeConfig.dropzone
                }`}
                onClick={() => inputRef.current?.click()}
            >
                <div className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center transition-colors ${
                    isDragging ? activeConfig.iconBgActive : activeConfig.iconBg
                }`}>
                    <Upload className={`w-5 h-5 ${isDragging ? activeConfig.uploadIconActive : activeConfig.uploadIcon}`} />
                </div>
                <p className="text-sm text-slate-600 font-medium mb-0.5">
                    Click to upload or drag and drop
                </p>
                <p className="text-xs text-slate-400">
                    Uploading as{" "}
                    <span className={`font-medium ${activeConfig.tab.icon}`}>
                        {activeConfig.label}
                    </span>
                </p>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
                />
            </div>

            {/* Files table */}
            {displayedDocuments.length > 0 && (
                <div className={`border rounded-lg overflow-hidden ${
                    filterDocType ? getDocTypeConfig(filterDocType).tableBorder : "border-slate-200"
                }`}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`border-b ${
                                filterDocType
                                    ? getDocTypeConfig(filterDocType).tableHeader
                                    : "bg-slate-50/60 border-slate-200"
                            }`}>
                                <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">File</th>
                                <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">Type</th>
                                <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">Uploaded</th>
                                <th className="px-4 py-2.5 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {displayedDocuments.map((doc) => {
                                const cfg = getDocTypeConfig(doc.type);
                                return (
                                    <tr key={doc.id} className={`bg-white transition-colors ${cfg.tableHover}`}>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <FileIcon className={`w-3.5 h-3.5 shrink-0 ${cfg.fileIcon}`} />
                                                <span className="truncate max-w-[200px] text-slate-700">{doc.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border capitalize ${cfg.pill}`}>
                                                {doc.type === "past_paper" ? "Past Paper" : doc.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {doc.status === "uploading" && (
                                                <span className="flex items-center gap-1.5 text-slate-500">
                                                    <Loader2 className={`w-3.5 h-3.5 animate-spin ${cfg.uploadIcon}`} /> Uploading
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
                                        <td className="px-4 py-2.5 text-slate-400 text-xs">
                                            {new Date(doc.uploadedAt).toLocaleDateString("en-US", {
                                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                            })}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {doc.status !== "uploading" && (
                                                <button
                                                    onClick={() => handleRemoveDoc(doc.id, doc, doc.uploadId)}
                                                    className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                                                    title="Remove"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {filterDocType && displayedDocuments.length === 0 && existingDocuments.length > 0 && (
                <div className={`text-center py-8 border rounded-lg ${getDocTypeConfig(filterDocType).emptyBorder}`}>
                    <FileIcon className={`w-6 h-6 mx-auto mb-2 ${getDocTypeConfig(filterDocType).emptyIcon}`} />
                    <p className="text-sm text-slate-500">
                        No {filterDocType === "past_paper" ? "past paper" : filterDocType} files uploaded yet.
                    </p>
                </div>
            )}
        </div>
    );
}