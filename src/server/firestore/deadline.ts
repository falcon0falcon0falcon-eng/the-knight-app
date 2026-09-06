/**
 * مهلة زمنية لكل عملية Firestore.
 * بدونها يعيد gRPC المحاولة لدقائق عند انقطاع الشبكة، فتُعلّق طلبات /api/sync
 * وتستهلك اتصالات الخادم. مع المهلة يعود الخطأ سريعًا والعميل يعيد المحاولة لاحقًا.
 */

export const FIRESTORE_TIMEOUT_MS = Number(process.env.FIRESTORE_TIMEOUT_MS ?? 15000);

export class FirestoreTimeoutError extends Error {
  readonly code = "firestore_timeout";
  constructor(operation: string, ms: number) {
    super(`Firestore ${operation} تجاوز ${ms}ms`);
    this.name = "FirestoreTimeoutError";
  }
}

export function isFirestoreTimeoutError(e: unknown): e is FirestoreTimeoutError {
  return e instanceof FirestoreTimeoutError || (typeof e === "object" && e !== null && (e as { code?: string }).code === "firestore_timeout");
}

export function withDeadline<T>(promise: Promise<T>, operation: string, ms: number = FIRESTORE_TIMEOUT_MS): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new FirestoreTimeoutError(operation, ms)), ms);
      if (typeof timer === "object" && "unref" in timer) timer.unref();
    }),
  ]).finally(() => clearTimeout(timer!)) as Promise<T>;
}
