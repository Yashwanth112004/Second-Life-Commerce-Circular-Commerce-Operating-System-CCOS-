import axios from "axios";

const ACCESS_KEY = "ccos_access";
const REFRESH_KEY = "ccos_refresh";

export const tokens = {
    get access() {
        return localStorage.getItem(ACCESS_KEY) || "";
    },
    get refresh() {
        return localStorage.getItem(REFRESH_KEY) || "";
    },
    set({
        accessToken,
        refreshToken
    }) {
        if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
        if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    },
    clear() {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
    },
};

export const http = axios.create({
    baseURL: "/api"
});

http.interceptors.request.use((cfg) => {
    const t = tokens.access;
    if (t) cfg.headers.Authorization = `Bearer ${t}`;
    return cfg;
});

// On 401, try a one-time refresh, then replay the request.
let refreshing = null;
http.interceptors.response.use(
    (r) => r,
    async (error) => {
        const original = error.config;
        const status = error.response ? error.response.status : 0;
        if (status === 401 && !original._retried && tokens.refresh) {
            original._retried = true;
            try {
                if (!refreshing) {
                    refreshing = axios
                        .post("/api/auth/refresh", {
                            refreshToken: tokens.refresh
                        })
                        .then((res) => {
                            tokens.set(res.data);
                            return res.data.accessToken;
                        })
                        .finally(() => {
                            refreshing = null;
                        });
                }
                const newAccess = await refreshing;
                original.headers.Authorization = `Bearer ${newAccess}`;
                return http(original);
            } catch (e) {
                tokens.clear();
            }
        }
        return Promise.reject(error);
    }
);

const data = (p) => p.then((r) => r.data);

export const api = {
    // auth
    register: (body) => data(http.post("/auth/register", body)),
    login: (body) => data(http.post("/auth/login", body)),
    logout: () => http.post("/auth/logout", {
        refreshToken: tokens.refresh
    }).catch(() => {}),
    // user
    me: () => data(http.get("/users/me")),
    myOrders: () => data(http.get("/users/me/orders")),
    // returns
    initiateReturn: (body) => data(http.post("/returns/initiate", body)),
    uploadEvidence: (returnId, formData, role = "item") =>
        data(http.post(`/returns/${returnId}/upload?role=${role}`, formData)),
    analyzeReturn: (returnId) => data(http.post(`/returns/${returnId}/analyze`)),
    analyzeStatus: (returnId) => data(http.get(`/returns/${returnId}/analyze/status`)),
    decideReturn: (returnId, body) => data(http.post(`/returns/${returnId}/decision`, body)),
    // marketplace
    channels: () => data(http.get("/marketplace/channels")),
    search: (params) => data(http.get("/marketplace/search", {
        params
    })),
    listing: (id) => data(http.get(`/marketplace/listing/${id}`)),
    buy: (id) => data(http.post(`/marketplace/buy/${id}`)),
    predictReturn: (id, body) => data(http.post(`/marketplace/listing/${id}/predict-return`, body)),
    sizeAdvice: (id, fitPreference = "regular") => data(http.get(`/marketplace/listing/${id}/size-advice?fitPreference=${fitPreference}`)),
    review: (id, body) => data(http.post(`/marketplace/listing/${id}/review`, body)),
    // ai
    coach: () => data(http.post("/ai/sustainability-coach")),
    // circular score
    circularScore: () => data(http.get("/circular/score")),
    leaderboard: () => data(http.get("/circular/leaderboard")),
    // autonomous resale agent
    araStatus: () => data(http.get("/ara/status")),
    araToggle: (enabled) => data(http.post("/ara/toggle", {
        enabled
    })),
    araSuggestions: () => data(http.get("/ara/suggestions")),
    araList: (orderId) => data(http.post("/ara/list", {
        orderId
    })),
    // impact (public)
    impact: () => data(http.get("/impact")),
    // donations
    donations: () => data(http.get("/donations")),
    donationAdvance: (id) => data(http.post(`/donations/${id}/advance`)),
    donationReceiptUrl: (id) => `/api/donations/${id}/receipt.pdf`,
    // inspection
    inspection: (returnId) => data(http.get(`/inspection/${returnId}`)),
    inspectionPdfUrl: (returnId) => `/api/inspection/${returnId}/pdf`,
    refurbishInstructions: (returnId, skillLevel = "intermediate", tools = []) => 
        data(http.get(`/inspection/${returnId}/refurbish-instructions?skillLevel=${skillLevel}${tools.length ? `&tools=${tools.join(",")}` : ""}`)),
    // demo
    seedDemo: () => data(http.post("/demo/seed")),
    // concierge
    concierge: () => data(http.get("/concierge")),
    conciergeActivity: () => data(http.get("/concierge/activity")),
    wallet: () => data(http.get("/wallet")),
    walletHistory: () => data(http.get("/wallet/history")),
    tradeCredits: (body) => data(http.post("/wallet/trade-credits", body)),
    carbonReport: () => data(http.get("/carbon/report")),
    // passport
    passport: (orderId) => data(http.get(`/passport/${orderId}`)),
    // dashboards
    dashCustomer: () => data(http.get("/dashboards/customer")),
    dashSeller: () => data(http.get("/dashboards/seller")),
    dashEnterprise: () => data(http.get("/dashboards/enterprise")),
    notifications: () => data(http.get("/dashboards/notifications")),
    // admin
    adminAnalytics: () => data(http.get("/admin/analytics")),
    adminAiLogs: () => data(http.get("/admin/ai-logs")),
};