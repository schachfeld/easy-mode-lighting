// Small event source shared by Node and the native WebSocket adapter.
export class Events {
  listeners = new Map();
  on(name, callback) {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(callback);
    this.listeners.set(name, listeners);
    return this;
  }
  off(name, callback) {
    this.listeners.get(name)?.delete(callback);
    return this;
  }
  once(name, callback) {
    const once = (...args) => {
      this.off(name, once);
      callback(...args);
    };
    return this.on(name, once);
  }
  removeListener(name, callback) {
    return this.off(name, callback);
  }
  emit(name, ...args) {
    for (const callback of [...(this.listeners.get(name) ?? [])])
      callback(...args);
  }
}
