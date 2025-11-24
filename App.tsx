import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Library, Search, Plus, BookOpen, Settings as SettingsIcon, 
  BarChart2, Save, X, Trash2, Wand2, Filter, ChevronRight, Hash, User,
  Star, Edit2, Users, ArrowUp, ArrowDown, Calendar, Clock, SlidersHorizontal,
  FolderOpen, RefreshCw, HardDrive, CheckCircle, AlertCircle, Palette
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend 
} from 'recharts';

import { db } from './services/db';
import { searchMangaDex, getCoverUrl } from './services/mangadexService';
import { generateSceneDescription, analyzeReadingHabits } from './services/geminiService';
import { Manhwa, Scene, MangaDexResult } from './types';

// --- Theme Definitions ---

const THEMES = [
  {
    id: 'default',
    name: 'Slate & Blue',
    colors: {
      '--bg-900': '15 23 42',
      '--bg-850': '30 41 59',
      '--bg-800': '30 41 59',
      '--bg-750': '40 55 75',
      '--bg-700': '51 65 85',
      '--bg-600': '71 85 105',
      '--bg-500': '100 116 139',
      '--bg-400': '148 163 184',
      '--bg-300': '203 213 225',
      '--bg-200': '226 232 240',
      '--bg-100': '241 245 249',
      '--p-900': '30 58 138',
      '--p-800': '30 64 175',
      '--p-700': '29 78 216',
      '--p-600': '37 99 235',
      '--p-500': '59 130 246',
      '--p-400': '96 165 250',
      '--p-300': '147 197 253',
    }
  },
  {
    id: 'midnight',
    name: 'Midnight & Violet',
    colors: {
      '--bg-900': '24 24 27', // Zinc 900
      '--bg-850': '39 39 42', // Zinc 800
      '--bg-800': '39 39 42',
      '--bg-750': '63 63 70', // Zinc 700
      '--bg-700': '63 63 70',
      '--bg-600': '82 82 91',
      '--bg-500': '113 113 122',
      '--bg-400': '161 161 170',
      '--bg-300': '212 212 216',
      '--bg-200': '228 228 231',
      '--bg-100': '244 244 245',
      '--p-600': '124 58 237', // Violet
      '--p-500': '139 92 246',
      '--p-400': '167 139 250',
      '--p-300': '196 181 253',
    }
  },
  {
    id: 'forest',
    name: 'Forest & Emerald',
    colors: {
      '--bg-900': '10 10 10', // Neutral 950
      '--bg-850': '23 23 23', // Neutral 900
      '--bg-800': '23 23 23',
      '--bg-750': '38 38 38', // Neutral 800
      '--bg-700': '38 38 38',
      '--bg-600': '64 64 64',
      '--bg-500': '115 115 115',
      '--bg-400': '163 163 163',
      '--bg-300': '212 212 212',
      '--bg-200': '229 229 229',
      '--bg-100': '245 245 245',
      '--p-600': '5 150 105', // Emerald
      '--p-500': '16 185 129',
      '--p-400': '52 211 153',
      '--p-300': '110 231 183',
    }
  },
  {
    id: 'sunset',
    name: 'Stone & Orange',
    colors: {
      '--bg-900': '28 25 23', // Stone 900
      '--bg-850': '41 37 36', // Stone 800
      '--bg-800': '41 37 36',
      '--bg-750': '68 64 60', // Stone 700
      '--bg-700': '68 64 60',
      '--bg-600': '87 83 78',
      '--bg-500': '120 113 108',
      '--bg-400': '168 162 158',
      '--bg-300': '214 211 209',
      '--bg-200': '231 229 228',
      '--bg-100': '245 245 244',
      '--p-600': '234 88 12', // Orange
      '--p-500': '249 115 22',
      '--p-400': '251 146 60',
      '--p-300': '253 186 116',
    }
  },
  {
    id: 'amethyst',
    name: 'Deep Space & Fuchsia',
    colors: {
      '--bg-900': '19 7 36', // Deep Purple
      '--bg-850': '32 12 56',
      '--bg-800': '32 12 56',
      '--bg-750': '49 19 82',
      '--bg-700': '49 19 82',
      '--bg-600': '76 29 149',
      '--bg-500': '109 40 217',
      '--bg-400': '139 92 246',
      '--bg-300': '167 139 250',
      '--bg-200': '221 214 254',
      '--bg-100': '237 233 254',
      '--p-600': '192 38 211', // Fuchsia
      '--p-500': '217 70 239',
      '--p-400': '232 121 249',
      '--p-300': '240 171 252',
    }
  }
];

// --- Components ---

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  
  // Apply Theme on Load
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const record = await db.config.get('app_theme');
        const themeId = record?.value || 'default';
        const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
        
        const root = document.documentElement;
        Object.entries(theme.colors).forEach(([key, value]) => {
           root.style.setProperty(key, value);
        });
      } catch (e) {
        console.error("Failed to load theme", e);
      }
    };
    loadTheme();
  }, []);

  // Check connection status periodically or on mount
  useEffect(() => {
    const check = () => setIsConnected(db.hasConnection());
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { icon: Library, label: 'Library', path: '/' },
    { icon: Search, label: 'Add New', path: '/search' },
    { icon: BarChart2, label: 'Analytics', path: '/analytics' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20 md:pb-0 md:pl-20 transition-colors duration-300">
      {/* Sidebar for Desktop */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-20 flex-col items-center bg-slate-800 border-r border-slate-700 py-6 space-y-8 z-50">
        <div className="p-2 bg-blue-600 rounded-lg relative group">
          <BookOpen className="w-6 h-6 text-white" />
          {/* Status Indicator */}
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-800 ${isConnected ? 'bg-green-500' : 'bg-slate-500'}`} title={isConnected ? "Linked to Local Folder" : "Local Storage Only (Not Linked)"}></div>
        </div>
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`p-3 rounded-xl transition-all ${location.pathname === item.path ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
          >
            <item.icon className="w-6 h-6" />
          </Link>
        ))}
      </nav>

      {/* Main Content */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {children}
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-slate-800 border-t border-slate-700 flex justify-around p-4 z-50">
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`flex flex-col items-center gap-1 ${location.pathname === item.path ? 'text-blue-400' : 'text-slate-400'}`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px]">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

const Card: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm ${className}`}>
    {children}
  </div>
);

const Badge: React.FC<{ 
  children?: React.ReactNode; 
  color?: string; 
  onClick?: (e: React.MouseEvent) => void; 
  title?: string;
}> = ({ children, color = 'bg-slate-700 text-slate-300', onClick, title }) => (
  <span 
    title={title}
    onClick={(e) => {
      if (onClick) {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }
    }}
    className={`px-2 py-1 rounded-md text-xs font-medium ${color} ${onClick ? 'cursor-pointer hover:opacity-80 hover:ring-1 hover:ring-white/20 transition-all' : ''}`}
  >
    {children}
  </span>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ElementType;
}

const Button: React.FC<ButtonProps> = ({ 
  children, onClick, variant = 'primary', icon: Icon, disabled = false, className = '', ...props 
}) => {
  const baseStyle = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
  return (
    <div className="flex gap-0.5" title={`Rating: ${rating}/5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star 
          key={star} 
          className={`w-4 h-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}`} 
        />
      ))}
    </div>
  );
};

// --- Pages ---

const LibraryPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // URL Query Params
  const queryParams = new URLSearchParams(location.search);
  const typeParam = queryParams.get('type');
  const valueParam = queryParams.get('value');

  // Advanced Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<'lastRead' | 'title' | 'rating' | 'added'>('lastRead');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (typeParam && valueParam) {
      if (typeParam === 'status') {
        setStatusFilter([valueParam]);
        setShowFilters(true);
      } else if (typeParam === 'tag') {
        setTagQuery(valueParam);
        setShowFilters(true);
      } else if (typeParam === 'author' || typeParam === 'staff' || typeParam === 'character') {
        setSearchQuery(valueParam);
      }
    }
  }, [typeParam, valueParam]);

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTagQuery('');
    setStatusFilter([]);
    setMinRating(0);
    setSortBy('lastRead');
    setSortOrder('desc');
    navigate('/');
  };

  const manhwas = useLiveQuery(async () => {
    let collection = await db.manhwas.toArray();

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      collection = collection.filter(m => 
        m.title.toLowerCase().includes(q) ||
        (m.alternativeTitles || []).some(t => t.toLowerCase().includes(q)) ||
        m.author.toLowerCase().includes(q) ||
        (m.staff || []).some(s => s.toLowerCase().includes(q))
      );
    }

    if (tagQuery) {
      const q = tagQuery.toLowerCase();
      collection = collection.filter(m => 
        m.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (statusFilter.length > 0) {
      collection = collection.filter(m => statusFilter.includes(m.status));
    }

    if (minRating > 0) {
      collection = collection.filter(m => m.rating >= minRating);
    }

    return collection.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortBy) {
        case 'title': valA = a.title.toLowerCase(); valB = b.title.toLowerCase(); break;
        case 'rating': valA = a.rating; valB = b.rating; break;
        case 'added': valA = a.createdAt?.getTime() || 0; valB = b.createdAt?.getTime() || 0; break;
        case 'lastRead': default: valA = a.lastReadAt?.getTime() || 0; valB = b.lastReadAt?.getTime() || 0; break;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [searchQuery, tagQuery, statusFilter, minRating, sortBy, sortOrder]);

  const activeFilterCount = (searchQuery ? 1 : 0) + (tagQuery ? 1 : 0) + (statusFilter.length > 0 ? 1 : 0) + (minRating > 0 ? 1 : 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-white">Library</h1>
                <p className="text-slate-400">Your collection</p>
            </div>
            <Link to="/search">
                <Button icon={Plus}>Add Manhwa</Button>
            </Link>
        </div>

        <div className="flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input 
                    type="text"
                    placeholder="Search titles, authors, staff..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <Button 
                variant={showFilters ? "primary" : "secondary"} 
                onClick={() => setShowFilters(!showFilters)}
                className="px-3"
            >
                <SlidersHorizontal className="w-5 h-5" />
                {activeFilterCount > 0 && <span className="ml-1 bg-white text-blue-600 text-[10px] font-bold px-1.5 rounded-full">{activeFilterCount}</span>}
            </Button>
        </div>

        {showFilters && (
            <Card className="p-4 grid gap-6 animate-in slide-in-from-top-2 duration-200">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                        <div className="flex flex-wrap gap-2">
                            {['Reading', 'Completed', 'Plan to Read', 'Dropped'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => toggleStatus(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                        statusFilter.includes(status) 
                                        ? 'bg-blue-600 border-blue-500 text-white' 
                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sort By</label>
                        <div className="flex gap-2">
                            <select 
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white flex-1 outline-none focus:border-blue-500"
                            >
                                <option value="lastRead">Last Read</option>
                                <option value="title">Title</option>
                                <option value="rating">Rating</option>
                                <option value="added">Date Added</option>
                            </select>
                            <button 
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="p-2 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800"
                            >
                                {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-slate-400" /> : <ArrowDown className="w-4 h-4 text-slate-400" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Tag</label>
                         <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                            <input 
                                placeholder="e.g. Action" 
                                value={tagQuery}
                                onChange={(e) => setTagQuery(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 p-2 text-sm text-white focus:border-blue-500 outline-none"
                            />
                         </div>
                    </div>
                    <div className="space-y-2">
                         <div className="flex justify-between">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Min Rating</label>
                            <span className="text-xs text-yellow-400 font-bold">{minRating > 0 ? `${minRating}+ Stars` : 'Any'}</span>
                         </div>
                         <input 
                            type="range" min="0" max="5" step="1"
                            value={minRating}
                            onChange={(e) => setMinRating(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                         />
                    </div>
                </div>
                <div className="flex justify-between items-center border-t border-slate-700/50 pt-4">
                     <span className="text-xs text-slate-500">Showing {manhwas?.length || 0} results</span>
                     <Button variant="ghost" onClick={clearFilters} className="text-xs h-8">Clear All</Button>
                </div>
            </Card>
        )}
      </header>

      {!manhwas || manhwas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <BookOpen className="w-16 h-16 mb-4 opacity-20" />
          <p>No Manhwas found matching your criteria.</p>
          <Button variant="ghost" onClick={clearFilters} className="mt-4 text-blue-400">Clear Filters</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {manhwas.map((manhwa) => (
            <Link key={manhwa.id} to={`/manhwa/${manhwa.id}`} className="group block">
              <Card className="h-full transition-transform group-hover:-translate-y-1 group-hover:shadow-lg hover:border-blue-500/50">
                <div className="aspect-[2/3] relative overflow-hidden bg-slate-900">
                  <img 
                    src={manhwa.coverUrl} 
                    alt={manhwa.title} 
                    className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-0 left-0 p-3 w-full">
                    <h3 className="font-bold text-white truncate leading-tight mb-1">{manhwa.title}</h3>
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>{manhwa.status}</span>
                      {manhwa.rating > 0 && <span className="flex items-center text-yellow-400 gap-0.5"><Star className="w-3 h-3 fill-current" />{manhwa.rating}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const SearchPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MangaDexResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const data = await searchMangaDex(query);
    setResults(data);
    setLoading(false);
  };

  const handleAdd = async (manga: MangaDexResult) => {
    const coverUrl = getCoverUrl(manga.id, manga.coverFileName);
    const id = await db.addManhwa({
      dexId: manga.id,
      title: manga.title,
      coverUrl,
      author: manga.author || 'Unknown',
      staff: manga.author ? [manga.author] : [],
      rating: 0,
      status: 'Reading',
      tags: manga.tags,
      createdAt: new Date(),
      lastReadAt: new Date(),
      alternativeTitles: []
    });
    navigate(`/manhwa/${id}`);
  };

  const handleTagClick = (tag: string) => {
      navigate(`/?type=tag&value=${encodeURIComponent(tag)}`);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Add Manhwa</h1>
        <Button variant="secondary" onClick={() => setIsManualModalOpen(true)} className="text-sm">Manual Entry</Button>
      </header>
      
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search MangaDex..."
          className="w-full bg-slate-800 border border-slate-700 text-white p-4 pl-12 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-500"
        />
        <Search className="absolute left-4 top-4 text-slate-500 w-5 h-5" />
        <Button className="absolute right-2 top-2" variant="primary" disabled={loading}>{loading ? 'Searching...' : 'Search'}</Button>
      </form>

      <div className="space-y-4">
        {results.map((manga) => (
          <Card key={manga.id} className="flex p-4 gap-4 hover:bg-slate-750 transition-colors">
            <img src={getCoverUrl(manga.id, manga.coverFileName)} alt={manga.title} className="w-20 h-28 object-cover rounded-md bg-slate-900 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-white truncate">{manga.title}</h3>
              <p className="text-sm text-slate-400 mb-2">{manga.author}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {manga.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} color="bg-slate-700 text-slate-400 text-[10px]" onClick={() => handleTagClick(tag)}>{tag}</Badge>
                ))}
              </div>
              <Button onClick={() => handleAdd(manga)} icon={Plus} variant="secondary" className="w-full sm:w-auto text-sm py-1.5">Add to Library</Button>
            </div>
          </Card>
        ))}
        {results.length === 0 && !loading && query && (
          <p className="text-center text-slate-500 mt-8">No results found.</p>
        )}
      </div>

      {isManualModalOpen && (
        <ManhwaMetadataModal 
          onClose={() => setIsManualModalOpen(false)}
          onSubmit={async (data) => {
             const id = await db.addManhwa({
                ...data,
                dexId: `manual-${Date.now()}`,
                createdAt: new Date(),
                lastReadAt: new Date()
             });
             navigate(`/manhwa/${id}`);
          }}
        />
      )}
    </div>
  );
};

const ManhwaDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const manhwaId = parseInt(id || '0');
  
  const manhwa = useLiveQuery(() => db.manhwas.get(manhwaId), [manhwaId]);
  const scenes = useLiveQuery(() => db.scenes.where('manhwaId').equals(manhwaId).reverse().sortBy('chapterNumber'), [manhwaId]);

  const [isSceneFormOpen, setIsSceneFormOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [filterChar, setFilterChar] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const filteredScenes = useMemo(() => {
    if (!scenes) return [];
    return scenes.filter(s => {
      const matchChar = !filterChar || s.characters.some(c => c.toLowerCase().includes(filterChar.toLowerCase()));
      const matchTag = !filterTag || s.tags.some(t => t.toLowerCase().includes(filterTag.toLowerCase()));
      return matchChar && matchTag;
    });
  }, [scenes, filterChar, filterTag]);

  useEffect(() => {
    if (manhwa) db.manhwas.update(manhwaId, { lastReadAt: new Date() });
  }, [manhwaId]);

  if (!manhwa) return <div className="p-8 text-center">Loading...</div>;

  const handleDelete = async () => {
    if(confirm("Are you sure you want to delete this Manhwa and all its scenes?")) {
        await db.manhwas.delete(manhwaId);
        await db.scenes.where('manhwaId').equals(manhwaId).delete();
        navigate('/');
    }
  }

  const filterByStaff = (name: string) => navigate(`/?type=staff&value=${encodeURIComponent(name)}`);
  const filterByTag = (tag: string) => navigate(`/?type=tag&value=${encodeURIComponent(tag)}`);
  const filterByCharacter = (char: string) => navigate(`/?type=character&value=${encodeURIComponent(char)}`);
  const filterByStatus = () => navigate(`/?type=status&value=${encodeURIComponent(manhwa.status)}`);

  const displayStaff = manhwa.staff && manhwa.staff.length > 0 ? manhwa.staff : [manhwa.author];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="w-full md:w-56 flex-shrink-0 group relative">
          <img src={manhwa.coverUrl} className="w-full aspect-[2/3] object-cover rounded-xl shadow-lg ring-1 ring-slate-700" alt={manhwa.title} />
        </div>
        <div className="flex-1 space-y-5 w-full">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{manhwa.title}</h1>
            {manhwa.alternativeTitles && manhwa.alternativeTitles.length > 0 && (
                <div className="text-sm text-slate-400 mb-2 italic">{manhwa.alternativeTitles.join(' • ')}</div>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
                <Users className="w-4 h-4 text-slate-500" />
                {displayStaff.map((staffMember) => (
                    <Badge key={staffMember} color="bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600" onClick={() => filterByStaff(staffMember)} title="Filter Library by Staff">{staffMember}</Badge>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm font-medium">Rating:</span>
                <StarRating rating={manhwa.rating} />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                <Badge color={`
                        ${manhwa.status === 'Reading' ? 'bg-blue-900/50 text-blue-300 border-blue-800' : ''}
                        ${manhwa.status === 'Completed' ? 'bg-green-900/50 text-green-300 border-green-800' : ''}
                        ${manhwa.status === 'Dropped' ? 'bg-red-900/50 text-red-300 border-red-800' : ''}
                        ${manhwa.status === 'Plan to Read' ? 'bg-slate-700 text-slate-300 border-slate-600' : ''}
                        border
                    `} onClick={filterByStatus}>{manhwa.status}</Badge>
                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                {manhwa.tags.map(t => <Badge key={t} onClick={() => filterByTag(t)} color="bg-slate-800 text-slate-400 border border-slate-700">#{t}</Badge>)}
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-700/50 mt-4">
            <Button onClick={() => setIsEditModalOpen(true)} variant="secondary" icon={Edit2}>Edit Details</Button>
             <Button onClick={handleDelete} variant="danger" icon={Trash2}>Delete</Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 border-b border-slate-700 pb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2"><BookOpen className="w-6 h-6 text-blue-400" />Scenes</h2>
             <Button onClick={() => { setEditingScene(null); setIsSceneFormOpen(true); }} icon={Plus} className="text-sm py-1.5 h-8">Add Scene</Button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-40">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input placeholder="Filter Character" className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 p-2 text-sm text-white focus:border-blue-500 outline-none transition-colors" value={filterChar} onChange={e => setFilterChar(e.target.value)} />
             </div>
             <div className="relative flex-1 sm:w-40">
                <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input placeholder="Filter Tag" className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 p-2 text-sm text-white focus:border-blue-500 outline-none transition-colors" value={filterTag} onChange={e => setFilterTag(e.target.value)} />
             </div>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredScenes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                <p className="text-slate-500 mb-2">No scenes found.</p>
                <Button variant="ghost" onClick={() => { setEditingScene(null); setIsSceneFormOpen(true); }} className="text-blue-400">Log the first scene</Button>
            </div>
          ) : (
            filteredScenes.map((scene) => (
              <Card key={scene.id} className="p-4 relative group hover:border-blue-500/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                   <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-blue-400 font-mono">Ch.{scene.chapterNumber}</span>
                      <div className="h-4 w-px bg-slate-700"></div>
                      <div className="flex gap-1.5 flex-wrap">
                        {scene.characters.map(c => (
                            <Badge key={c} color="bg-slate-700/50 text-slate-300 text-[10px] border border-slate-700" onClick={() => filterByCharacter(c)}>{c}</Badge>
                        ))}
                      </div>
                   </div>
                   <button onClick={() => { setEditingScene(scene); setIsSceneFormOpen(true); }} className="text-slate-600 hover:text-white p-1 transition-colors">
                     <SettingsIcon className="w-4 h-4" />
                   </button>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-3 pl-1 border-l-2 border-slate-800">{scene.description}</p>
                <div className="flex gap-1 flex-wrap">
                   {scene.tags.map(t => <span key={t} onClick={() => filterByTag(t)} className="text-[10px] text-blue-400 bg-blue-500/5 border border-blue-500/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-500/20">#{t}</span>)}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {isSceneFormOpen && (
        <SceneFormModal manhwa={manhwa} sceneToEdit={editingScene} onClose={() => setIsSceneFormOpen(false)} />
      )}
      {isEditModalOpen && (
        <ManhwaMetadataModal
            initialData={manhwa}
            onClose={() => setIsEditModalOpen(false)}
            onSubmit={async (data) => {
                await db.manhwas.update(manhwaId, data);
                setIsEditModalOpen(false);
            }}
        />
      )}
    </div>
  );
};

const ManhwaMetadataModal = ({ initialData, onClose, onSubmit }: { initialData?: Manhwa, onClose: () => void, onSubmit: (data: Omit<Manhwa, 'id'>) => Promise<void> }) => {
    const [title, setTitle] = useState(initialData?.title || '');
    const [altTitles, setAltTitles] = useState(initialData?.alternativeTitles?.join(', ') || '');
    const [coverUrl, setCoverUrl] = useState(initialData?.coverUrl || '');
    const [staff, setStaff] = useState(initialData?.staff?.join(', ') || initialData?.author || '');
    const [status, setStatus] = useState<Manhwa['status']>(initialData?.status || 'Reading');
    const [rating, setRating] = useState(initialData?.rating || 0);
    const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const staffList = staff.split(',').map(s => s.trim()).filter(Boolean);
        onSubmit({
            title,
            alternativeTitles: altTitles.split(',').map(s => s.trim()).filter(Boolean),
            coverUrl: coverUrl || 'https://picsum.photos/300/450',
            staff: staffList,
            author: staffList[0] || 'Unknown',
            status,
            rating,
            tags: tags.split(',').map(s => s.trim()).filter(Boolean),
            dexId: initialData?.dexId || '',
            createdAt: initialData?.createdAt || new Date(),
            lastReadAt: initialData?.lastReadAt || new Date()
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-850">
                    <h2 className="text-xl font-bold text-white">{initialData ? 'Edit Details' : 'Add Manhwa Manually'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    <div><label className="block text-sm text-slate-400 mb-1">Title <span className="text-red-400">*</span></label><input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" required value={title} onChange={e => setTitle(e.target.value)} /></div>
                    <div><label className="block text-sm text-slate-400 mb-1">Alternate Titles (comma separated)</label><input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm" value={altTitles} onChange={e => setAltTitles(e.target.value)} placeholder="Korean Title, etc." /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm text-slate-400 mb-1">Status</label><select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={status} onChange={e => setStatus(e.target.value as any)}><option value="Reading">Reading</option><option value="Plan to Read">Plan to Read</option><option value="Completed">Completed</option><option value="Dropped">Dropped</option></select></div>
                        <div><label className="block text-sm text-slate-400 mb-1">Rating (0-5)</label><div className="flex items-center gap-2 h-10">{[1,2,3,4,5].map(v => (<button type="button" key={v} onClick={() => setRating(v)} className="focus:outline-none"><Star className={`w-6 h-6 ${rating >= v ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}`} /></button>))}</div></div>
                    </div>
                    <div><label className="block text-sm text-slate-400 mb-1">Staff / Authors (comma separated)</label><input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm" value={staff} onChange={e => setStaff(e.target.value)} placeholder="Author, Artist" /></div>
                    <div><label className="block text-sm text-slate-400 mb-1">Tags (comma separated)</label><input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm" value={tags} onChange={e => setTags(e.target.value)} placeholder="Action, Fantasy, System" /></div>
                    <div><label className="block text-sm text-slate-400 mb-1">Cover Image URL</label><input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://..." /><p className="text-[10px] text-slate-500 mt-1">Leave empty for random placeholder.</p></div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-700 mt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button className="w-32">{initialData ? 'Save Changes' : 'Add Manhwa'}</Button></div>
                </form>
            </div>
        </div>
    );
};

const SceneFormModal = ({ manhwa, sceneToEdit, onClose }: { manhwa: Manhwa, sceneToEdit: Scene | null, onClose: () => void }) => {
  const [chapter, setChapter] = useState(sceneToEdit?.chapterNumber || 0);
  const [desc, setDesc] = useState(sceneToEdit?.description || '');
  const [chars, setChars] = useState(sceneToEdit?.characters.join(', ') || '');
  const [tags, setTags] = useState(sceneToEdit?.tags.join(', ') || '');
  const [aiLoading, setAiLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sceneData = {
      manhwaId: manhwa.id!,
      chapterNumber: Number(chapter),
      description: desc,
      characters: chars.split(',').map(s => s.trim()).filter(Boolean),
      tags: tags.split(',').map(s => s.trim()).filter(Boolean),
      createdAt: new Date()
    };
    if (sceneToEdit?.id) await db.scenes.update(sceneToEdit.id, sceneData);
    else await db.scenes.add(sceneData);
    onClose();
  };

  const handleAiGenerate = async () => {
    setAiLoading(true);
    try {
      const context = `Characters: ${chars}, Tags: ${tags}, Draft: ${desc}`;
      const generated = await generateSceneDescription(manhwa.title, chapter, context);
      setDesc(generated);
    } catch (err) {
      alert("Failed to generate. Check console/API key.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-850">
          <h2 className="text-xl font-bold text-white">{sceneToEdit ? 'Edit Scene' : 'Log New Scene'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-sm text-slate-400 mb-1">Chapter Number</label><input type="number" required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" value={chapter} onChange={e => setChapter(Number(e.target.value))} /></div>
          <div><div className="flex justify-between mb-1"><label className="block text-sm text-slate-400">Description</label><button type="button" onClick={handleAiGenerate} disabled={aiLoading} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-50"><Wand2 className="w-3 h-3" />{aiLoading ? 'Magic...' : 'AI Enhance'}</button></div><textarea rows={4} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm" placeholder="What happened? E.g. 'Jin-Woo summons Igris for the first time...'" value={desc} onChange={e => setDesc(e.target.value)} /></div>
          <div><label className="block text-sm text-slate-400 mb-1">Characters (comma separated)</label><input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm" placeholder="e.g. Jin-Woo, Cha Hae-In" value={chars} onChange={e => setChars(e.target.value)} /></div>
          <div><label className="block text-sm text-slate-400 mb-1">Tags (comma separated)</label><input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm" placeholder="e.g. Fight, Fluff, Cliffhanger" value={tags} onChange={e => setTags(e.target.value)} /></div>
          <div className="pt-4 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button className="w-24">Save</Button></div>
        </form>
      </div>
    </div>
  );
};

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const manhwas = useLiveQuery(() => db.manhwas.toArray());
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!manhwas) return [];
    const counts: Record<string, number> = {};
    manhwas.forEach(m => { m.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }); });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [manhwas]);
  
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];
  const getInsight = async () => { if (!manhwas) return; const titles = manhwas.map(m => `${m.title} (${m.tags.slice(0,2).join('/')})`); setAiInsight("Analyzing your library..."); const result = await analyzeReadingHabits(titles); setAiInsight(result); };
  const handlePieClick = (data: any) => { if (data && data.name) navigate(`/?type=tag&value=${encodeURIComponent(data.name)}`); };

  return (
    <div className="space-y-6">
      <header><h1 className="text-3xl font-bold">Analytics</h1><p className="text-slate-400">Your reading habits visualized</p></header>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 h-80 flex flex-col">
          <h3 className="text-lg font-bold mb-4">Top Genres</h3><p className="text-xs text-slate-500 mb-2">Click a slice to filter library</p>
          <div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" onClick={handlePieClick} cursor="pointer">{data.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} itemStyle={{ color: '#fff' }} /><Legend layout="vertical" verticalAlign="middle" align="right" /></PieChart></ResponsiveContainer></div>
        </Card>
        <Card className="p-6 relative overflow-hidden">
          <div className="relative z-10"><h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Wand2 className="w-5 h-5 text-purple-400" />AI Insight</h3><div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 min-h-[100px]"><p className="text-slate-300 leading-relaxed italic">{aiInsight || "Click generate to see what Gemini thinks of your taste."}</p></div><Button onClick={getInsight} className="mt-4 w-full" variant="secondary">Generate Analysis</Button></div><div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-600/20 blur-3xl rounded-full" />
        </Card>
        <Card className="p-6">
            <h3 className="text-lg font-bold mb-2">Library Stats</h3>
            <div className="space-y-4 mt-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">Total Manhwas</span><span className="text-2xl font-bold">{manhwas?.length || 0}</span></div>
                <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400">Completed</span><span className="text-2xl font-bold text-green-400">{manhwas?.filter(m => m.status === 'Completed').length || 0}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-400">Reading</span><span className="text-2xl font-bold text-blue-400">{manhwas?.filter(m => m.status === 'Reading').length || 0}</span></div>
            </div>
        </Card>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const [folderLinked, setFolderLinked] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [currentTheme, setCurrentTheme] = useState('default');

  useEffect(() => {
    const init = async () => {
        // Connection Check
        const hasHandle = db.hasConnection();
        if (hasHandle) {
             const restored = await db.requestPermission();
             setFolderLinked(restored);
             setStatusMsg(restored ? 'Connected' : 'Permission needed (Reload)');
        } else {
             const restored = await db.restoreConnection();
             setFolderLinked(restored);
        }

        // Theme Load
        const themeRec = await db.config.get('app_theme');
        if (themeRec) setCurrentTheme(themeRec.value);
    };
    init();
  }, []);

  const handleLinkFolder = async () => {
    setStatusMsg("Connecting...");
    const success = await db.connectToFolder();
    setFolderLinked(success);
    setStatusMsg(success ? "Folder Linked Successfully" : "Failed to link folder");
  };

  const handleReloadFromDisk = async () => {
      setStatusMsg("Scanning library...");
      try {
        await db.syncFromDisk();
        setStatusMsg("Library refreshed");
      } catch (e) {
        setStatusMsg("Failed to read files");
      }
  };

  const changeTheme = async (themeId: string) => {
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return;
    
    // Update State
    setCurrentTheme(themeId);
    
    // Save to DB
    await db.config.put({ key: 'app_theme', value: themeId });
    
    // Apply CSS Variables
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
       root.style.setProperty(key, value);
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      {/* Theme Section */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Palette className="w-5 h-5 text-purple-400" />Appearance</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {THEMES.map((theme) => {
              // Extract preview colors from the theme map
              const bg = `rgb(${theme.colors['--bg-800']})`;
              const accent = `rgb(${theme.colors['--p-500']})`;
              return (
                  <button 
                    key={theme.id}
                    onClick={() => changeTheme(theme.id)}
                    className={`relative p-3 rounded-xl border-2 transition-all flex flex-col gap-2 items-center ${currentTheme === theme.id ? 'border-blue-500 bg-slate-700/50' : 'border-slate-700 hover:border-slate-600'}`}
                  >
                     <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full shadow-lg" style={{ backgroundColor: bg }}></div>
                        <div className="w-8 h-8 rounded-full shadow-lg" style={{ backgroundColor: accent }}></div>
                     </div>
                     <span className="text-xs font-medium text-slate-300">{theme.name}</span>
                     {currentTheme === theme.id && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>}
                  </button>
              );
          })}
        </div>
      </Card>

      {/* Data Storage Section */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><HardDrive className="w-5 h-5 text-blue-400" />Data Storage</h2>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
             <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-full ${folderLinked ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                        {folderLinked ? <CheckCircle className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
                     </div>
                     <div><p className="font-medium text-white">{folderLinked ? 'Local Folder Linked' : 'Using Browser Storage'}</p><p className="text-xs text-slate-500">{folderLinked ? 'Data stored in "library" subfolder.' : 'Data is stored in browser cache only.'}</p></div>
                 </div>
                 {folderLinked && (<Button variant="ghost" onClick={handleReloadFromDisk} title="Reload from Disk" className="p-2"><RefreshCw className="w-4 h-4" /></Button>)}
             </div>
             {!folderLinked ? (
                 <div className="space-y-3">
                     <div className="flex gap-2 items-center bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md">
                        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                        <p className="text-xs text-yellow-200">Linking a folder creates a <code>library</code> folder where each Manhwa is saved as a separate JSON file. You can edit these files externally.</p>
                     </div>
                     <Button onClick={handleLinkFolder} className="w-full" variant="secondary"><FolderOpen className="w-4 h-4" />Link Local Folder</Button>
                 </div>
             ) : (<div className="text-xs text-slate-400 text-center"><p>{statusMsg}</p></div>)}
        </div>
      </Card>
      <div className="text-center text-slate-600 text-sm"><p>ManhwaLog v1.2.0 (File Per Item)</p></div>
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/manhwa/:id" element={<ManhwaDetailPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;