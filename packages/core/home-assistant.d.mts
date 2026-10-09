export interface Socket {
  readyState: number;
  on(name: string, callback: (...args: any[]) => void): unknown;
  send(data: string): void | Promise<void>;
  close(): void;
  terminate(): void;
}
export class HomeAssistant {
  constructor(options: {
    url: string;
    token: string;
    retryMs?: number;
    timeoutMs?: number;
    createSocket: (url: string) => Socket;
  });
  connected: boolean;
  stopped: boolean;
  error: string | null;
  on(name: string, callback: () => void): this;
  off(name: string, callback: () => void): this;
  start(): void;
  stop(): void;
  reconnect(): void;
  call(
    domain: string,
    service: string,
    data?: object,
    target?: object,
  ): Promise<unknown>;
}
