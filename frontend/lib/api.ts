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
    uploadFile: (
        file: File,
        docType: string,
        subject: string
    ) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("doc_type", docType);
        formData.append("subject", subject);
        return api.post("api/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
    deleteUpload: (subject: string, docType: string) => api.delete(`api/uploads/${subject}/${docType}`),
};

export const guideAPI = {
    generate: (subjectName: string, useCache: boolean = true) =>
        api.get(`/api/report/${encodeURIComponent(subjectName)}`, {
            params: { use_cache: useCache },
        }),

    regenerate: (subjectName: string) =>
        api.post(`/api/report/${encodeURIComponent(subjectName)}/regenerate`),

    // Optional: for fetching a single chapter's details (not used yet)
    getChapter: (subjectName: string, chapterId: string | number) =>
        api.get(`/api/report/${encodeURIComponent(subjectName)}/chapter/${chapterId}`),
};

export default api;