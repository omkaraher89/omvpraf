// Worker build replacement for the `ws` package.
// Cloudflare Workers cannot open the persistent upstream LSE sockets, so the live feed
// runs through the REST polling fallback instead. This stub only needs to satisfy the
// class shape used by LseClient on paths that are never taken inside a Worker.

export class WebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = WebSocket.CLOSED;

  constructor() {
    throw new Error('WebSocket transport is not available in this runtime.');
  }

  send(): void {}
  close(): void {}
  terminate(): void {}
}
