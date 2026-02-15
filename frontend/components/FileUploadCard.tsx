"use client";

import { useState, useRef } from "react";
import {
    Upload,
    FileIcon,
    CheckCircle2,
    XCircle,
    Loader2,
    Eye,
    ScanLine,
} from "lucide-react";
import { uploadAPI } from "@/lib/api";
import { UploadResponse, DocType } from "@/lib/types";
import toast from "react-hot-toast";

/* ── accepted file types ─────────────────────────────────────────────── */
const ACCEPT =
    ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp";

/* ── props ───────────────────────────────────────────────────────────── */
interface Props {
    title: string;
    description: string;
    docType: DocType;
    icon: React.ReactNode;
    accentColor: string;
    requiresYear?: boolean;
}

/* ── per-file state ──────────────────────────────────────────────────── */
interface TrackedFile {
    id: string;
    name: string;
    status: "uploading" | "success" | "error";
    response?: UploadResponse;
    error?: string;
}

export default function FileUploadCard({
    title,
    description,
    docType,
    icon,
    accentColor,
    requiresYear = false,
}: Props) {
    const [files, setFiles] = useState<TrackedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [year, setYear] = useState<string>("");
    const [subject, setSubject] = useState<string>("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    /* ── upload a single file ────────────────────────────────────────── */
    const uploadOne = async (file: File) => {
        /* block past_paper uploads without a year */
        if (requiresYear && !year.trim()) {
            toast.error("Please enter the exam year before uploading.");
            return;
        }

        const parsedYear = year.trim() ? parseInt(year.trim(), 10) : undefined;
        if (requiresYear && (isNaN(parsedYear!) || parsedYear! < 1900 || parsedYear! > 2099)) {
            toast.error("Please enter a valid 4-digit year.");
            return;
        }

        const id = crypto.randomUUID();
        setFiles((prev) => [...prev, { id, name: file.name, status: "uploading" }]);

        try {
            const res = await uploadAPI.uploadFile(
                file,
                docType,
                parsedYear,
                subject.trim() || undefined
            );
            const data: UploadResponse = res.data;

            setFiles((prev) =>
                prev.map((f) =>
                    f.id === id ? { ...f, status: "success", response: data } : f
                )
            );

            const ocrNote = data.ocr_used
                ? ` (OCR used on ${data.ocr_pages.length} page${data.ocr_pages.length > 1 ? "s" : ""})`
                : "";
            toast.success(`${file.name} — ${data.page_count} pages extracted${ocrNote}`);
        } catch (err: any) {
            const message =
                err?.response?.data?.detail || `Failed to upload ${file.name}`;
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === id ? { ...f, status: "error", error: message } : f
                )
            );
            toast.error(message);
        }
    };

    /* ── handle dropped / selected files ─────────────────────────────── */
    const handleFiles = (list: FileList | null) => {
        if (!list) return;
        Array.from(list).forEach((f) => uploadOne(f));
    };

    /* ── toggle preview ──────────────────────────────────────────────── */
    const togglePreview = (id: string) =>
        setExpandedId((prev) => (prev === id ? null : id));

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            {/* ── header ──────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${accentColor}`}>{icon}</div>
                <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>

            {/* ── optional metadata fields ────────────────────────────────── */}
            <div className="space-y-2 mb-4">
                {requiresYear && (
                    <input
                        type="number"
                        placeholder="Exam year (e.g. 2023) *"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        min={1900}
                        max={2099}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-400
                       placeholder:text-gray-400"
                    />
                )}
                <input
                    type="text"
                    placeholder="Subject name (optional)"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-400
                     placeholder:text-gray-400"
                />
            </div>

            {/* ── drop zone ───────────────────────────────────────────────── */}
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
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${isDragging
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
                    }`}
            >
                <Upload
                    className={`w-8 h-8 mx-auto mb-3 ${isDragging ? "text-indigo-500" : "text-gray-400"
                        }`}
                />
                <p className="text-sm font-medium text-gray-700">
                    {isDragging ? "Drop files here" : "Drag & drop or click to browse"}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF and image files supported</p>

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
            </div>

            {/* ── file list with extraction details ───────────────────────── */}
            {files.length > 0 && (
                <ul className="mt-4 space-y-2 max-h-72 overflow-y-auto">
                    {files.map((f) => (
                        <li key={f.id} className="bg-gray-50 rounded-lg overflow-hidden">
                            {/* main row */}
                            <div className="flex items-center gap-3 p-3">
                                <FileIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="text-sm text-gray-700 truncate flex-1">
                                    {f.name}
                                </span>

                                {/* badges */}
                                {f.response?.ocr_used && (
                                    <span
                                        className="flex items-center gap-1 text-[11px] text-amber-700
                               bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0"
                                        title={`OCR on pages: ${f.response.ocr_pages.join(", ")}`}
                                    >
                                        <ScanLine className="w-3 h-3" /> OCR
                                    </span>
                                )}
                                {f.response?.page_count && (
                                    <span className="text-[11px] text-gray-500 shrink-0">
                                        {f.response.page_count}p
                                    </span>
                                )}

                                {/* preview toggle */}
                                {f.status === "success" && f.response?.text_preview && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePreview(f.id);
                                        }}
                                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors shrink-0"
                                        title="Preview extracted text"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                )}

                                {/* status icon */}
                                {f.status === "uploading" && (
                                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                                )}
                                {f.status === "success" && (
                                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                )}
                                {f.status === "error" && (
                                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                                )}
                            </div>

                            {/* error detail */}
                            {f.status === "error" && f.error && (
                                <div className="px-3 pb-3">
                                    <p className="text-xs text-red-600">{f.error}</p>
                                </div>
                            )}

                            {/* text preview panel */}
                            {expandedId === f.id && f.response?.text_preview && (
                                <div className="border-t border-gray-200 px-3 py-2">
                                    <p className="text-[11px] font-medium text-gray-500 mb-1">
                                        Extracted text preview
                                    </p>
                                    <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono leading-relaxed">
                                        {f.response.text_preview}
                                    </pre>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}