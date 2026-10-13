export interface PeerOptions { timeoutMs?: number; onText?: (delta: string) => void }
export class GrokAcpPeer {
  constructor(socket: WebSocket, options?: PeerOptions);
  readonly socket: WebSocket;
  timeoutMs: number;
  onText: (delta: string) => void;
  nextId: number;
  pending: Map<number, unknown>;
  closed: boolean;
  request(method: string, params: unknown): Promise<any>;
  receive(raw: unknown): void;
  abort(error?: Error): void;
}
export function extractAgentText(update: unknown): string;
