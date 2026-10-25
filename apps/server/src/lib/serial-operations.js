/** Serializes async lifecycle transitions without leaving a rejected tail. */
export function createSerialExecutor() {
  let tail = Promise.resolve();
  return function serialize(operation) {
    const result = tail.then(operation, operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}
