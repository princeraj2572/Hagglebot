import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Message, Thread, ThreadStatus, WalkReason, Want } from "../lib/negotiation/types";

export interface SellerContact {
  id: string;
  wantId: string;
  name: string;
  /** Persona id for simulated sellers (ferdi, fatima, chen, sam). */
  persona: string;
  /** Mock chat endpoint, e.g. "mock://ferdi". */
  endpoint: string;
}

export type DealStatus = "awaiting_payment" | "order_created" | "paid" | "refunded" | "cancelled";

export interface Deal {
  id: string;
  threadId: string;
  wantId: string;
  sellerName: string;
  price: number;
  status: DealStatus;
  paypalOrderId: string | null;
  payerId: string | null;
  payerEmail: string | null;
  captureId: string | null;
}

export type WantStatus = "open" | "purchased";
export type WantRecord = Want & { status: WantStatus; createdAt: number };

type Row = Record<string, unknown>;
const id = (): string => randomUUID().replace(/-/g, "").slice(0, 12);

export class Repo {
  constructor(
    private readonly db: Database.Database,
    private readonly now: () => number = Date.now,
  ) {}

  // ---- wants ----
  createWant(w: Omit<Want, "id">): WantRecord {
    const rec = { ...w, id: id() };
    this.db
      .prepare("INSERT INTO wants (id,item,max_price,notes,buyer_name,status,created_at) VALUES (?,?,?,?,?, 'open', ?)")
      .run(rec.id, rec.item, rec.maxPrice, rec.notes, rec.buyerName, this.now());
    return this.getWant(rec.id)!;
  }

  private wantFrom(r: Row): WantRecord {
    return {
      id: r.id as string, item: r.item as string, maxPrice: r.max_price as number, notes: r.notes as string,
      buyerName: r.buyer_name as string, status: r.status as WantStatus, createdAt: r.created_at as number,
    };
  }
  getWant(wantId: string): WantRecord | undefined {
    const r = this.db.prepare("SELECT * FROM wants WHERE id = ?").get(wantId) as Row | undefined;
    return r && this.wantFrom(r);
  }
  listWants(): WantRecord[] {
    return (this.db.prepare("SELECT * FROM wants ORDER BY created_at, rowid").all() as Row[]).map((r) => this.wantFrom(r));
  }
  setWantStatus(wantId: string, status: WantStatus): void {
    this.db.prepare("UPDATE wants SET status = ? WHERE id = ?").run(status, wantId);
  }
  deleteWant(wantId: string): boolean {
    return this.db.prepare("DELETE FROM wants WHERE id = ?").run(wantId).changes > 0;
  }

  // ---- sellers ----
  addSeller(s: Omit<SellerContact, "id">): SellerContact {
    const rec = { ...s, id: id() };
    this.db
      .prepare("INSERT INTO sellers (id,want_id,name,persona,endpoint,created_at) VALUES (?,?,?,?,?,?)")
      .run(rec.id, rec.wantId, rec.name, rec.persona, rec.endpoint, this.now());
    return rec;
  }
  listSellers(wantId: string): SellerContact[] {
    return (this.db.prepare("SELECT * FROM sellers WHERE want_id = ? ORDER BY created_at, rowid").all(wantId) as Row[]).map((r) => ({
      id: r.id as string, wantId: r.want_id as string, name: r.name as string,
      persona: r.persona as string, endpoint: r.endpoint as string,
    }));
  }
  deleteSeller(sellerId: string): boolean {
    return this.db.prepare("DELETE FROM sellers WHERE id = ?").run(sellerId).changes > 0;
  }

  // ---- threads & messages ----
  saveThread(t: Thread): void {
    const ts = this.now();
    this.db
      .prepare(
        `INSERT INTO threads (id,want_id,seller_id,seller_name,status,last_offer,last_ask,refusals,reason,detail,deal_price,created_at,updated_at)
         VALUES (@id,@wantId,@sellerId,@sellerName,@status,@lastOffer,@lastAsk,@refusals,@reason,@detail,@dealPrice,@ts,@ts)
         ON CONFLICT(id) DO UPDATE SET status=@status,last_offer=@lastOffer,last_ask=@lastAsk,refusals=@refusals,
           reason=@reason,detail=@detail,deal_price=@dealPrice,updated_at=@ts`,
      )
      .run({ ...t, ts, messages: undefined });
  }

  addMessage(threadId: string, m: Message): void {
    this.db
      .prepare("INSERT INTO messages (thread_id,sender,text,price,at,guard) VALUES (?,?,?,?,?,?)")
      .run(threadId, m.from, m.text, m.price, m.at, m.guard ?? null);
  }

  private messagesOf(threadId: string): Message[] {
    return (this.db.prepare("SELECT * FROM messages WHERE thread_id = ? ORDER BY id").all(threadId) as Row[]).map((r) => ({
      from: r.sender as Message["from"], text: r.text as string, at: r.at as number, price: r.price as number | null,
      ...(r.guard ? { guard: r.guard as string } : {}),
    }));
  }

  private threadFrom(r: Row): Thread {
    return {
      id: r.id as string, wantId: r.want_id as string, sellerId: r.seller_id as string, sellerName: r.seller_name as string,
      status: r.status as ThreadStatus, messages: this.messagesOf(r.id as string),
      lastOffer: r.last_offer as number | null, lastAsk: r.last_ask as number | null, refusals: r.refusals as number,
      reason: r.reason as WalkReason | null, detail: r.detail as string | null, dealPrice: r.deal_price as number | null,
    };
  }
  getThread(threadId: string): Thread | undefined {
    const r = this.db.prepare("SELECT * FROM threads WHERE id = ?").get(threadId) as Row | undefined;
    return r && this.threadFrom(r);
  }
  listThreads(wantId?: string): Thread[] {
    const rows = (wantId
      ? this.db.prepare("SELECT * FROM threads WHERE want_id = ? ORDER BY created_at, rowid").all(wantId)
      : this.db.prepare("SELECT * FROM threads ORDER BY created_at, rowid").all()) as Row[];
    return rows.map((r) => this.threadFrom(r));
  }
  deleteThreadsOfWant(wantId: string): void {
    this.db.prepare("DELETE FROM threads WHERE want_id = ?").run(wantId);
  }

  // ---- deals ----
  private dealFrom(r: Row): Deal {
    return {
      id: r.id as string, threadId: r.thread_id as string, wantId: r.want_id as string, sellerName: r.seller_name as string,
      price: r.price as number, status: r.status as DealStatus, paypalOrderId: r.paypal_order_id as string | null,
      payerId: r.payer_id as string | null, payerEmail: r.payer_email as string | null, captureId: r.capture_id as string | null,
    };
  }
  /** Idempotent: one deal per thread. */
  createDeal(t: Thread): Deal {
    const existing = this.db.prepare("SELECT * FROM deals WHERE thread_id = ?").get(t.id) as Row | undefined;
    if (existing) return this.dealFrom(existing);
    if (t.dealPrice === null) throw new Error("Thread has no deal price");
    const ts = this.now();
    const deal = id();
    this.db
      .prepare("INSERT INTO deals (id,thread_id,want_id,seller_name,price,status,created_at,updated_at) VALUES (?,?,?,?,?,'awaiting_payment',?,?)")
      .run(deal, t.id, t.wantId, t.sellerName, t.dealPrice, ts, ts);
    return this.getDeal(deal)!;
  }
  getDeal(dealId: string): Deal | undefined {
    const r = this.db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId) as Row | undefined;
    return r && this.dealFrom(r);
  }
  getDealByOrder(orderId: string): Deal | undefined {
    const r = this.db.prepare("SELECT * FROM deals WHERE paypal_order_id = ?").get(orderId) as Row | undefined;
    return r && this.dealFrom(r);
  }
  listDeals(wantId?: string): Deal[] {
    const rows = (wantId
      ? this.db.prepare("SELECT * FROM deals WHERE want_id = ? ORDER BY created_at, rowid").all(wantId)
      : this.db.prepare("SELECT * FROM deals ORDER BY created_at, rowid").all()) as Row[];
    return rows.map((r) => this.dealFrom(r));
  }
  updateDeal(dealId: string, patch: Partial<Pick<Deal, "status" | "paypalOrderId" | "payerId" | "payerEmail" | "captureId">>): void {
    const cur = this.getDeal(dealId);
    if (!cur) throw new Error(`Unknown deal ${dealId}`);
    const n = { ...cur, ...patch };
    this.db
      .prepare("UPDATE deals SET status=?, paypal_order_id=?, payer_id=?, payer_email=?, capture_id=?, updated_at=? WHERE id=?")
      .run(n.status, n.paypalOrderId, n.payerId, n.payerEmail, n.captureId, this.now(), dealId);
  }
}
