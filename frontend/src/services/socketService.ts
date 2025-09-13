import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;
  private isConnecting = false;

  connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket);
        return;
      }

      if (this.isConnecting) {
        // Wait for existing connection attempt
        const checkConnection = () => {
          if (this.socket?.connected) {
            resolve(this.socket);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      this.isConnecting = true;

      try {
        this.socket = io("https://tech-tiaras-api.vercel.app/", {
          transports: ["websocket", "polling"],
          upgrade: true,
          timeout: 20000,
          forceNew: false,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        this.socket.on("connect", () => {
          console.log("✅ Connected to server:", this.socket?.id);
          this.isConnecting = false;
          resolve(this.socket!);
        });

        this.socket.on("disconnect", (reason) => {
          console.log("❌ Disconnected from server:", reason);
          this.isConnecting = false;
        });

        this.socket.on("connect_error", (error) => {
          console.error("❌ Connection error:", error);
          this.isConnecting = false;
          reject(error);
        });

        this.socket.on("reconnect", (attemptNumber) => {
          console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
        });

        this.socket.on("reconnect_error", (error) => {
          console.error("🔄❌ Reconnection failed:", error);
        });
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: Socket not connected`);
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback);
  }

  get connected(): boolean {
    return this.socket?.connected || false;
  }

  get id(): string | undefined {
    return this.socket?.id;
  }
}

// Export both the class and instance for flexibility
export { SocketService };
export const socketService = new SocketService();
export default socketService;
