import type { Jot } from '../db';

export interface SyncResult {
  synced: number;
  errors: string[];
  gitError?: string;
}

export interface SyncAdapter {
  id: string;
  name: string;
  push(jots: Jot[]): Promise<SyncResult>;
  pull?(): Promise<Partial<Jot>[]>;
}
