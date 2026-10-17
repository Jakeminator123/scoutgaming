export interface LinkedScene { connected: boolean; active: boolean; visible: boolean; dealerId: string; roundVersion: number | null; boundary: string; actionBusy: boolean; idleReady: boolean }
export interface LinkedMessage { role: 'user' | 'assistant'; text: string; requestId: string }
export interface LinkedStatus { state: string; detail?: string; pending: boolean }
export interface LinkedDecision { requestId: string; kind: 'generatedText' | 'recordedLine' | 'silence'; dealerId: string; exactText?: string; speechPackage?: unknown }
export interface LinkedChatSession { accept(event: MessageEvent): Promise<boolean>; submit(text: string): boolean; updateScene(next: Partial<LinkedScene>): void; cancel(): void; close(): void }
export function createNativeLabChat(options: {
  binding: { source: Window; origin: string; channel: string };
  initialScene: LinkedScene;
  playGenerated: (decision: LinkedDecision, options: { media: { audio: ArrayBuffer; video: ArrayBuffer }; signal: AbortSignal; onReceipt: (entry: Record<string, unknown>) => void }) => Promise<void>;
  onMessage?: (message: LinkedMessage) => void;
  onStatus?: (status: LinkedStatus) => void;
  onReceipt?: (receipt: Record<string, unknown>) => void;
  onSettled?: () => void;
}): LinkedChatSession;
