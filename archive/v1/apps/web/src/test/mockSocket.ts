export class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = 1;

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    MockWebSocket.instances.push(this);
  }

  send(_data: string): void {
    // No-op in tests.
  }

  close(): void {
    this.readyState = 3;
  }

  emit(payload: unknown): void {
    this.onmessage?.(
      {
        data: JSON.stringify(payload)
      } as MessageEvent<string>
    );
  }
}

export function installMockWebSocket(): () => void {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

  return () => {
    globalThis.WebSocket = original;
    MockWebSocket.instances = [];
  };
}
