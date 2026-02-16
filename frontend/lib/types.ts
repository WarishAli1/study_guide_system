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
    year?: number;
    errorMessage?: string;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}

export interface Session {
    id: string;
    name: string;
    subject: string;
    createdAt: string;
    updatedAt: string;
    documents: SessionDocument[];
    messages: ChatMessage[];
}

export interface Workspace {
    id: string;
    name: string;
    description: string;
    color: string;
    createdAt: string;
    updatedAt: string;
    sessions: Session[];
}