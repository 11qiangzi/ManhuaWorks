declare module 'on-finished' {
  import { IncomingMessage, ServerResponse } from 'node:http';
  type Callback = (err: Error | null) => void;
  type Opts = { req?: true; res?: true };

  interface OnFinished {
    (msg: IncomingMessage, callback: Callback): () => void;
    (msg: IncomingMessage, opts: Opts, callback: Callback): () => void;
    (msg: ServerResponse, callback: Callback): () => void;
    (msg: ServerResponse, opts: Opts, callback: Callback): () => void;
    isFinished(msg: IncomingMessage | ServerResponse): boolean;
  }

  const onFinished: OnFinished;
  export = onFinished;
}
