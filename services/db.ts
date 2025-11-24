import Dexie, { Table } from 'dexie';
import { Manhwa, Scene } from '../types';

// Key for storing the directory handle
const HANDLE_KEY = 'manhwaLog_dirHandle';

class ManhwaDatabase extends Dexie {
  manhwas!: Table<Manhwa>;
  scenes!: Table<Scene>;
  config!: Table<{ key: string; value: any }>;

  private directoryHandle: FileSystemDirectoryHandle | null = null;

  constructor() {
    super('ManhwaLogDB');
    
    (this as any).version(1).stores({
      manhwas: '++id, dexId, title, status, *tags, lastReadAt',
      scenes: '++id, manhwaId, chapterNumber, *characters, *tags'
    });
    
    (this as any).version(2).stores({
      manhwas: '++id, dexId, title, author, status, *tags, lastReadAt'
    });
    
    (this as any).version(3).stores({
      manhwas: '++id, dexId, title, author, status, *tags, *staff, lastReadAt'
    }).upgrade((trans: any) => {
        return trans.table('manhwas').toCollection().modify((manhwa: Manhwa) => {
            if (!manhwa.staff && manhwa.author) manhwa.staff = [manhwa.author];
            if (!manhwa.alternativeTitles) manhwa.alternativeTitles = [];
        });
    });

    (this as any).version(4).stores({
      manhwas: '++id, dexId, title, author, status, *tags, *staff, lastReadAt',
      scenes: '++id, manhwaId, chapterNumber, *characters, *tags',
      config: 'key' 
    });

    // --- Hooks for Auto-CRUD on File System ---
    
    this.manhwas.hook('updating', (mods, primKey, obj, trans) => {
      trans.on('complete', () => {
         if (primKey) this.saveManhwaToDisk(Number(primKey));
      });
    });

    this.manhwas.hook('deleting', (primKey, obj, trans) => {
      trans.on('complete', () => {
         if (primKey) this.deleteManhwaFromDisk(Number(primKey));
      });
    });

    // Scene Changes - trigger update of parent Manhwa file
    this.scenes.hook('creating', (primKey, obj, trans) => {
      trans.on('complete', () => {
        this.saveManhwaToDisk(obj.manhwaId);
      });
    });
    
    this.scenes.hook('updating', (mods, primKey, obj, trans) => {
      trans.on('complete', () => {
        this.saveManhwaToDisk(obj.manhwaId);
      });
    });

    this.scenes.hook('deleting', (primKey, obj, trans) => {
       trans.on('complete', () => {
         this.saveManhwaToDisk(obj.manhwaId);
       });
    });
  }

  // We override the add method to ensure we capture the ID immediately for new items
  async addManhwa(data: Manhwa): Promise<number> {
      const id = await this.manhwas.add(data);
      await this.saveManhwaToDisk(Number(id));
      return Number(id);
  }

  async deleteManhwa(id: number) {
      console.log("Attempting to delete manhwa:", id);
      // Deleting from DB will trigger the hook which attempts to delete from disk.
      // However, we perform the DB operations in a transaction to ensure consistency.
      await this.transaction('rw', this.manhwas, this.scenes, async () => {
          await this.scenes.where('manhwaId').equals(id).delete();
          await this.manhwas.delete(id);
      });
      console.log("Manhwa deleted from DB");
  }

  async clearAllData() {
    console.log("Starting clearAllData...");
    // 1. Clear Disk files explicitly (Hooks don't fire on clear())
    if (this.directoryHandle) {
        try {
           // Ensure permission before attempting
           await this.requestPermission();
           
           const libHandle = await this.getLibraryHandle();
           if (libHandle) {
               const filesToDelete: string[] = [];
               
               // Collect files first to avoid iterator invalidation
               // @ts-ignore
               for await (const entry of (libHandle as any).values()) {
                   if (entry.kind === 'file') {
                       filesToDelete.push(entry.name);
                   }
               }

               console.log(`Found ${filesToDelete.length} files to delete`);

               // Delete files
               for (const filename of filesToDelete) {
                   try {
                       await libHandle.removeEntry(filename);
                   } catch (e: any) {
                       if (e.name !== 'NotFoundError') console.warn(`Failed to delete ${filename}`, e);
                   }
               }
               console.log(`Cleared ${filesToDelete.length} files from disk.`);
           }
        } catch(e) { console.error("Error clearing disk files", e); }
    }

    // 2. Clear DB
    await this.transaction('rw', this.manhwas, this.scenes, async () => {
        await this.manhwas.clear();
        await this.scenes.clear();
    });
    console.log("IndexedDB cleared.");
  }

  // --- Mobile / Manual Backup Support ---

  async exportDatabaseToJson(): Promise<string> {
    const manhwas = await this.manhwas.toArray();
    const scenes = await this.scenes.toArray();
    const config = await this.config.toArray();
    
    // Filter out the file handle from config as it can't be serialized
    const safeConfig = config.filter(c => c.key !== HANDLE_KEY);

    const data = {
      meta: { version: 1, exportedAt: new Date().toISOString() },
      manhwas,
      scenes,
      config: safeConfig
    };
    return JSON.stringify(data, null, 2);
  }

  async importDatabaseFromJson(jsonStr: string) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.manhwas || !data.scenes) throw new Error("Invalid backup format");
      
      await this.transaction('rw', this.manhwas, this.scenes, this.config, async () => {
        await this.manhwas.clear();
        await this.scenes.clear();
        
        // Sanitize Dates for Manhwas
        const sanitizedManhwas = data.manhwas.map((m: any) => ({
            ...m,
            createdAt: new Date(m.createdAt),
            lastReadAt: m.lastReadAt ? new Date(m.lastReadAt) : undefined
        }));

        // Sanitize Dates for Scenes
        const sanitizedScenes = data.scenes.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt)
        }));

        await this.manhwas.bulkAdd(sanitizedManhwas);
        await this.scenes.bulkAdd(sanitizedScenes);

        // Import config if present (ignoring file handles)
        if (data.config && Array.isArray(data.config)) {
             for (const c of data.config) {
                 if (c.key !== HANDLE_KEY) {
                     await this.config.put(c);
                 }
             }
        }
      });
      return true;
    } catch (e) {
      console.error("Import failed", e);
      throw e;
    }
  }

  // --- File System Logic ---

  async restoreConnection(): Promise<boolean> {
    try {
      const record = await this.config.get(HANDLE_KEY);
      if (record && record.value) {
        this.directoryHandle = record.value as FileSystemDirectoryHandle;
        try {
            // Check permission query safely
            const perm = await (this.directoryHandle as any).queryPermission({ mode: 'readwrite' });
            if (perm === 'granted') return true;
            // If prompt, we can't auto-request here, user interaction needed later
            return false;
        } catch (e) {
            console.warn("Error querying permission during restore", e);
            return false;
        }
      }
    } catch (e) {
      console.error("Failed to restore handle", e);
    }
    return false;
  }

  async connectToFolder(): Promise<{ success: boolean; message?: string }> {
    try {
      if (!('showDirectoryPicker' in window)) {
         return { success: false, message: "Your browser does not support the File System Access API." };
      }

      // @ts-ignore
      const handle = await window.showDirectoryPicker({
        id: 'manhwalog-data',
        mode: 'readwrite'
      });
      
      this.directoryHandle = handle;
      await this.config.put({ key: HANDLE_KEY, value: handle });
      
      // Initial Load: Import all JSONs from the folder
      await this.syncFromDisk();
      return { success: true };
    } catch (e: any) {
      console.error("Error connecting to folder:", e);
      let msg = "Unknown error occurred.";
      if (e.name === 'AbortError') {
         msg = "User cancelled folder selection.";
      } else if (e.message && e.message.includes('Cross origin sub frames')) {
         msg = "Security Error: You are viewing this app in a preview frame. Please Open in New Tab to enable file system access.";
      } else if (e.message) {
         msg = e.message;
      }
      return { success: false, message: msg };
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!this.directoryHandle) return false;
    try {
        const perm = await (this.directoryHandle as any).requestPermission({ mode: 'readwrite' });
        return perm === 'granted';
    } catch (e) {
        console.error("Permission request failed", e);
        return false;
    }
  }

  hasConnection(): boolean {
    return !!this.directoryHandle;
  }

  // --- core CRUD for Files ---

  private async getLibraryHandle(): Promise<FileSystemDirectoryHandle | null> {
      if (!this.directoryHandle) return null;
      try {
        // Get or create 'library' subdirectory
        return await this.directoryHandle.getDirectoryHandle('library', { create: true });
      } catch (e) {
        console.error("Failed to get library handle", e);
        return null;
      }
  }

  private sanitizeFilename(id: number, title: string): string {
      // Replace invalid chars with hyphen
      const safeTitle = title.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      return `${id}_${safeTitle}.json`;
  }

  /**
   * READ: Scans library folder, reads all JSONs, rebuilds DB
   */
  async syncFromDisk() {
    if (!this.directoryHandle) throw new Error("No folder linked");
    
    const libHandle = await this.getLibraryHandle();
    if (!libHandle) return;

    const allManhwas: Manhwa[] = [];
    const allScenes: Scene[] = [];

    // @ts-ignore - Iterate async iterator
    for await (const entry of (libHandle as any).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
            try {
                const file = await entry.getFile();
                const text = await file.text();
                const data = JSON.parse(text);
                
                // Extract Manhwa
                const { scenes: embeddedScenes, ...manhwaData } = data;
                
                // Restore Dates
                manhwaData.createdAt = new Date(manhwaData.createdAt);
                if (manhwaData.lastReadAt) manhwaData.lastReadAt = new Date(manhwaData.lastReadAt);
                
                allManhwas.push(manhwaData);

                // Extract Scenes
                if (Array.isArray(embeddedScenes)) {
                    embeddedScenes.forEach((s: any) => {
                        s.createdAt = new Date(s.createdAt);
                        // Ensure integrity
                        s.manhwaId = manhwaData.id; 
                        allScenes.push(s);
                    });
                }
            } catch (err) {
                console.warn(`Failed to parse ${entry.name}`, err);
            }
        }
    }

    // Bulk update Dexie
    await this.transaction('rw', this.manhwas, this.scenes, async () => {
        await this.manhwas.clear();
        await this.scenes.clear();
        if (allManhwas.length) await this.manhwas.bulkAdd(allManhwas);
        if (allScenes.length) await this.scenes.bulkAdd(allScenes);
    });
    console.log(`Synced ${allManhwas.length} items from disk.`);
  }

  /**
   * WRITE: Saves a single Manhwa and its scenes to a JSON file
   */
  async saveManhwaToDisk(manhwaId: number) {
      if (!this.directoryHandle) return;

      try {
          const libHandle = await this.getLibraryHandle();
          if (!libHandle) return;

          // Fetch Data
          const manhwa = await this.manhwas.get(manhwaId);
          if (!manhwa) return; // Might have been deleted

          const scenes = await this.scenes.where('manhwaId').equals(manhwaId).toArray();

          // Combine
          const exportData = {
              ...manhwa,
              scenes: scenes
          };

          // Determine Filename
          const filename = this.sanitizeFilename(manhwaId, manhwa.title);
          
          // Cleanup: Find any other files starting with "{id}_" and remove them to prevent duplicates
          // @ts-ignore
          for await (const entry of (libHandle as any).values()) {
             if (entry.kind === 'file' && entry.name.startsWith(`${manhwaId}_`) && entry.name !== filename) {
                 await libHandle.removeEntry(entry.name);
             }
          }

          // Write new file
          const fileHandle = await libHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(exportData, null, 2));
          await writable.close();
          
          console.log(`Saved ${filename} to disk.`);

      } catch (e) {
          console.error(`Failed to save manhwa ${manhwaId}`, e);
      }
  }

  /**
   * DELETE: Removes the corresponding JSON file
   */
  async deleteManhwaFromDisk(manhwaId: number) {
      if (!this.directoryHandle) return;
      
      try {
          const libHandle = await this.getLibraryHandle();
          if (!libHandle) return;

          // Find file starting with ID
          let fileToDelete = null;
          // @ts-ignore
          for await (const entry of (libHandle as any).values()) {
              if (entry.kind === 'file' && entry.name.startsWith(`${manhwaId}_`)) {
                  fileToDelete = entry.name;
                  break;
              }
          }

          if (fileToDelete) {
              await libHandle.removeEntry(fileToDelete);
              console.log(`Deleted ${fileToDelete} from disk.`);
          }
      } catch (e: any) {
          if (e.name === 'NotFoundError') {
              // Ignore if already deleted
          } else {
              console.error("Failed to delete file from disk", e);
          }
      }
  }
}

export const db = new ManhwaDatabase();