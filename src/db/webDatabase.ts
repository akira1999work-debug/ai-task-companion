/**
 * Web fallback database using sql.js to emulate expo-sqlite's SQLiteDatabase interface.
 * Data is persisted to localStorage as base64-encoded binary.
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

const STORAGE_KEY = 'aitas_sqljs_db';
const DEBOUNCE_MS = 2000;

// ---------------------------------------------------------------------------
// WebDatabase — wraps sql.js to match expo-sqlite's interface
// ---------------------------------------------------------------------------

export class WebDatabase {
  private db: SqlJsDatabase | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    var SQL = await initSqlJs({
      locateFile: function (file: string) {
        return 'https://sql.js.org/dist/' + file;
      },
    });

    // Try to restore from localStorage
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        var binary = Uint8Array.from(atob(saved), function (c) { return c.charCodeAt(0); });
        this.db = new SQL.Database(binary);
      } catch {
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    // Save on page unload
    var self = this;
    window.addEventListener('beforeunload', function () {
      self.flushSync();
    });
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    var self = this;
    this.saveTimer = setTimeout(function () {
      self.flushSync();
    }, DEBOUNCE_MS);
  }

  private flushSync(): void {
    if (!this.db) return;
    try {
      var data = this.db.export();
      var binary = new Uint8Array(data);
      var chars: string[] = [];
      for (var i = 0; i < binary.length; i++) {
        chars.push(String.fromCharCode(binary[i]));
      }
      localStorage.setItem(STORAGE_KEY, btoa(chars.join('')));
    } catch (e) {
      console.error('Failed to save database to localStorage:', e);
    }
  }

  private ensureDb(): SqlJsDatabase {
    if (!this.db) throw new Error('WebDatabase not initialized');
    return this.db;
  }

  async getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]> {
    var db = this.ensureDb();
    var stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    var results: T[] = [];
    while (stmt.step()) {
      var row = stmt.getAsObject() as T;
      results.push(row);
    }
    stmt.free();
    return results;
  }

  async getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> {
    var results = await this.getAllAsync<T>(sql, ...params);
    return results.length > 0 ? results[0] : null;
  }

  async runAsync(sql: string, ...params: any[]): Promise<{ changes: number }> {
    var db = this.ensureDb();
    db.run(sql, params);
    this.scheduleSave();
    return { changes: db.getRowsModified() };
  }

  async execAsync(sql: string): Promise<void> {
    var db = this.ensureDb();
    db.exec(sql);
    this.scheduleSave();
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    var db = this.ensureDb();
    db.exec('BEGIN TRANSACTION');
    try {
      await fn();
      db.exec('COMMIT');
      this.scheduleSave();
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}
