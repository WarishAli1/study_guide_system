"use client";

import { useState, useRef } from "react";
import {
    Upload,
    FileIcon,
    CheckCircle2,
    XCircle,
    Loader2,
} from "lucide-react";
import { uploadAPI } from "@/lib/api";
import toast from "react-hot-toast";

interface Props {
    title: string;
    description: string;
    type: string;
    icon: React.ReactNode;
    accentColor: string;
}

interface TrackedFile {
    id: string;
    name: string;
    status: "uploading" | "success" | "error";
}

export default function FileUploadCard({
    title,
    description,
    type,
    icon,
    accentColor,
}: Props) {
    const [files, setFiles] = useState<TrackedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const uploadOne = async (file: File) => {
        const id = crypto.randomUUID();
        setFiles((prev) => [...prev, { id, name: file.name, status: "uploading" }]);

        try {
            await uploadAPI.uploadFile(file, type);
            setFiles((prev) =>
                prev.map((f) => (f.id === id ? { ...f, status: "success" } : f))
            );
            toast.success(`${file.name} uploaded`);
        } catch (err: any) {
            setFiles((prev) =>
                prev.map((f) => (f.id === id ? { ...f, status: "error" } : f))
            );
            toast.error(
                err?.response?.data?.detail || `Failed to upload ${file.name}`
            );
        }
    };

    const handleFiles = (list: FileList | null) => {
        if (!list) return;
        Array.from(list).forEach((f) => uploadOne(f));
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

            {files.length > 0 && (
                <ul className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                    {files.map((f) => (
                        <li
                            key={f.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                        >
                            <FileIcon className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-700 truncate flex-1">
                                {f.name}
                            </span>
                            {f.status === "uploading" && (
                                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                            )}
                            {f.status === "success" && (
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            )}
                            {f.status === "error" && (
                                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}