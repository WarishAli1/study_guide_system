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
        subject: string,
        sessionId: string,
        workspaceId: string,
        year?: number
    ) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("doc_type", docType);
        formData.append("subject", subject);
        formData.append("session_id", sessionId);
        formData.append("workspace_id", workspaceId);
        if (year !== undefined) {
            formData.append("year", year.toString());
        }
        return api.post("/api/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
};

export default api;