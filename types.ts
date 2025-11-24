export interface Manhwa {
  id?: number;
  dexId?: string; // MangaDex ID
  title: string;
  alternativeTitles?: string[];
  coverUrl: string;
  author: string; // Primary author (kept for backward compatibility)
  staff?: string[]; // List of all staff (Author, Artist, etc.)
  rating: number; // 0-10 or 0-5
  status: 'Reading' | 'Completed' | 'Plan to Read' | 'Dropped';
  tags: string[];
  lastReadAt?: Date;
  createdAt: Date;
}

export interface Scene {
  id?: number;
  manhwaId: number;
  chapterNumber: number;
  description: string;
  characters: string[]; // e.g. ["Jin-Woo", "Beru"]
  tags: string[]; // e.g. ["Fight", "Level Up"]
  createdAt: Date;
}

export interface MangaDexResult {
  id: string;
  title: string;
  description: string;
  coverFileName?: string;
  author?: string;
  tags: string[];
}

export interface UserSettings {
  geminiApiKey: string;
}

// Chart Data Types
export interface TagStat {
  name: string;
  value: number;
}