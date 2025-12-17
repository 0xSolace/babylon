/**
 * Browser-safe thread-stream stub
 * Replaces Node.js worker_threads dependency
 */

class ThreadStream {
  write = () => true;
  end = () => {};
  flush = () => {};
  flushSync = () => {};
  unref = () => {};
  ref = () => {};
  on = () => this;
  once = () => this;
  off = () => this;
  removeListener = () => this;
}

export default ThreadStream;
export { ThreadStream };
