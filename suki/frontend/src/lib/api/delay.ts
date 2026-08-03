// The single artificial delay for local reads. Deleted in one edit when a real backend arrives.
export function delay<T>(value: T, ms = 40): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}
