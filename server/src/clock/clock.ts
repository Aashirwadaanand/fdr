import { DatabaseSync } from 'node:sqlite';

/**
 * Clock abstraction to allow system-wide deterministic time travel.
 * All backend operations MUST consult this Clock rather than new Date() for business logic.
 */
export class Clock {
  private static instance: Clock;
  private db: DatabaseSync | null = null;
  private offsetDays: number = 0;
  private fixedDate: string | null = null;

  private constructor() {}

  public static getInstance(): Clock {
    if (!Clock.instance) {
      Clock.instance = new Clock();
    }
    return Clock.instance;
  }

  public setDatabase(db: DatabaseSync) {
    this.db = db;
    this.loadState();
  }

  public loadState() {
    if (!this.db) return;
    try {
      const row = this.db.prepare('SELECT current_date, offset_days FROM demo_clock WHERE id = 1').get() as { current_date: string; offset_days: number } | undefined;
      if (row) {
        this.fixedDate = row.current_date;
        this.offsetDays = row.offset_days || 0;
      }
    } catch {
      // Table might not exist yet during initial boot/migration
    }
  }

  public now(): Date {
    if (this.fixedDate) {
      const d = new Date(this.fixedDate + 'T12:00:00.000Z');
      return d;
    }
    const d = new Date();
    if (this.offsetDays !== 0) {
      d.setDate(d.getDate() + this.offsetDays);
    }
    return d;
  }

  public today(): string {
    const d = this.now();
    return d.toISOString().split('T')[0];
  }

  public advanceDays(days: number): string {
    const current = this.now();
    current.setDate(current.getDate() + days);
    const newDateStr = current.toISOString().split('T')[0];
    this.fixedDate = newDateStr;
    this.offsetDays += days;
    this.persistState();
    return newDateStr;
  }

  public setDate(dateStr: string): string {
    this.fixedDate = dateStr;
    this.offsetDays = 0;
    this.persistState();
    return dateStr;
  }

  public reset(): string {
    this.offsetDays = 0;
    // Default baseline date for the AICTE portal demonstration
    this.fixedDate = '2026-10-27';
    this.persistState();
    return this.fixedDate;
  }

  public getStatus() {
    return {
      currentDate: this.today(),
      isAdvanced: this.offsetDays !== 0 || this.fixedDate !== '2026-10-27',
      offsetDays: this.offsetDays,
    };
  }

  private persistState() {
    if (!this.db) return;
    try {
      this.db.prepare(`
        INSERT INTO demo_clock (id, current_date, offset_days, is_advanced, updated_at)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          current_date = excluded.current_date,
          offset_days = excluded.offset_days,
          is_advanced = excluded.is_advanced,
          updated_at = excluded.updated_at
      `).run(
        this.today(),
        this.offsetDays,
        this.offsetDays !== 0 ? 1 : 0,
        new Date().toISOString()
      );
    } catch (err) {
      console.error('Failed to persist demo clock state', err);
    }
  }
}

export const clock = Clock.getInstance();
