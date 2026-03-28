"use client"

import React, { useState, useReducer, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Video, Smartphone, Layers, Sparkles, Plus, Trash2, GripVertical, Settings, ArrowBigUp, Wand2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const VideoPlayerClient = dynamic(() => import('../video-preview/VideoPlayerClient'), { ssr: false });

// ═══ DATA MODEL ═══
export interface LayerItem {
    id: string;
    type: 'giant-text' | 'b-roll' | 'newspaper' | 'cta' | 'swipe-card' | 'emoji-reaction' | 'counter' | 'imessage' | 'money-rain';
    label: string;
    startMs: number;
    endMs: number;
    props: Record<string, any>;
    locked?: boolean;
}

// Widget catalog
const WIDGET_CATALOG = [
    { type: 'giant-text', label: '🔤 Testo Gigante', icon: '🔤', color: '#EAB308', defaultProps: { query: 'TESTO IMPATTO', line2: '', highlightWord: '', textStyle: 'impact', color: '#EAB308' } },
    { type: 'b-roll', label: '🖼️ Card B-Roll', icon: '🖼️', color: '#8B5CF6', defaultProps: { query: '', variant: 'slide-right', position: 'top-right', imageUrl: '' } },
    { type: 'newspaper', label: '📰 Newspaper', icon: '📰', color: '#F97316', defaultProps: { query: 'BREAKING NEWS: ...' } },
    { type: 'swipe-card', label: '📋 Swipe Card', icon: '📋', color: '#06B6D4', defaultProps: { query: 'Titolo Notizia', line2: 'Sottotitolo...' } },
    { type: 'cta', label: '🔴 CTA Button', icon: '🔴', color: '#EF4444', defaultProps: { query: 'Scopri di più', color: '#EF4444' } },
    { type: 'emoji-reaction', label: '🔥 Emoji Reaction', icon: '🔥', color: '#F59E0B', defaultProps: { emojis: ['🔥', '❤️', '💪', '⚡', '🏆'], intensity: 'medium' } },
    { type: 'counter', label: '💰 Contatore', icon: '💰', color: '#22C55E', defaultProps: { query: '€', toValue: 15000, color: '#22C55E' } },
    { type: 'imessage', label: '💬 iMessage', icon: '💬', color: '#0072FF', defaultProps: { query: 'Sta scrivendo...' } },
    { type: 'money-rain', label: '💸 Pioggia Soldi', icon: '💸', color: '#16A34A', defaultProps: {} },
] as const;

// ═══ LAYER REDUCER ═══
type LayerAction = 
    | { type: 'ADD'; payload: LayerItem }
    | { type: 'REMOVE'; id: string }
    | { type: 'UPDATE'; id: string; updates: Partial<LayerItem> }
    | { type: 'SET_ALL'; layers: LayerItem[] }
    | { type: 'REORDER'; oldIndex: number; newIndex: number };

function layerReducer(state: LayerItem[], action: LayerAction): LayerItem[] {
    switch (action.type) {
        case 'ADD':
            return [...state, action.payload];
        case 'REMOVE':
            return state.filter(l => l.id !== action.id);
        case 'UPDATE':
            return state.map(l => l.id === action.id ? { ...l, ...action.updates } : l);
        case 'SET_ALL':
            return action.layers;
        case 'REORDER': {
            const newOrder = [...state];
            const [moved] = newOrder.splice(action.oldIndex, 1);
            newOrder.splice(action.newIndex, 0, moved);
            return newOrder;
        }
        default:
            return state;
    }
}

// ═══ PROPERTY CONFIGS ═══
const PROPERTY_FIELDS: Record<string, { label: string; key: string; type: 'text' | 'number' | 'select' | 'color'; options?: string[] }[]> = {
    'giant-text': [
        { label: 'Riga 1', key: 'query', type: 'text' },
        { label: 'Riga 2', key: 'line2', type: 'text' },
        { label: 'Parola Highlight', key: 'highlightWord', type: 'text' },
        { label: 'Stile', key: 'textStyle', type: 'select', options: ['impact', 'gradient', 'outline', 'neon'] },
        { label: 'Colore', key: 'color', type: 'color' },
    ],
    'b-roll': [
        { label: 'URL Immagine', key: 'imageUrl', type: 'text' },
        { label: 'Prompt AI', key: 'query', type: 'text' },
        { label: 'Animazione', key: 'variant', type: 'select', options: ['slide-right', 'slide-left', 'scale-up', 'rotate-in'] },
        { label: 'Posizione', key: 'position', type: 'select', options: ['top-right', 'top-left', 'center', 'bottom-right'] },
    ],
    'newspaper': [
        { label: 'Titolo', key: 'query', type: 'text' },
    ],
    'swipe-card': [
        { label: 'Titolo', key: 'query', type: 'text' },
        { label: 'Sottotitolo', key: 'line2', type: 'text' },
    ],
    'cta': [
        { label: 'Testo', key: 'query', type: 'text' },
        { label: 'Colore', key: 'color', type: 'color' },
    ],
    'emoji-reaction': [
        { label: 'Intensità', key: 'intensity', type: 'select', options: ['low', 'medium', 'high'] },
    ],
    'counter': [
        { label: 'Valore Finale', key: 'toValue', type: 'number' },
        { label: 'Prefisso', key: 'query', type: 'text' },
        { label: 'Colore', key: 'color', type: 'color' },
    ],
    'imessage': [
        { label: 'Testo', key: 'query', type: 'text' },
    ],
    'money-rain': [],
};

// ═══ SORTABLE LAYER ROW ═══
function SortableLayerRow({ layer, durationMs, isSelected, onSelect, cat }: { layer: LayerItem, durationMs: number, isSelected: boolean, onSelect: () => void, cat: any }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
        zIndex: isDragging ? 50 : 1,
    };

    const leftPc = Math.max(0, (layer.startMs / durationMs) * 100);
    const widthPc = Math.max(3, ((layer.endMs - layer.startMs) / durationMs) * 100);

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-0 h-8" onClick={onSelect}>
            {/* Label (Draggable via handle) */}
            <div className={`w-32 flex-shrink-0 flex items-center gap-1.5 px-2 rounded-l text-xs truncate h-full select-none ${isSelected ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
                <div {...attributes} {...listeners} className="cursor-grab hover:bg-zinc-700/50 p-1 -ml-1 rounded">
                    <GripVertical className="w-3 h-3 text-zinc-500" />
                </div>
                <span>{cat?.icon}</span>
                <span className="truncate text-[10px] font-medium cursor-pointer">{layer.label.replace(/^.{2} /, '')}</span>
            </div>
            {/* Track bar */}
            <div className="flex-1 relative h-full bg-zinc-900/50 rounded-r cursor-pointer">
                <div 
                    className={`absolute h-full rounded transition-all ${isSelected ? 'ring-1 ring-white/40' : ''}`}
                    style={{ 
                        left: `${leftPc}%`, 
                        width: `${widthPc}%`,
                        backgroundColor: `${cat?.color || '#666'}40`,
                        borderLeft: `3px solid ${cat?.color || '#666'}`,
                    }}
                >
                    <span className="text-[8px] text-white/60 px-1.5 truncate block leading-8">{layer.props.query || ''}</span>
                </div>
            </div>
        </div>
    );
}

export default function VideoEditorProPage() {
    // ═══ SCRIPT & AUDIO STATE ═══
    const [headline, setHeadline] = useState("Sblocca il tuo vero potenziale con il Metodo Sincro. Stai ancora aspettando o agisci?");
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [words, setWords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [avatarVideoUrl, setAvatarVideoUrl] = useState('');
    
    // ═══ AVATAR STATE ═══
    const [heygenStatus, setHeygenStatus] = useState<string | null>(null);
    const [avatarList, setAvatarList] = useState<{avatar_id: string, avatar_name: string}[]>([]);
    const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');
    const [loadingAvatars, setLoadingAvatars] = useState(false);

    // Load Avatars on mount
    useEffect(() => {
        const loadAvatars = async () => {
            setLoadingAvatars(true);
            try {
                const res = await fetch('/api/heygen/avatars');
                const apiAvatars = res.ok ? (await res.json()).avatars || [] : [];
                
                const customAvatars = [
                    { avatar_id: 'df8fc9c5f0f74afba2217797cf1d83f4', avatar_name: 'Antonio Valente' },
                    { avatar_id: '56433fd8787d4f509a7d5d1470019277', avatar_name: 'Antonio Valente Foto' },
                ];
                
                const customIds = new Set(customAvatars.map(a => a.avatar_id));
                const merged = [...customAvatars, ...apiAvatars.filter((a: any) => !customIds.has(a.avatar_id))];
                
                setAvatarList(merged);
                if (merged.length > 0) setSelectedAvatarId(merged[0].avatar_id);
            } catch (err) {
                console.warn('Errore avatar HeyGen:', err);
                const fallback = [
                    { avatar_id: 'df8fc9c5f0f74afba2217797cf1d83f4', avatar_name: 'Antonio Valente' },
                    { avatar_id: '56433fd8787d4f509a7d5d1470019277', avatar_name: 'Antonio Valente Foto' },
                ];
                setAvatarList(fallback);
                setSelectedAvatarId(fallback[0].avatar_id);
            } finally {
                setLoadingAvatars(false);
            }
        };
        loadAvatars();
    }, []);
    
    // ═══ LAYER STATE ═══
    const [layers, dispatch] = useReducer(layerReducer, []);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

    // Duration from audio
    const durationMs = useMemo(() => {
        if (words.length > 0) {
            return Math.max(...words.map(w => w.endMs)) + 2000; // +2s buffer
        }
        return 12000; // default 12s
    }, [words]);

    const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;

    // ═══ HANDLERS ═══
    const handleAddLayer = (catalogItem: typeof WIDGET_CATALOG[number]) => {
        const newLayer: LayerItem = {
            id: `${catalogItem.type}-${Date.now()}`,
            type: catalogItem.type as any,
            label: catalogItem.label,
            startMs: 0,
            endMs: Math.min(3000, durationMs),
            props: { ...catalogItem.defaultProps },
        };
        dispatch({ type: 'ADD', payload: newLayer });
        setSelectedLayerId(newLayer.id);
    };

    const handleDeleteLayer = (id: string) => {
        dispatch({ type: 'REMOVE', id });
        if (selectedLayerId === id) setSelectedLayerId(null);
    };

    const handleUpdateProp = (key: string, value: any) => {
        if (!selectedLayer) return;
        dispatch({
            type: 'UPDATE',
            id: selectedLayer.id,
            updates: { props: { ...selectedLayer.props, [key]: value } },
        });
    };

    const handleUpdateTiming = (id: string, startMs: number, endMs: number) => {
        dispatch({ type: 'UPDATE', id, updates: { startMs, endMs } });
    };

    // ═══ DND HANDLERS ═══
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = layers.findIndex(l => l.id === active.id);
            const newIndex = layers.findIndex(l => l.id === over.id);
            dispatch({ type: 'REORDER', oldIndex, newIndex });
        }
    };

    // Generate audio
    const handleGenerate = async () => {
        if (!headline.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/ai-engine/generate-video-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: headline })
            });
            const data = await res.json();
            if (res.ok && data.audioBase64) {
                setAudioBase64(data.audioBase64);
                setWords(data.words);
                // Auto-populate layers from AI if visualAssets exist
                if (data.visualAssets?.length > 0) {
                    const aiLayers: LayerItem[] = data.visualAssets.map((asset: any, i: number) => {
                        const cat = WIDGET_CATALOG.find(c => c.type === asset.type) || WIDGET_CATALOG[0];
                        return {
                            id: `ai-${asset.type}-${i}-${Date.now()}`,
                            type: asset.type || 'b-roll',
                            label: cat.label,
                            startMs: asset.startMs,
                            endMs: asset.endMs,
                            props: { ...asset },
                        };
                    });
                    dispatch({ type: 'SET_ALL', layers: aiLayers });
                }
            } else {
                setError(data.error || "Errore sconosciuto");
            }
        } catch (err) {
            setError("Errore di rete");
        } finally {
            setLoading(false);
        }
    };

    // Generate HeyGen Avatar
    const handleGenerateAvatar = async () => {
        if (!headline.trim()) return;
        setHeygenStatus("Avvio generazione su HeyGen...");
        setError(null);

        try {
            const res = await fetch('/api/heygen/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: headline, audioBase64: audioBase64, avatarId: selectedAvatarId })
            });

            const data = await res.json();
            if (!res.ok || !data.video_id) {
                setError((data.error || "Errore HeyGen") + (data.details ? ` - Dettagli: ${data.details}` : ""));
                setHeygenStatus(null);
                return;
            }

            const videoId = data.video_id;
            setHeygenStatus(`In Rendering 3D... (ID: ${videoId.slice(0, 8)}) - Può richiedere minuti`);

            const checkStatus = async () => {
                try {
                    const statusRes = await fetch(`/api/heygen/status?video_id=${videoId}`);
                    const statusData = await statusRes.json();

                    if (statusData.status === "completed") {
                        setAvatarVideoUrl(statusData.video_url);
                        setHeygenStatus(null);
                    } else if (statusData.status === "failed") {
                        setError(`Ops, la renderizzazione su HeyGen è fallita. ${statusData.error ? JSON.stringify(statusData.error) : ""}`);
                        setHeygenStatus(null);
                    } else {
                        setTimeout(checkStatus, 10000); 
                    }
                } catch (e) {
                    setError("Interruzione del polling");
                    setHeygenStatus(null);
                }
            };
            setTimeout(checkStatus, 10000);

        } catch(err) {
            setError("HeyGen API non raggiungibile.");
            setHeygenStatus(null);
        }
    };

    // Convert layers to visualAssets for the template
    const visualAssets = useMemo(() => {
        return layers.map(l => ({
            ...l.props,
            type: l.type,
            startMs: l.startMs,
            endMs: l.endMs,
        }));
    }, [layers]);

    // iMessage text
    const iosMessageText = useMemo(() => {
        const imsg = layers.find(l => l.type === 'imessage');
        return imsg?.props?.query || null;
    }, [layers]);

    const enableMoneyVFX = layers.some(l => l.type === 'money-rain');

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            {/* ═══ TOP BAR ═══ */}
            <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <h1 className="text-lg font-bold text-white">Video Editor Pro <span className="text-xs text-purple-400 ml-1">5.0</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">{layers.length} layer{layers.length !== 1 ? 's' : ''} • {(durationMs / 1000).toFixed(1)}s</span>
                    <button 
                        onClick={handleGenerate}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? '⏳ Generando...' : '🎙️ Genera Audio AI'}
                    </button>
                </div>
            </div>

            {/* ═══ MAIN 3-COLUMN LAYOUT ═══ */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* ═══ LEFT: COMPONENT LIBRARY ═══ */}
                <div className="w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col overflow-y-auto flex-shrink-0">
                    <div className="p-3 border-b border-zinc-800">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Libreria VFX</span>
                    </div>
                    <div className="p-2 space-y-1">
                        {WIDGET_CATALOG.map(widget => (
                            <button
                                key={widget.type}
                                onClick={() => handleAddLayer(widget)}
                                className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all text-left group"
                            >
                                <span className="text-lg">{widget.icon}</span>
                                <span className="text-xs font-medium text-zinc-300 group-hover:text-white flex-1">{widget.label.replace(/^.{2} /, '')}</span>
                                <Plus className="w-3 h-3 text-zinc-600 group-hover:text-purple-400 transition-colors" />
                            </button>
                        ))}
                    </div>
                    
                    {/* Avatar & Script input */}
                    <div className="p-3 border-t border-zinc-800 mt-auto bg-zinc-950/50">
                        {/* Selettore Avatar */}
                        <div className="mb-4">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">Avatar HeyGen</label>
                            {loadingAvatars ? (
                                <div className="text-xs text-zinc-500">Caricamento avatar...</div>
                            ) : (
                                <select 
                                    value={selectedAvatarId} 
                                    onChange={(e) => setSelectedAvatarId(e.target.value)}
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-white text-xs appearance-none focus:border-purple-500 outline-none cursor-pointer"
                                >
                                    {avatarList.map(avatar => (
                                        <option key={avatar.avatar_id} value={avatar.avatar_id}>
                                            {avatar.avatar_name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">Script</label>
                        <textarea
                            rows={3}
                            value={headline}
                            onChange={e => setHeadline(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-white text-xs focus:border-purple-500 outline-none resize-none mb-3"
                            placeholder="Scrivi lo script..."
                        />

                        {audioBase64 && (
                            <button 
                                onClick={handleGenerateAvatar}
                                disabled={heygenStatus !== null}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-2 rounded-lg transition-colors border border-zinc-700 disabled:opacity-50"
                            >
                                {heygenStatus ? '⏳ Rendering...' : '🎥 Invia ad HeyGen'}
                            </button>
                        )}
                        {heygenStatus && (
                            <p className="text-[10px] text-purple-400 mt-2 text-center font-mono">{heygenStatus}</p>
                        )}
                    </div>
                </div>

                {/* ═══ CENTER: VIDEO PREVIEW ═══ */}
                <div className="flex-1 bg-zinc-900 flex items-center justify-center p-4">
                    <div className="relative" style={{ width: 360, height: 640 }}>
                        <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-zinc-700">
                            {audioBase64 ? (
                                <VideoPlayerClient
                                    headline={headline}
                                    audioBase64={audioBase64}
                                    words={words}
                                    avatarVideoUrl={avatarVideoUrl || undefined}
                                    visualAssets={visualAssets}
                                    messageText={iosMessageText || undefined}
                                    useMoney={enableMoneyVFX}
                                    backgroundMood="warm-studio"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-zinc-950 flex flex-col items-center justify-center text-center p-8 gap-4">
                                    <Video className="w-12 h-12 text-zinc-600" />
                                    <p className="text-sm text-zinc-500">Premi <span className="text-purple-400 font-bold">"Genera Audio AI"</span> per avviare</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ═══ RIGHT: PROPERTY PANEL ═══ */}
                <div className="w-72 bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-y-auto flex-shrink-0">
                    <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-zinc-500" />
                        <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                            {selectedLayer ? 'Proprietà' : 'Seleziona Layer'}
                        </span>
                    </div>

                    {selectedLayer ? (
                        <div className="p-4 space-y-4">
                            {/* Layer info */}
                            <div className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg">
                                <span className="text-lg">{WIDGET_CATALOG.find(w => w.type === selectedLayer.type)?.icon || '⬛'}</span>
                                <div>
                                    <div className="text-xs font-bold text-white">{selectedLayer.label}</div>
                                    <div className="text-[10px] text-zinc-500">{selectedLayer.id.slice(0, 20)}...</div>
                                </div>
                            </div>

                            {/* Timing */}
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">Timing</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-[9px] text-zinc-600 mb-1 block">Inizio (ms)</span>
                                        <input
                                            type="number"
                                            value={selectedLayer.startMs}
                                            onChange={e => handleUpdateTiming(selectedLayer.id, Number(e.target.value), selectedLayer.endMs)}
                                            className="w-full bg-black border border-zinc-800 rounded p-2 text-white text-xs"
                                            step={100}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-zinc-600 mb-1 block">Fine (ms)</span>
                                        <input
                                            type="number"
                                            value={selectedLayer.endMs}
                                            onChange={e => handleUpdateTiming(selectedLayer.id, selectedLayer.startMs, Number(e.target.value))}
                                            className="w-full bg-black border border-zinc-800 rounded p-2 text-white text-xs"
                                            step={100}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Type-specific fields */}
                            {PROPERTY_FIELDS[selectedLayer.type]?.map(field => (
                                <div key={field.key}>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1 block">{field.label}</label>
                                    {field.type === 'text' && (
                                        <input
                                            type="text"
                                            value={selectedLayer.props[field.key] || ''}
                                            onChange={e => handleUpdateProp(field.key, e.target.value)}
                                            className="w-full bg-black border border-zinc-800 rounded p-2 text-white text-xs focus:border-purple-500 outline-none"
                                        />
                                    )}
                                    {field.type === 'number' && (
                                        <input
                                            type="number"
                                            value={selectedLayer.props[field.key] || 0}
                                            onChange={e => handleUpdateProp(field.key, Number(e.target.value))}
                                            className="w-full bg-black border border-zinc-800 rounded p-2 text-white text-xs"
                                        />
                                    )}
                                    {field.type === 'select' && (
                                        <select
                                            value={selectedLayer.props[field.key] || ''}
                                            onChange={e => handleUpdateProp(field.key, e.target.value)}
                                            className="w-full bg-black border border-zinc-800 rounded p-2 text-white text-xs appearance-none cursor-pointer"
                                        >
                                            {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    )}
                                    {field.type === 'color' && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={selectedLayer.props[field.key] || '#ffffff'}
                                                onChange={e => handleUpdateProp(field.key, e.target.value)}
                                                className="w-8 h-8 rounded cursor-pointer border-none"
                                            />
                                            <input
                                                type="text"
                                                value={selectedLayer.props[field.key] || ''}
                                                onChange={e => handleUpdateProp(field.key, e.target.value)}
                                                className="flex-1 bg-black border border-zinc-800 rounded p-2 text-white text-xs"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Delete button */}
                            <button
                                onClick={() => handleDeleteLayer(selectedLayer.id)}
                                className="w-full mt-4 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Elimina Layer
                            </button>
                        </div>
                    ) : (
                        <div className="p-6 flex flex-col items-center justify-center text-center gap-3 text-zinc-600 flex-1">
                            <Layers className="w-8 h-8" />
                            <p className="text-xs">Seleziona un layer dalla timeline o aggiungine uno dalla libreria</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ BOTTOM: TIMELINE ═══ */}
            <div className="h-48 bg-zinc-950 border-t border-zinc-800 flex flex-col flex-shrink-0">
                <div className="px-4 py-2 border-b border-zinc-800/50 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">🎬 Timeline</span>
                    <span className="text-[10px] text-zinc-600">{(durationMs / 1000).toFixed(1)}s</span>
                </div>
                
                {/* Time ruler */}
                <div className="px-4 py-1 flex border-b border-zinc-900">
                    <div className="w-32 flex-shrink-0" />
                    <div className="flex-1 flex relative">
                        {Array.from({ length: Math.ceil(durationMs / 1000) + 1 }).map((_, i) => (
                            <div 
                                key={i} 
                                className="text-[9px] text-zinc-600 absolute"
                                style={{ left: `${(i * 1000 / durationMs) * 100}%` }}
                            >
                                {i}s
                            </div>
                        ))}
                    </div>
                </div>

                {/* Layer tracks */}
                <div className="flex-1 overflow-y-auto px-4 py-1 space-y-1">
                    {layers.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-zinc-700 text-xs">
                            Aggiungi componenti dalla libreria a sinistra ←
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={layers.map(l => l.id)} strategy={verticalListSortingStrategy}>
                                {layers.map(layer => {
                                    const cat = WIDGET_CATALOG.find(w => w.type === layer.type);
                                    return (
                                        <SortableLayerRow 
                                            key={layer.id} 
                                            layer={layer} 
                                            durationMs={durationMs}
                                            isSelected={selectedLayerId === layer.id}
                                            onSelect={() => setSelectedLayerId(layer.id)}
                                            cat={cat}
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* Error bar */}
            {error && (
                <div className="bg-red-500/10 border-t border-red-500/20 px-4 py-2 text-xs text-red-400">{error}</div>
            )}
        </div>
    );
}
