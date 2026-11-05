import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "./db";
import { Repo } from "./repo";
import { seedDemo } from "./testkit";

describe("messages.guard", () => {
  it("is added to a database created before guardrail notes existed, and old rows still read", () => {
    const dir = mkdtempSync(join(tmpdir(), "hagglebot-db-"));
    const file = join(dir, "old.db");
    try {
      const old = new Database(file);
      old.exec(`
        CREATE TABLE wants (id TEXT PRIMARY KEY, item TEXT NOT NULL, max_price INTEGER NOT NULL, notes TEXT NOT NULL DEFAULT '', buyer_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL);
        CREATE TABLE threads (id TEXT PRIMARY KEY);
        CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id TEXT NOT NULL, sender TEXT NOT NULL, text TEXT NOT NULL, price INTEGER, at INTEGER NOT NULL);
        INSERT INTO messages (thread_id, sender, text, price, at) VALUES ('t', 'buyer', 'old message', 100, 1);
        INSERT INTO wants (id, item, max_price, notes, buyer_name, status, created_at) VALUES ('w1', 'Old want', 100, '', 'Alex', 'open', 1);
      `);
      old.close();

      const db = openDb(file);
      const cols = (db.prepare("PRAGMA table_info(messages)").all() as { name: string }[]).map((c) => c.name);
      expect(cols).toContain("guard");
      const wantCols = (db.prepare("PRAGMA table_info(wants)").all() as { name: string }[]).map((c) => c.name);
      expect(wantCols).toContain("style");
      expect(new Repo(db).listWants()[0]!.style).toBe("balanced"); // an older want keeps the original behaviour
      expect((db.prepare("SELECT text, guard FROM messages").get() as { text: string; guard: string | null })).toEqual({ text: "old message", guard: null });
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores a chosen negotiation style and defaults to balanced", () => {
    const repo = new Repo(openDb(":memory:"));
    const base = { item: "Thing", maxPrice: 100, notes: "", buyerName: "Alex" };
    expect(repo.createWant({ ...base, style: "quick" }).style).toBe("quick");
    expect(repo.createWant(base).style).toBe("balanced");
  });

  it("round-trips a note through the repository and leaves it off messages that have none", () => {
    const repo = new Repo(openDb(":memory:"));
    const want = seedDemo(repo);
    const seller = repo.listSellers(want.id)[0]!;
    const thread = {
      id: `${want.id}:${seller.id}`, wantId: want.id, sellerId: seller.id, sellerName: seller.name, status: "negotiating" as const,
      messages: [], lastOffer: null, lastAsk: null, refusals: 0, reason: null, detail: null, dealPrice: null,
    };
    repo.saveThread(thread);
    repo.addMessage(thread.id, { from: "buyer", text: "hello", at: 1, price: null, guard: "Introduced itself as an AI agent." });
    repo.addMessage(thread.id, { from: "seller", text: "hi", at: 2, price: 300 });
    const [first, second] = repo.getThread(thread.id)!.messages;
    expect(first!.guard).toBe("Introduced itself as an AI agent.");
    expect("guard" in second!).toBe(false);
  });
});
