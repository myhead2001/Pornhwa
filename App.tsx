
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Library, Search, Plus, BookOpen, Settings as SettingsIcon, 
  BarChart2, Save, X, Trash2, Wand2, Filter, ChevronRight, Hash, User,
  Star, Edit2, Users, ArrowUp, ArrowDown, Calendar, Clock, SlidersHorizontal,
  FolderOpen, RefreshCw, HardDrive, CheckCircle, AlertCircle, Palette,
  Home, Tag, Briefcase, ExternalLink, Beaker, AlertTriangle, Sparkles,
  Download, Upload, Smartphone, LayoutGrid, List
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
  
  // Apply Theme on Load & Restore DB Connection
  useEffect(() => {
    const init = async () => {
      // 1. Restore DB Connection for file system access
      try {
        await db.restoreConnection();
      } catch (e) {
        console.warn("Could not restore DB connection on mount");
      }

      // 2. Load Theme
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
    init();
  }, []);

  // Check connection status periodically or on mount
  useEffect(() => {
    const check = () => setIsConnected(db.hasConnection());
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Add New', path: '/search' },
    { icon: BarChart2, label: 'Analytics', path: '/analytics' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20 md:pb-0 md:pl-20 transition-colors duration-300">
      {/* Sidebar for Desktop */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-20 flex-col items-center bg-slate-800 border-r border-slate-700 py-6 space-y-8 z-50">
        <Link to="/" className="p-2 bg-blue-600 rounded-lg relative group transition-transform hover:scale-105 hover:bg-blue-500">
          <BookOpen className="w-6 h-6 text-white" />
          {/* Status Indicator */}
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-800 ${isConnected ? 'bg-green-500' : 'bg-slate-500'}`} title={isConnected ? "Linked to Local Folder" : "Local Storage Only (Not Linked)"}></div>
        </Link>
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
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-slate-800 border-t border-slate-700 flex justify-around p-4 z-50 safe-pb">
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

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ElementType;
}

const Button: React.FC<ButtonProps> = ({ 
  children, onClick, variant = 'primary', icon: Icon, disabled = false, className = '', type = 'button', ...props 
}) => {
  const baseStyle = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200"
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel" }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-sm p-6 space-y-4 bg-slate-900 border-slate-700 shadow-2xl">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle className="w-6 h-6" />
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <p className="text-slate-300 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onCancel}>{cancelText}</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmText}</Button>
        </div>
      </Card>
    </div>
  );
};

const Badge: React.FC<{ 
  children?: React.ReactNode; 
  color?: string; 
  onClick?: (e: React.MouseEvent) => void; 
  title?: string;
  onRemove?: () => void;
}> = ({ children, color = 'bg-slate-700 text-slate-300', onClick, title, onRemove }) => (
  <span 
    title={title}
    onClick={(e) => {
      if (onClick) {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }
    }}
    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${color} ${onClick ? 'cursor-pointer hover:opacity-80 hover:ring-1 hover:ring-white/20 transition-all' : ''}`}
  >
    {children}
    {onRemove && (
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="hover:text-red-400">
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
);

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

  // View Mode State (Grid vs List) with Persistence
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('library_view_mode') as 'grid' | 'list') || 'grid';
  });

  const handleViewChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('library_view_mode', mode);
  };

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

            {/* View Toggle */}
            <div className="hidden sm:flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button
                    onClick={() => handleViewChange('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Grid View"
                >
                    <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                    onClick={() => handleViewChange('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    title="List View"
                >
                    <List className="w-5 h-5" />
                </button>
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
          <div className="flex gap-4 mt-4">
            <Button variant="ghost" onClick={clearFilters} className="text-blue-400">Clear Filters</Button>
            <Link to="/settings"><Button variant="secondary" className="text-xs">Go to Settings to Load Demo Data</Button></Link>
          </div>
        </div>
      ) : (
        <>
            {viewMode === 'grid' ? (
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
            ) : (
                <div className="flex flex-col gap-3">
                    {manhwas.map((manhwa) => (
                        <Link key={manhwa.id} to={`/manhwa/${manhwa.id}`} className="group block">
                            <Card className="flex gap-4 p-3 hover:border-blue-500/50 transition-colors">
                                <div className="w-16 h-24 flex-shrink-0 bg-slate-900 rounded-md overflow-hidden shadow-sm">
                                    <img src={manhwa.coverUrl} alt={manhwa.title} className="w-full h-full object-cover" loading="lazy" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-white text-lg truncate pr-2 group-hover:text-blue-400 transition-colors">{manhwa.title}</h3>
                                        {manhwa.rating > 0 && (
                                            <div className="flex items-center text-yellow-400 gap-1 text-xs font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/20">
                                                <Star className="w-3 h-3 fill-current" />{manhwa.rating}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
                                         <span className={`px-1.5 py-0.5 rounded border ${
                                            manhwa.status === 'Reading' ? 'bg-blue-900/30 text-blue-300 border-blue-800' :
                                            manhwa.status === 'Completed' ? 'bg-green-900/30 text-green-300 border-green-800' :
                                            manhwa.status === 'Plan to Read' ? 'bg-slate-700/30 text-slate-300 border-slate-600' :
                                            'bg-red-900/30 text-red-300 border-red-800'
                                         }`}>
                                            {manhwa.status}
                                         </span>
                                         <span className="text-slate-600">•</span>
                                         <span className="text-slate-400 truncate">{manhwa.author}</span>
                                    </div>
                                    <div className="flex gap-1 overflow-hidden mask-linear-fade">
                                         {manhwa.tags.slice(0, 5).map(t => (
                                             <span key={t} className="text-[10px] px-1.5 py-0.5 bg-slate-900 text-slate-400 rounded border border-slate-700 whitespace-nowrap">
                                                {t}
                                             </span>
                                         ))}
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </>
      )}
    </div>
  );
};

const SearchPage = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MangaDexResult[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const search = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await searchMangaDex(query);
            setResults(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const add = async (manga: MangaDexResult) => {
        try {
            const id = await db.addManhwa({
                dexId: manga.id,
                title: manga.title,
                author: manga.author || 'Unknown',
                coverUrl: getCoverUrl(manga.id, manga.coverFileName),
                status: 'Plan to Read',
                rating: 0,
                tags: manga.tags,
                createdAt: new Date()
            });
            navigate(`/manhwa/${id}`);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Search MangaDex</h1>
            <form onSubmit={search} className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input 
                        value={query} 
                        onChange={(e) => setQuery(e.target.value)} 
                        className="w-full bg-slate-800 border-slate-700 border rounded-xl pl-10 py-3 focus:outline-none focus:border-blue-500" 
                        placeholder="Search by title..." 
                    />
                </div>
                <Button type="submit" disabled={loading} className="px-6">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Search'}
                </Button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map(m => (
                    <Card key={m.id} className="flex overflow-hidden h-40">
                        <img src={getCoverUrl(m.id, m.coverFileName)} className="w-28 h-full object-cover" loading="lazy" />
                        <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
                            <div>
                                <h3 className="font-bold truncate" title={m.title}>{m.title}</h3>
                                <p className="text-sm text-slate-400 truncate">{m.author}</p>
                            </div>
                            <Button onClick={() => add(m)} variant="secondary" className="w-full text-xs">Add to Library</Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const ManhwaDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const manhwaId = Number(id);
    
    // UI States
    const [sceneFormOpen, setSceneFormOpen] = useState(false);
    
    // Scene Form States
    const [chapter, setChapter] = useState('');
    const [characters, setCharacters] = useState('');
    const [sceneTags, setSceneTags] = useState('');
    const [description, setDescription] = useState('');
    const [generating, setGenerating] = useState(false);

    const data = useLiveQuery(async () => {
        const m = await db.manhwas.get(manhwaId);
        const s = await db.scenes.where('manhwaId').equals(manhwaId).toArray();
        return { manhwa: m, scenes: s.sort((a,b) => b.chapterNumber - a.chapterNumber) };
    }, [manhwaId]);

    if (!data?.manhwa) return <div>Loading...</div>;
    const { manhwa, scenes } = data;

    const handleDelete = async () => {
        if (confirm("Delete this manhwa?")) {
            await db.deleteManhwa(manhwaId);
            navigate('/');
        }
    };

    const updateManhwa = async (updates: Partial<Manhwa>) => {
        await db.manhwas.update(manhwaId, updates);
    };

    const generateDesc = async () => {
        if (!chapter) return alert("Please enter a chapter number");
        setGenerating(true);
        try {
            const context = `Characters: ${characters}, Tags: ${sceneTags}`;
            const desc = await generateSceneDescription(manhwa.title, Number(chapter), context);
            setDescription(desc);
        } catch(e) {
            alert("Generation failed");
        } finally {
            setGenerating(false);
        }
    };

    const addScene = async () => {
        await db.scenes.add({
            manhwaId,
            chapterNumber: Number(chapter),
            description,
            characters: characters.split(',').map(s => s.trim()).filter(Boolean),
            tags: sceneTags.split(',').map(s => s.trim()).filter(Boolean),
            createdAt: new Date()
        });
        setSceneFormOpen(false);
        setChapter(''); setDescription(''); setCharacters(''); setSceneTags('');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-64 flex-shrink-0">
                    <div className="rounded-xl overflow-hidden shadow-2xl aspect-[2/3]">
                        <img src={manhwa.coverUrl} className="w-full h-full object-cover" />
                    </div>
                </div>
                <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                        <h1 className="text-4xl font-bold">{manhwa.title}</h1>
                        <div className="flex gap-2">
                             <Button variant="ghost" icon={Trash2} onClick={handleDelete} className="text-red-400" />
                        </div>
                    </div>
                    <p className="text-xl text-slate-400">{manhwa.author}</p>
                    
                    <div className="flex flex-wrap gap-4 items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                            <select 
                                value={manhwa.status} 
                                onChange={(e) => updateManhwa({ status: e.target.value as any })}
                                className="block bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                            >
                                {['Reading', 'Completed', 'Plan to Read', 'Dropped'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Rating</label>
                            <div className="flex items-center gap-1">
                                <input 
                                    type="number" min="0" max="5" 
                                    value={manhwa.rating} 
                                    onChange={(e) => updateManhwa({ rating: Number(e.target.value) })}
                                    className="w-12 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                />
                                <StarRating rating={manhwa.rating} />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {manhwa.tags.map(t => <Badge key={t}>{t}</Badge>)}
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold flex items-center gap-2"><List className="w-6 h-6" /> Scenes</h2>
                 <Button onClick={() => setSceneFormOpen(!sceneFormOpen)} icon={Plus}>{sceneFormOpen ? 'Cancel' : 'Add Scene'}</Button>
            </div>

            {sceneFormOpen && (
                <Card className="p-4 space-y-4 border-blue-500/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <input type="number" placeholder="Ch #" value={chapter} onChange={e => setChapter(e.target.value)} className="bg-slate-900 border-slate-700 border rounded-lg p-2" />
                        <input placeholder="Characters (comma sep)" value={characters} onChange={e => setCharacters(e.target.value)} className="bg-slate-900 border-slate-700 border rounded-lg p-2 md:col-span-2" />
                        <input placeholder="Tags (comma sep)" value={sceneTags} onChange={e => setSceneTags(e.target.value)} className="bg-slate-900 border-slate-700 border rounded-lg p-2" />
                    </div>
                    <textarea 
                        placeholder="Description..." 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        className="w-full bg-slate-900 border-slate-700 border rounded-lg p-2 h-24"
                    />
                    <div className="flex justify-between">
                         <Button onClick={generateDesc} disabled={generating} variant="secondary" icon={Sparkles}>
                            {generating ? 'Dreaming...' : 'Generate with AI'}
                         </Button>
                         <Button onClick={addScene}>Save Scene</Button>
                    </div>
                </Card>
            )}

            <div className="grid gap-4">
                {scenes?.map(scene => (
                    <Card key={scene.id} className="p-4 flex gap-4">
                        <div className="flex flex-col items-center justify-center w-16 bg-slate-900 rounded-lg border border-slate-700 shrink-0 h-16">
                            <span className="text-xs text-slate-500">CH</span>
                            <span className="text-xl font-bold">{scene.chapterNumber}</span>
                        </div>
                        <div className="flex-1 space-y-2">
                            <p className="text-slate-300">{scene.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {scene.characters.map(c => <Badge key={c} color="bg-blue-900/30 text-blue-300 border border-blue-800">{c}</Badge>)}
                                {scene.tags.map(t => <Badge key={t} color="bg-slate-700 text-slate-400">{t}</Badge>)}
                            </div>
                        </div>
                        <button onClick={() => db.scenes.delete(scene.id!)} className="text-slate-600 hover:text-red-400 self-start">
                            <X className="w-4 h-4" />
                        </button>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const AnalyticsPage = () => {
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);

    const stats = useLiveQuery(async () => {
        const manhwas = await db.manhwas.toArray();
        const tagCounts: Record<string, number> = {};
        const statusCounts: Record<string, number> = {};
        
        manhwas.forEach(m => {
            m.tags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
            statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
        });

        const topTags = Object.entries(tagCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value)
            .slice(0, 8);
            
        return { topTags, statusCounts, manhwas };
    });

    const handleAnalyze = async () => {
        if (!stats?.manhwas.length) return;
        setLoading(true);
        try {
            const history = stats.manhwas.slice(0, 10).map(m => `${m.title} (${m.tags.slice(0,2).join(',')})`);
            const res = await analyzeReadingHabits(history);
            setAnalysis(res);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!stats) return <div>Loading stats...</div>;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">Analytics</h1>
            
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6 h-80 flex flex-col">
                    <h3 className="font-bold mb-4">Top Genres</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.topTags}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    label
                                >
                                    {stats.topTags.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                                    ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-6 space-y-4">
                    <h3 className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-400"/> AI Insight</h3>
                    <div className="bg-slate-900 p-4 rounded-xl min-h-[100px] flex items-center justify-center text-center">
                        {analysis ? <p className="text-slate-300">{analysis}</p> : <p className="text-slate-600 text-sm">Click analyze to get insights based on your library.</p>}
                    </div>
                    <Button onClick={handleAnalyze} disabled={loading} className="w-full" icon={Sparkles}>
                        {loading ? 'Analyzing...' : 'Analyze My Taste'}
                    </Button>
                </Card>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {Object.entries(stats.statusCounts).map(([status, count]) => (
                     <Card key={status} className="p-4 text-center">
                         <div className="text-2xl font-bold text-white">{count}</div>
                         <div className="text-xs text-slate-500 uppercase tracking-wider">{status}</div>
                     </Card>
                 ))}
            </div>
        </div>
    );
};

const generateDemoData = async () => {
    await db.transaction('rw', db.manhwas, db.scenes, async () => {
        const mId = await db.manhwas.add({
            title: 'Solo Leveling',
            author: 'Chu-Gong',
            coverUrl: 'https://upload.wikimedia.org/wikipedia/en/9/92/Solo_Leveling_Webtoon.png',
            rating: 5,
            status: 'Completed',
            tags: ['Action', 'Fantasy', 'System'],
            createdAt: new Date(),
            lastReadAt: new Date(),
            staff: ['Redice Studio']
        });
        
        await db.scenes.add({
            manhwaId: Number(mId),
            chapterNumber: 10,
            description: "Jin-Woo fights the giant snake boss in the subway station.",
            characters: ['Jin-Woo'],
            tags: ['Boss Fight', 'Action'],
            createdAt: new Date()
        });
    });
    window.location.reload();
};

const PresetManager = () => {
    return (
        <Card className="p-6 space-y-4">
             <h2 className="text-xl font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-400" />AI Configuration</h2>
             <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400">
                    AI features are enabled using the API Key from environment variables.
                    Uses <strong>gemini-2.5-flash</strong> for fast text generation.
                </p>
             </div>
        </Card>
    );
};

const SettingsPage = () => {
  const [folderLinked, setFolderLinked] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [currentTheme, setCurrentTheme] = useState('default');
  const [isIframe, setIsIframe] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [canUseFileSystem, setCanUseFileSystem] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check environment
    setIsIframe(window.self !== window.top);
    setCanUseFileSystem('showDirectoryPicker' in window);

    const init = async () => {
        // Connection Check (Only relevant if FSA is supported)
        if ('showDirectoryPicker' in window) {
            const hasHandle = db.hasConnection();
            if (hasHandle) {
                 const restored = await db.requestPermission();
                 setFolderLinked(restored);
                 setStatusMsg(restored ? 'Connected' : 'Permission needed (Reload)');
            } else {
                 const restored = await db.restoreConnection();
                 setFolderLinked(restored);
            }
        }

        // Theme Load
        const themeRec = await db.config.get('app_theme');
        if (themeRec) setCurrentTheme(themeRec.value);
    };
    init();

    // PWA Install Prompt Listener
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log("Install prompt captured!");
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the A2HS prompt');
        setInstallPrompt(null);
      } else {
        console.log('User dismissed the A2HS prompt');
      }
    });
  };

  const handleLinkFolder = async () => {
    setStatusMsg("Connecting...");
    const result = await db.connectToFolder();
    setFolderLinked(result.success);
    
    if (result.success) {
       setStatusMsg("Folder Linked Successfully");
    } else {
       setStatusMsg(result.message || "Failed to link folder");
       if (result.message && !result.message.toLowerCase().includes('cancelled')) {
           alert(result.message);
       }
    }
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

  // --- Backup Handlers for Android/Mobile ---
  const handleExportBackup = async () => {
      try {
          const jsonStr = await db.exportDatabaseToJson();
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `manhwalog_backup_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          alert("Failed to export backup");
      }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const text = await file.text();
          await db.importDatabaseFromJson(text);
          alert("Backup restored successfully!");
          // Reset file input
          if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (e) {
          console.error(e);
          alert("Failed to restore backup. Invalid file.");
      }
  };

  const changeTheme = async (themeId: string) => {
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return;
    setCurrentTheme(themeId);
    await db.config.put({ key: 'app_theme', value: themeId });
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
       root.style.setProperty(key, value);
    });
  };

  const confirmClearDatabase = async () => {
      try {
          console.log("Executing clearAllData...");
          await db.clearAllData();
          console.log("Done.");
          setShowClearConfirm(false);
          alert("Database cleared successfully.");
      } catch (e) {
          console.error("Clear failed", e);
          alert("Failed to clear data.");
      }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Settings</h1>
        
        {/* PWA Install Button Logic */}
        {installPrompt ? (
          <Button onClick={handleInstallClick} variant="primary" icon={Download} className="animate-pulse shadow-blue-500/50">
            Install App
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800 p-2 rounded-lg border border-slate-700">
              <Download className="w-4 h-4 opacity-50" />
              <span>
                 {window.matchMedia('(display-mode: standalone)').matches 
                   ? "App Installed" 
                   : "Install via Browser Menu"}
              </span>
          </div>
        )}
      </div>
      
      {/* Theme Section */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Palette className="w-5 h-5 text-purple-400" />Appearance</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {THEMES.map((theme) => {
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
      
      <PresetManager />

      {/* Data Storage Section - Conditional Rendering */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><HardDrive className="w-5 h-5 text-blue-400" />Data Storage</h2>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
             
             {canUseFileSystem ? (
                 <>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${folderLinked ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                {folderLinked ? <CheckCircle className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
                            </div>
                            <div><p className="font-medium text-white">{folderLinked ? 'Local Folder Linked' : 'Using Browser Storage'}</p><p className="text-xs text-slate-500">{folderLinked ? 'Data stored in "library" subfolder.' : 'Data is stored in browser cache only.'}</p></div>
                        </div>
                        {folderLinked && (<Button variant="ghost" onClick={handleReloadFromDisk} title="Reload from Disk" className="p-2"><RefreshCw className="w-4 h-4" /></Button>)}
                    </div>

                    {isIframe && !folderLinked && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-300 text-xs mb-4">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-bold mb-1">Preview Mode Detected</p>
                                <p>Browser security blocks File System access in preview frames. To link a folder, you must open this app in a new tab.</p>
                            </div>
                        </div>
                    )}

                    {!folderLinked ? (
                        <div className="space-y-3">
                            <div className="flex gap-2 items-center bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md">
                                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                                <p className="text-xs text-yellow-200">Linking a folder creates a <code>library</code> folder where each Manhwa is saved as a separate JSON file. You can edit these files externally.</p>
                            </div>
                            <Button onClick={handleLinkFolder} className="w-full" variant="secondary" disabled={isIframe}><FolderOpen className="w-4 h-4" />Link Local Folder</Button>
                        </div>
                    ) : (<div className="text-xs text-slate-400 text-center"><p>{statusMsg}</p></div>)}
                 </>
             ) : (
                 // Mobile / Android Fallback UI
                 <div className="space-y-4">
                     <div className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
                         <Smartphone className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
                         <div>
                             <h3 className="text-sm font-bold text-white mb-1">Mobile Storage Management</h3>
                             <p className="text-xs text-slate-400">Direct folder linking is not supported on Android/iOS browsers. You can export your library as a single JSON backup and restore it later to sync changes.</p>
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <Button onClick={handleExportBackup} variant="secondary" icon={Download} className="w-full">Export Backup</Button>
                        <div className="relative">
                            <Button variant="secondary" icon={Upload} className="w-full">Import Backup</Button>
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept=".json" 
                                onChange={handleImportBackup} 
                                className="absolute inset-0 opacity-0 cursor-pointer" 
                            />
                        </div>
                     </div>
                 </div>
             )}
        </div>
      </Card>

      {/* Developer / Testing Zone */}
      <Card className="p-6 space-y-4 border-slate-700/50 bg-slate-850/50">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-400"><Beaker className="w-5 h-5" />Developer Zone</h2>
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <p className="text-xs text-slate-500">Populate the app with sample Manhwas, Scenes, and History to test filtering and analytics.</p>
                <Button onClick={generateDemoData} variant="secondary" className="w-full border border-slate-600 hover:bg-slate-700">Load Demo Data</Button>
            </div>
            <div className="space-y-2">
                <p className="text-xs text-slate-500">Wipe the entire local database. This cannot be undone.</p>
                <Button onClick={() => setShowClearConfirm(true)} variant="danger" className="w-full">Clear Database</Button>
            </div>
        </div>
      </Card>

      <ConfirmationModal 
         isOpen={showClearConfirm}
         title="Clear Database"
         message="WARNING: This will delete ALL data from the app AND the linked local folder. This action cannot be undone."
         onCancel={() => setShowClearConfirm(false)}
         onConfirm={confirmClearDatabase}
         confirmText="Delete Everything"
      />

      <div className="text-center text-slate-600 text-sm"><p>ManhwaLog v1.2.3</p></div>
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
