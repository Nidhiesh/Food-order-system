import { Response } from 'express';

interface SseClient {
  id: string;
  res: Response;
}

class SseManager {
  private clients: Map<string, SseClient> = new Map();
  private clientIdCounter = 0;

  /**
   * Register a new SSE client response stream.
   * Returns the assigned client id so the caller can remove it on disconnect.
   */
  addClient(res: Response): string {
    const id = `sse-${++this.clientIdCounter}-${Date.now()}`;
    this.clients.set(id, { id, res });
    console.log(`[SSE] Client connected: ${id} (total: ${this.clients.size})`);
    return id;
  }

  /**
   * Remove a client (e.g. on connection close).
   */
  removeClient(id: string): void {
    this.clients.delete(id);
    console.log(`[SSE] Client disconnected: ${id} (total: ${this.clients.size})`);
  }

  /**
   * Broadcast a named SSE event with a JSON payload to ALL connected clients.
   */
  broadcast(event: string, data: object = {}): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let dead: string[] = [];

    this.clients.forEach((client) => {
      try {
        client.res.write(message);
      } catch {
        // Client already gone — mark for removal
        dead.push(client.id);
      }
    });

    // Clean up dead connections
    dead.forEach((id) => this.removeClient(id));
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

// Singleton — import and use this everywhere
export const sseManager = new SseManager();
