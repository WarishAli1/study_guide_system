export interface User {
    id: number;
    email: string;
    name: string;
    picture: string;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (googleToken: string) => Promise<void>;
    logout: () => void;
}

export interface UploadResponse {
    status: string;
    upload_id: number;
    filename: string;
    doc_type: string;
    subject: string;
    page_count: number;
    ocr_used: boolean;
    extraction_method: string;
    text_preview: string;
    text_path: string;
}

export interface SessionDocument {
    id: string;
    name: string;
    type: "syllabus" | "notes" | "past_paper";
    uploadedAt: string;
    status: "uploading" | "success" | "error";
    uploadId?: number;
    errorMessage?: string;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}

// ── Study Guide types ──

export interface GuideQuestion {
    question: string;
    freq: number;
    years: string[];
    marks: (number | null)[];
}

export interface GuideChapter {
    chapter_id: string;
    chapter_name: string;
    credit_hours: number | null;
    marks_distribution: number | null;
    importance_score: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
    topics: string[];
    keywords: string[];
    questions: GuideQuestion[];
    total_questions: number;
    recommended_hours: number;
}

export interface StudyGuideReport {
    subject_name: string;
    total_chapters: number;
    total_credit_hours: number | null;
    total_marks: number | null;
    total_questions: number;
    generated_at: string;
    chapters: GuideChapter[];
}

export interface Session {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    documents: SessionDocument[];
    messages: ChatMessage[];
    cachedGuide: StudyGuideReport | null;
}