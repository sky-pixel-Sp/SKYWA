/** Single-handle reconnect timer with explicit cancellation and stale-callback protection. */
export function createReconnectScheduler({setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout} = {}) {
  let handle = null;
  let generation = 0;

  function cancel() {
    generation++;
    if (handle !== null) clearTimeoutFn(handle);
    handle = null;
  }

  function schedule(callback, delayMs) {
    cancel();
    const expectedGeneration = generation;
    handle = setTimeoutFn(() => {
      if (expectedGeneration !== generation) return;
      handle = null;
      void callback();
    }, delayMs);
    return handle;
  }

  return {schedule, cancel, hasPending: () => handle !== null};
}
