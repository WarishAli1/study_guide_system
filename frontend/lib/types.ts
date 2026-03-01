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

export interface ChatSource {
    index: number;
    chapter_id: number | string;
    chapter_name: string;
    subtopic_id: string;
    subtopic_name: string;
}

export interface ChatRelatedQuestion {
    question: string;
    freq: number;
    years: string[];
    marks: number[];
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    sources?: ChatSource[];
    relatedQuestions?: ChatRelatedQuestion[];
}

export interface ChatConversation {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: ChatMessage[];
}

// ── Study Guide types ──

export interface GuideQuestion {
    question: string;
    freq: number;
    years: string[];
    marks: (number | null)[];
}

export interface GuideChapter {
    chapter_id: number | string;
    chapter_name: string;
    credit_hours: number | null;
    marks_distribution: number | null;
    importance_score: number;
    study_priority: "HIGH" | "MEDIUM" | "LOW";
    recommended_study: string;
    important_topics: string[];
    total_subtopics: number;
    total_past_questions: number;
    faq: GuideQuestion[];
    faq_count: number;
    max_marks_question: number;
    exam_tips: string[];
}

export interface StudyGuideReport {
    subject_name: string;
    total_chapters: number;
    total_credit_hours: number | null;
    total_marks: number | null;
    total_past_questions: number;
    generated_at: string;
    study_priority_order: Array<{
        chapter_id: number | string;
        chapter_name: string;
        importance_score: number;
        study_priority: string;
        faq_count: number;
    }>;
    chapters: GuideChapter[];
}

export interface Session {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    documents: SessionDocument[];
    conversations: ChatConversation[];
    cachedGuide: StudyGuideReport | null;
}

export interface QuizOption {
    A: string;
    B: string;
    C: string;
    D: string;
}

export interface QuizQuestion {
    id: number;
    question: string;
    options: QuizOption;
    correct: string;
    explanation: string;
    source: {
        chapter_name: string;
        subtopic_name: string;
    };
}

export interface QuizData {
    subject: string;
    total_questions: number;
    questions: QuizQuestion[];
}