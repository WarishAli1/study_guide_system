import axios from "axios";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
    baseURL: API_BASE_URL,
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
    uploadFile: (
        file: File,
        docType: string,
        sessionId: string
    ) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("doc_type", docType);
        formData.append("session_id", sessionId);
        formData.append("subject", "general");
        formData.append("workspace_id", "default");
        return api.post("/api/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
};

export const guideAPI = {
    generate: (subjectName: string, useCache: boolean = true) =>
        api.get(`/api/guide/generate/${encodeURIComponent(subjectName)}`, {
            params: { use_cache: useCache },
        }),
    regenerate: (subjectName: string) =>
        api.post(`/api/guide/regenerate/${encodeURIComponent(subjectName)}`),
};

export default api;