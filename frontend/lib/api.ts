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
        year?: number,
        subject?: string
    ) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("doc_type", docType);
        if (year !== undefined) formData.append("year", String(year));
        if (subject) formData.append("subject", subject);

        return api.post("/api/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    listUploads: (docType?: string) => {
        const params = docType ? { doc_type: docType } : {};
        return api.get("/api/uploads", { params });
    },

    getUpload: (id: number) => api.get(`/api/uploads/${id}`),

    getExtractedText: (id: number) => api.get(`/api/uploads/${id}/text`),

    deleteUpload: (id: number) => api.delete(`/api/uploads/${id}`),
};

export default api;