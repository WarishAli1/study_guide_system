"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import FileUploadCard from "@/components/FileUploadCard";
import { BookText, FileText, ClipboardList } from "lucide-react";

export default function UploadPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.replace("/login");
    }, [isAuthenticated, isLoading, router]);

    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-10">
            {/* heading */}
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-gray-900">Upload Documents</h1>
                <p className="text-gray-500 mt-2 max-w-2xl">
                    Upload your course materials to generate a personalised study guide.
                    We accept <strong>PDF</strong> files for each category below.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FileUploadCard
                    title="Syllabus"
                    description="Course syllabus with units & topics"
                    type="syllabus"
                    icon={<BookText className="w-5 h-5 text-blue-600" />}
                    accentColor="bg-blue-100"
                />
                <FileUploadCard
                    title="Course Notes"
                    description="Lecture notes & study materials"
                    type="note"
                    icon={<FileText className="w-5 h-5 text-emerald-600" />}
                    accentColor="bg-emerald-100"
                />
                <FileUploadCard
                    title="Past Questions"
                    description="Previous year exam papers"
                    type="past_paper"
                    icon={<ClipboardList className="w-5 h-5 text-amber-600" />}
                    accentColor="bg-amber-100"
                />
            </div>

            <div className="mt-10 bg-indigo-50 border border-indigo-100 rounded-xl p-6">
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