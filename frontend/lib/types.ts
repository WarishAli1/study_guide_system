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

export type DocType = "syllabus" | "notes" | "past_paper";

export interface UploadResponse {
    status: string;
    upload_id: number;
    filename: string;
    doc_type: DocType;
    year: number | null;
    subject: string | null;
    page_count: number;
    ocr_used: boolean;
    ocr_pages: number[];
    extraction_method: string;
    text_preview: string;
}

export interface UploadRecord {
    id: number;
    original_filename: string;
    stored_filename: string;
    doc_type: DocType;
    year: number | null;
    subject: string | null;
    file_path: string;
    text_path: string | null;
    page_count: number;
    ocr_used: boolean;
    ocr_pages: number[];
    extraction_method: string;
    status: "processing" | "completed" | "failed";
    created_at: string;
}