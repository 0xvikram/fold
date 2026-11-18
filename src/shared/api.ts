import type { Pt, Sheet } from './engine/geometry';

export type Step = { from: Pt; to: Pt };

export type PlayerStats = {
  streak: number;
  best: number;
  last: string | null;
  stars: number; // all-time
  solves: number;
};

export type Played = {
  folds: number;
  par: number;
  match: number;
  hinted: boolean;
  stars: 0 | 1 | 2 | 3;
  progress: number[];
};

export type Crowd = {
  players: number;
  hist: Record<string, number>; // folds -> players
  top: { username: string; folds: number; stars: number }[];
};

export type InitResponse = {
  type: 'init';
  day: string;
  number: number; // Fold #N
  par: number;
  shape: Sheet; // the target, as flat layers
  hint: Step; // the first fold only
  author: string | null; // set when the community made today's puzzle
  username: string | null;
  stats: PlayerStats;
  played: Played | null;
  crowd: Crowd;
  shared: boolean;
};

export type SubmitRequest = { steps: Step[]; hinted: boolean };

export type SubmitResponse = {
  type: 'submit';
  played: Played;
  stats: PlayerStats;
  crowd: Crowd;
  rank: number; // 1-based among today's solvers
};

export type ShareResponse = { type: 'share'; ok: boolean; message: string };

export type ErrorResponse = { status: 'error'; message: string };

export type MadeItem = { id: string; author: string; par: number; votes: number; shape: Sheet; mine: boolean; voted: boolean };
export type QueueResponse = { type: 'queue'; items: MadeItem[]; limit: number; votesToPublish: number };
export type MakeRequest = { steps: Step[] };
export type MakeResponse = { type: 'made'; id: string; message: string };
export type VoteResponse = { type: 'vote'; votes: number };
