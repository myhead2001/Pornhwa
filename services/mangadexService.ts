import { MangaDexResult } from '../types';

const BASE_URL = 'https://api.mangadex.org';
const COVER_URL = 'https://uploads.mangadex.org/covers';

export const searchMangaDex = async (query: string): Promise<MangaDexResult[]> => {
  if (!query) return [];

  const params = new URLSearchParams();
  params.append('title', query);
  params.append('limit', '10');
  params.append('includes[]', 'cover_art');
  params.append('includes[]', 'author');
  params.append('order[relevance]', 'desc');
  
  // Content rating filters: Include all ratings to ensure mature titles are found
  params.append('contentRating[]', 'safe');
  params.append('contentRating[]', 'suggestive');
  params.append('contentRating[]', 'erotica');
  params.append('contentRating[]', 'pornographic');

  const targetUrl = `${BASE_URL}/manga?${params.toString()}`;
  
  let response: Response | null = null;

  // Helper function to attempt a fetch and return null if it fails or returns non-ok status
  const attemptFetch = async (url: string): Promise<Response | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Fetch failed for ${url} with status: ${res.status}`);
        return null;
      }
      return res;
    } catch (error) {
      console.warn(`Network error for ${url}:`, error);
      return null;
    }
  };

  try {
    console.log(`Searching MangaDex for: ${query}`);

    // Strategy: Direct -> CodeTabs -> AllOrigins -> CorsProxy -> ThingProxy
    // We try multiple proxies because public CORS proxies can be flaky or rate-limited.

    // 1. Direct Request (Best if it works, often 403)
    response = await attemptFetch(targetUrl);

    // 2. CodeTabs (Very reliable for JSON)
    if (!response) {
      console.log("Attempting fallback: CodeTabs...");
      const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
      response = await attemptFetch(proxyUrl);
    }

    // 3. AllOrigins (Good backup)
    if (!response) {
      console.log("Attempting fallback: AllOrigins...");
      // Add timestamp to prevent caching old error responses
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}&t=${Date.now()}`;
      response = await attemptFetch(proxyUrl);
    }

    // 4. CorsProxy.io
    if (!response) {
      console.log("Attempting fallback: CorsProxy.io...");
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      response = await attemptFetch(proxyUrl);
    }

    // 5. ThingProxy
    if (!response) {
       console.log("Attempting fallback: ThingProxy...");
       const proxyUrl = `https://thingproxy.freeboard.io/fetch/${targetUrl}`;
       response = await attemptFetch(proxyUrl);
    }

    if (!response) {
      throw new Error("All fetch attempts failed (Direct, CodeTabs, AllOrigins, CorsProxy, ThingProxy).");
    }

    const data = await response.json();

    // Check for MangaDex specific error structure
    if (data.result !== 'ok' && !Array.isArray(data.data)) {
        console.warn("MangaDex API returned non-ok result body:", data);
        return [];
    }

    const results = data.data || [];

    return results.map((item: any) => {
      const attributes = item.attributes;
      const titleObj = attributes.title || {};
      // Title fallback logic: en -> any first key -> default
      const title = titleObj.en || Object.values(titleObj)[0] || 'Unknown Title';
      
      // Extract Cover
      const coverRel = item.relationships.find((r: any) => r.type === 'cover_art');
      const coverFileName = coverRel?.attributes?.fileName;

      // Extract Author
      const authorRel = item.relationships.find((r: any) => r.type === 'author');
      const author = authorRel?.attributes?.name || 'Unknown Author';

      // Extract Tags
      const tags = (attributes.tags || [])
        .filter((t: any) => t.attributes.group === 'genre' || t.attributes.group === 'theme')
        .map((t: any) => t.attributes.name?.en)
        .filter(Boolean);

      return {
        id: item.id,
        title: String(title),
        description: attributes.description?.en || '',
        coverFileName,
        author,
        tags
      };
    });
  } catch (error) {
    console.error("MangaDex API Error:", error);
    // Return empty array to prevent UI crash
    return [];
  }
};

export const getCoverUrl = (mangaId: string, fileName?: string) => {
  if (!fileName) return 'https://picsum.photos/300/450'; // Fallback
  // Note: Covers are hotlinkable, but sometimes require a proxy if checking existence. 
  // Standard img src usually works fine.
  return `${COVER_URL}/${mangaId}/${fileName}.256.jpg`; // Using 256px optimization
};