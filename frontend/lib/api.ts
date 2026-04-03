import axios from "axios";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 600000,
});

api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

export const authAPI = {
    googleLogin: (token: string) => api.post("/auth/google", { token }),
};

export const uploadAPI = {
    uploadFile: (file: File, docType: string, subject: string) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("doc_type", docType);
        formData.append("subject", subject);
        return api.post("api/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
    deleteUpload: (subject: string, docType: string) =>
        api.delete(`api/uploads/${subject}/${docType}`),
};

export const guideAPI = {
    generate: (subjectName: string, useCache: boolean = true) =>
        api.get(`/api/report/${encodeURIComponent(subjectName)}`, {
            params: { use_cache: useCache },
        }),
    regenerate: (subjectName: string) =>
        api.post(`/api/report/${encodeURIComponent(subjectName)}/regenerate`),
    getChapter: (subjectName: string, chapterId: string | number) =>
        api.get(
            `/api/report/${encodeURIComponent(subjectName)}/chapter/${chapterId}`
        ),
};

export interface ChatRequestPayload {
    message: string;
    subject: string;
    history?: { role: string; content: string }[];
}

export interface ChatSourceInfo {
    index: number;
    chapter_id: number | string;
    chapter_name: string;
    subtopic_id: string;
    subtopic_name: string;
    source_text?: string;
}

export interface ChatRelatedQuestion {
    question: string;
    freq: number;
    years: string[];
    marks: number[];
}

export interface InlineQuizOption {
    A: string;
    B: string;
    C: string;
    D: string;
}

export interface InlineQuizSource {
    chapter_name: string;
    subtopic_name: string;
}

export interface InlineQuizQuestion {
    id: number;
    question: string;
    options: InlineQuizOption;
    correct: string;
    explanation: string;
    source: InlineQuizSource;
}

export interface ChatResponseData {
    answer: string;
    sources: ChatSourceInfo[];
    related_questions: ChatRelatedQuestion[];
    inline_question: InlineQuizQuestion | null;
}

export const chatAPI = {
    send: (payload: ChatRequestPayload) =>
        api.post<ChatResponseData>("/api/chat", payload),
};

export const quizAPI = {
    generate: (subject: string, newQuiz: boolean = false) =>
        api.get(`/api/quiz/${encodeURIComponent(subject)}`, {
            params: newQuiz ? { new: true } : {},
        }),
};

export const analysisAPI = {
    topicGraph: (subject: string) =>
        api.get(`/api/analysis/topic-graph/${encodeURIComponent(subject)}`),
    summary: (subject: string, chapterId?: number, sentences?: number) =>
        api.get(`/api/analysis/summary/${encodeURIComponent(subject)}`, {
            params: { chapter_id: chapterId, sentences: sentences || 5 },
        }),
};

export default api;