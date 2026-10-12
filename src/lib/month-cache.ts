// Private browser memory only. Never share calendar data between users.
export class MonthCache<T> {
  private entries = new Map<string, { value: T; loadedAt: number }>();
  private versions = new Map<string, number>();
  private pending = new Map<string, { version: number; promise: Promise<T | undefined> }>();
  constructor(private ttlMs = 120000, private limit = 6, private now = () => Date.now()) {}
  peek(month: string) { return this.entries.get(month)?.value; }
  invalidate(months?: string[]) {
    for (const key of months ?? new Set([...this.entries.keys(), ...this.pending.keys()])) {
      this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
      const entry = this.entries.get(key);
      if (entry) entry.loadedAt = -Infinity;
    }
  }
  load(month: string, fetcher: (month: string) => Promise<T>): Promise<T | undefined> {
    const entry = this.entries.get(month);
    if (entry && this.now() - entry.loadedAt < this.ttlMs) return Promise.resolve(entry.value);
    const version = this.versions.get(month) ?? 0;
    const pending = this.pending.get(month);
    if (pending?.version === version) return pending.promise;
    const promise = fetcher(month).then((value) => {
      if ((this.versions.get(month) ?? 0) !== version) return undefined;
      this.entries.delete(month);
      this.entries.set(month, { value, loadedAt: this.now() });
      while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
      return value;
    }).finally(() => { if (this.pending.get(month)?.promise === promise) this.pending.delete(month); });
    this.pending.set(month, { version, promise });
    return promise;
  }
}

export function adjacentMonths(month: string) {
  return [-1, 1].map((offset) => {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 7);
  });
}
