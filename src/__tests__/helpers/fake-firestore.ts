/**
 * Firestore مزيّف في الذاكرة — يغطي فقط الـAPI الذي تستخدمه طبقة الخادم:
 * collection/doc (متداخلة)، get/set(merge)/create/delete، where/orderBy/limit،
 * getAll(fieldMask)، batch()، runTransaction().
 * يكفي لاختبار دلالات المزامنة (last-write-wins، الترقيم، فرادة الرمز) بلا محاكي Java.
 */

type Data = Record<string, unknown>;

export class FakeFirestore {
  store = new Map<string, Data>();
  /** لمحاكاة تعارض الـtransactions إن لزم لاحقًا */
  commits = 0;

  collection(path: string): FakeCollection {
    return new FakeCollection(this, path);
  }

  doc(path: string): FakeDocRef {
    return new FakeDocRef(this, path);
  }

  batch(): FakeBatch {
    return new FakeBatch(this);
  }

  async getAll(...args: unknown[]): Promise<FakeDocSnap[]> {
    const refs = args.filter((a): a is FakeDocRef => a instanceof FakeDocRef);
    const mask = args.find((a) => a && typeof a === "object" && "fieldMask" in (a as object)) as
      | { fieldMask?: string[] }
      | undefined;
    return refs.map((r) => {
      const snap = r.snap();
      if (!snap.exists || !mask?.fieldMask) return snap;
      const picked: Data = {};
      for (const f of mask.fieldMask) if (f in (snap.raw as Data)) picked[f] = (snap.raw as Data)[f];
      return new FakeDocSnap(r.id, picked, true);
    });
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction(this);
    const out = await fn(tx);
    tx.flush();
    return out;
  }

  settings(): void {}

  /** أدوات اختبار */
  dump(prefix = ""): [string, Data][] {
    return [...this.store.entries()].filter(([k]) => k.startsWith(prefix));
  }
}

class FakeDocSnap {
  constructor(readonly id: string, readonly raw: Data | undefined, readonly exists: boolean, readonly ref?: FakeDocRef) {}
  data(): Data | undefined {
    return this.raw ? structuredClone(this.raw) : undefined;
  }
}

class FakeDocRef {
  constructor(private db: FakeFirestore, readonly path: string) {}
  get id(): string {
    return this.path.split("/").pop() as string;
  }
  collection(name: string): FakeCollection {
    return new FakeCollection(this.db, `${this.path}/${name}`);
  }
  snap(): FakeDocSnap {
    const raw = this.db.store.get(this.path);
    return new FakeDocSnap(this.id, raw, raw !== undefined, this);
  }
  async get(): Promise<FakeDocSnap> {
    return this.snap();
  }
  async set(data: Data, opts?: { merge?: boolean }): Promise<void> {
    const prev = opts?.merge ? this.db.store.get(this.path) ?? {} : {};
    this.db.store.set(this.path, { ...prev, ...structuredClone(data) });
  }
  async create(data: Data): Promise<void> {
    if (this.db.store.has(this.path)) {
      const err = new Error("ALREADY_EXISTS") as Error & { code: number };
      err.code = 6;
      throw err;
    }
    this.db.store.set(this.path, structuredClone(data));
  }
  async delete(): Promise<void> {
    this.db.store.delete(this.path);
  }
}

interface Filter {
  field: string;
  op: string;
  value: unknown;
}

class FakeCollection {
  private filters: Filter[] = [];
  private order: { field: string; dir: "asc" | "desc" } | null = null;
  private max: number | null = null;
  constructor(private db: FakeFirestore, readonly path: string) {}

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.db, `${this.path}/${id}`);
  }
  where(field: string, op: string, value: unknown): FakeCollection {
    const next = this.clone();
    next.filters = [...this.filters, { field, op, value }];
    return next;
  }
  orderBy(field: string, dir: "asc" | "desc" = "asc"): FakeCollection {
    const next = this.clone();
    next.order = { field, dir };
    return next;
  }
  limit(n: number): FakeCollection {
    const next = this.clone();
    next.max = n;
    return next;
  }
  private clone(): FakeCollection {
    const c = new FakeCollection(this.db, this.path);
    c.filters = [...this.filters];
    c.order = this.order;
    c.max = this.max;
    return c;
  }
  async get(): Promise<{ docs: FakeDocSnap[]; size: number; empty: boolean }> {
    const prefix = `${this.path}/`;
    let rows = [...this.db.store.entries()]
      .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
      .map(([k, v]) => new FakeDocSnap(k.slice(prefix.length), v, true, new FakeDocRef(this.db, k)));

    for (const f of this.filters) {
      rows = rows.filter((r) => {
        const v = (r.raw as Data)[f.field] as number | string;
        if (f.op === ">") return (v as number) > (f.value as number);
        if (f.op === ">=") return (v as number) >= (f.value as number);
        if (f.op === "==") return v === f.value;
        if (f.op === "<") return (v as number) < (f.value as number);
        throw new Error(`unsupported op ${f.op}`);
      });
    }
    if (this.order) {
      const { field, dir } = this.order;
      rows.sort((a, b) => {
        const av = (a.raw as Data)[field] as number;
        const bv = (b.raw as Data)[field] as number;
        return dir === "asc" ? av - bv : bv - av;
      });
    }
    if (this.max !== null) rows = rows.slice(0, this.max);
    return { docs: rows, size: rows.length, empty: rows.length === 0 };
  }
}

class FakeBatch {
  private ops: (() => void)[] = [];
  constructor(private db: FakeFirestore) {}
  set(ref: FakeDocRef, data: Data, opts?: { merge?: boolean }): FakeBatch {
    this.ops.push(() => void ref.set(data, opts));
    return this;
  }
  delete(ref: FakeDocRef): FakeBatch {
    this.ops.push(() => void ref.delete());
    return this;
  }
  async commit(): Promise<void> {
    if (this.ops.length > 500) throw new Error("batch too large");
    this.db.commits += 1;
    this.ops.forEach((op) => op());
    this.ops = [];
  }
}

class FakeTransaction {
  private writes: (() => void)[] = [];
  constructor(private db: FakeFirestore) {}
  async get(ref: FakeDocRef): Promise<FakeDocSnap> {
    return ref.snap();
  }
  set(ref: FakeDocRef, data: Data, opts?: { merge?: boolean }): FakeTransaction {
    this.writes.push(() => void ref.set(data, opts));
    return this;
  }
  delete(ref: FakeDocRef): FakeTransaction {
    this.writes.push(() => void ref.delete());
    return this;
  }
  flush(): void {
    this.db.commits += 1;
    this.writes.forEach((w) => w());
    this.writes = [];
  }
}

export type { FakeDocRef, FakeDocSnap };
