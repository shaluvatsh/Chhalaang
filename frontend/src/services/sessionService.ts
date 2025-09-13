import axios from "axios";

const API_BASE_URL = "https://tech-tiaras-api.vercel.app/api";

interface CreateSessionData {
  doctorName: string;
  patientName: string;
}

interface SessionInfo {
  sessionId: string;
  doctorName: string;
  patientName: string;
  status: string;
  createdAt: string;
}

interface JoinSessionData {
  userName: string;
  role: "doctor" | "patient";
}

class SessionService {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor for debugging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.log(
          `📡 API Request: ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error) => {
        console.error("❌ API Request Error:", error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.log(
          `✅ API Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      (error) => {
        console.error(
          "❌ API Response Error:",
          error.response?.data || error.message
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a new consultation session
   */
  async createSession(data: CreateSessionData): Promise<SessionInfo> {
    try {
      const response = await this.axiosInstance.post("/session/create", data);
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || "Failed to create session"
      );
    }
  }

  /**
   * Join an existing session
   */
  async joinSession(
    sessionId: string,
    data: JoinSessionData
  ): Promise<SessionInfo> {
    try {
      const response = await this.axiosInstance.post(
        `/session/${sessionId}/join`,
        data
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Failed to join session");
    }
  }

  /**
   * Get session information
   */
  async getSession(sessionId: string): Promise<SessionInfo> {
    try {
      const response = await this.axiosInstance.get(`/session/${sessionId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Session not found");
    }
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.axiosInstance.post(
        `/session/${sessionId}/end`
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Failed to end session");
    }
  }

  /**
   * Get all active sessions (for admin/doctor dashboard)
   */
  async getActiveSessions(): Promise<SessionInfo[]> {
    try {
      const response = await this.axiosInstance.get("/session/active");
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Failed to get sessions");
    }
  }
}

export const sessionService = new SessionService();
export type { CreateSessionData, SessionInfo, JoinSessionData };
