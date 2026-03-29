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
    type: 'giant-text' | 'b-roll' | 'newspaper' | 'cta' | 'swipe-card' | 'emoji-reaction' | 'counter' | 'imessage' | 'money-rain'
        | 'vfx-glitch' | 'vfx-glow' | 'vfx-color-grading' | 'vfx-lens-flare' | 'vfx-particles'
        | 'vfx-camera-shake' | 'vfx-cinematic-bars' | 'vfx-chromatic' | 'vfx-speed-ramp' | 'vfx-3d-transform'
        | 'vfx-film-grain' | 'vfx-light-leak' | 'vfx-film-burn' | 'vfx-ken-burns' | 'vfx-motion-sticker';
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

// VFX Pro Catalog
const VFX_CATALOG = [
    { type: 'vfx-glitch', label: '🌊 Glitch', icon: '🌊', color: '#FF0040', defaultProps: { vfxType: 'digital', vfxDensity: 'medium', color: '#ff0040' } },
    { type: 'vfx-glow', label: '✨ Glow & Bloom', icon: '✨', color: '#A855F7', defaultProps: { color: '#a855f7', vfxDensity: 'medium', position: 'center', vfxAnimated: true } },
    { type: 'vfx-color-grading', label: '🎨 Color Grading', icon: '🎨', color: '#F59E0B', defaultProps: { vfxPreset: 'teal-orange', vfxIntensity: 0.8 } },
    { type: 'vfx-lens-flare', label: '🔮 Lens Flare', icon: '🔮', color: '#FFD700', defaultProps: { color: '#FFD700', vfxAngle: 30, vfxType: 'medium', vfxDensity: 'medium' } },
    { type: 'vfx-particles', label: '💫 Particles', icon: '💫', color: '#F97316', defaultProps: { vfxType: 'sparks', color: '#FFD700', vfxDensity: 'medium', vfxDirection: 'up', vfxSpeed: 1 } },
    { type: 'vfx-camera-shake', label: '📐 Camera Shake', icon: '📐', color: '#EF4444', defaultProps: { vfxDensity: 'medium', vfxType: 'handheld' } },
    { type: 'vfx-cinematic-bars', label: '🎭 Cinematic Bars', icon: '🎭', color: '#6B7280', defaultProps: { vfxBarSize: 12, color: '#000000', vfxAnimation: 'slide' } },
    { type: 'vfx-chromatic', label: '🌈 Chromatic', icon: '🌈', color: '#EC4899', defaultProps: { vfxDensity: 'medium', vfxAnimated: true, color: '#ff0040', vfxColor2: '#00d4ff' } },
    { type: 'vfx-speed-ramp', label: '⚡ Speed Ramp', icon: '⚡', color: '#3B82F6', defaultProps: { vfxType: 'slow-motion', vfxIntensity: 0.5 } },
    { type: 'vfx-3d-transform', label: '🔄 3D Transform', icon: '🔄', color: '#14B8A6', defaultProps: { vfxAnimation: 'orbit', vfxSpeed: 1, vfxRotateX: 0, vfxRotateY: 0, vfxRotateZ: 0, vfxPerspective: 1200 } },
    // ═══ LEONARDO STYLE ═══
    { type: 'vfx-film-grain', label: '🎬 Film Grain', icon: '🎬', color: '#A3A3A3', defaultProps: { vfxDensity: 'subtle', vfxType: 'neutral' } },
    { type: 'vfx-light-leak', label: '☀️ Light Leak', icon: '☀️', color: '#FF9500', defaultProps: { vfxType: 'warm', position: 'left', vfxDensity: 'medium' } },
    { type: 'vfx-film-burn', label: '🔥 Film Burn', icon: '🔥', color: '#FF4500', defaultProps: { color: '#FF6B00', vfxType: 'medium', vfxDirection: 'center-out' } },
    { type: 'vfx-motion-sticker', label: '✍️ Motion Sticker', icon: '✍️', color: '#EAB308', defaultProps: { vfxType: 'arrow-point', color: '#EAB308', vfxIntensity: 1, xOffset: 50, yOffset: 50, vfxAngle: 0 } },
    { type: 'vfx-ken-burns', label: '🎥 Ken Burns', icon: '🎥', color: '#8B5CF6', defaultProps: { vfxType: 'zoom-in', vfxDensity: 'subtle' } },
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

const PROPERTY_FIELDS: Record<string, { label: string; key: string; type: 'text' | 'number' | 'select' | 'color' | 'range'; options?: string[]; min?: number; max?: number; step?: number; default?: number }[]> = {
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
    // ═══ VFX PRO PROPERTY FIELDS ═══
    'vfx-glitch': [
        { label: 'Variante', key: 'vfxType', type: 'select', options: ['digital', 'vhs', 'rgb-split'] },
        { label: 'Intensità', key: 'vfxDensity', type: 'select', options: ['low', 'medium', 'high'] },
        { label: 'Colore', key: 'color', type: 'color' },
    ],
    'vfx-glow': [
        { label: 'Colore', key: 'color', type: 'color' },
        { label: 'Intensità', key: 'vfxDensity', type: 'select', options: ['soft', 'medium', 'intense'] },
        { label: 'Posizione', key: 'position', type: 'select', options: ['center', 'top', 'bottom', 'edges'] },
    ],
    'vfx-color-grading': [
        { label: 'Preset', key: 'vfxPreset', type: 'select', options: ['teal-orange', 'desaturated', 'vintage', 'neon', 'noir', 'golden-hour', 'cyberpunk', 'cold-blue'] },
        { label: 'Intensità', key: 'vfxIntensity', type: 'range', min: 0.1, max: 1.0, step: 0.05, default: 0.8 },
    ],
    'vfx-lens-flare': [
        { label: 'Colore', key: 'color', type: 'color' },
        { label: 'Angolo', key: 'vfxAngle', type: 'range', min: 0, max: 360, step: 5, default: 30 },
        { label: 'Velocità', key: 'vfxType', type: 'select', options: ['slow', 'medium', 'fast'] },
        { label: 'Dimensione', key: 'vfxDensity', type: 'select', options: ['small', 'medium', 'large'] },
    ],
    'vfx-particles': [
        { label: 'Tipo', key: 'vfxType', type: 'select', options: ['sparks', 'bokeh', 'snow', 'smoke', 'fire', 'dust', 'stars'] },
        { label: 'Colore', key: 'color', type: 'color' },
        { label: 'Densità', key: 'vfxDensity', type: 'select', options: ['low', 'medium', 'high'] },
        { label: 'Direzione', key: 'vfxDirection', type: 'select', options: ['up', 'down', 'left', 'right', 'scatter'] },
        { label: 'Velocità', key: 'vfxSpeed', type: 'range', min: 0.3, max: 3.0, step: 0.1, default: 1.0 },
    ],
    'vfx-camera-shake': [
        { label: 'Tipo', key: 'vfxType', type: 'select', options: ['handheld', 'impact', 'vibrate'] },
        { label: 'Intensità', key: 'vfxDensity', type: 'select', options: ['subtle', 'medium', 'earthquake'] },
    ],
    'vfx-cinematic-bars': [
        { label: 'Altezza Barre (%)', key: 'vfxBarSize', type: 'range', min: 2, max: 25, step: 1, default: 12 },
        { label: 'Colore', key: 'color', type: 'color' },
        { label: 'Animazione', key: 'vfxAnimation', type: 'select', options: ['slide', 'fade', 'instant'] },
    ],
    'vfx-chromatic': [
        { label: 'Intensità', key: 'vfxDensity', type: 'select', options: ['subtle', 'medium', 'heavy'] },
        { label: 'Colore 1', key: 'color', type: 'color' },
        { label: 'Colore 2', key: 'vfxColor2', type: 'color' },
    ],
    'vfx-speed-ramp': [
        { label: 'Tipo', key: 'vfxType', type: 'select', options: ['slow-motion', 'fast-forward', 'freeze', 'pulse'] },
        { label: 'Intensità', key: 'vfxIntensity', type: 'range', min: 0.1, max: 4.0, step: 0.1, default: 0.5 },
    ],
    'vfx-3d-transform': [
        { label: 'Animazione', key: 'vfxAnimation', type: 'select', options: ['static', 'orbit', 'flip', 'tilt-rock'] },
        { label: 'Velocità', key: 'vfxSpeed', type: 'range', min: 0.3, max: 3.0, step: 0.1, default: 1.0 },
        { label: 'Rotazione X', key: 'vfxRotateX', type: 'range', min: -45, max: 45, step: 1, default: 0 },
        { label: 'Rotazione Y', key: 'vfxRotateY', type: 'range', min: -45, max: 45, step: 1, default: 0 },
        { label: 'Prospettiva', key: 'vfxPerspective', type: 'range', min: 400, max: 2000, step: 50, default: 1200 },
    ],
    // ═══ LEONARDO STYLE PROPERTY FIELDS ═══
    'vfx-film-grain': [
        { label: 'Intensità', key: 'vfxDensity', type: 'select', options: ['subtle', 'medium', 'heavy'] },
        { label: 'Tono', key: 'vfxType', type: 'select', options: ['neutral', 'warm', 'cool'] },
    ],
    'vfx-light-leak': [
        { label: 'Colore', key: 'vfxType', type: 'select', options: ['warm', 'teal', 'purple', 'golden'] },
        { label: 'Posizione', key: 'position', type: 'select', options: ['left', 'right', 'top', 'center', 'random'] },
        { label: 'Intensità', key: 'vfxDensity', type: 'select', options: ['soft', 'medium', 'bright'] },
    ],
    'vfx-film-burn': [
        { label: 'Colore', key: 'color', type: 'color' },
        { label: 'Velocità', key: 'vfxType', type: 'select', options: ['slow', 'medium', 'fast'] },
        { label: 'Direzione', key: 'vfxDirection', type: 'select', options: ['center-out', 'edges-in', 'left-to-right', 'right-to-left'] },
    ],
    'vfx-motion-sticker': [
        { label: 'Tipo', key: 'vfxType', type: 'select', options: ['arrow-point', 'circle-highlight', 'underline', 'cross-out', 'bracket', 'star-burst', 'checkmark', 'exclamation'] },
        { label: 'Colore', key: 'color', type: 'color' },
        { label: 'Scala', key: 'vfxIntensity', type: 'range', min: 0.3, max: 3, step: 0.1, default: 1 },
        { label: 'Pos. X (%)', key: 'xOffset', type: 'range', min: 0, max: 100, step: 1, default: 50 },
        { label: 'Pos. Y (%)', key: 'yOffset', type: 'range', min: 0, max: 100, step: 1, default: 50 },
        { label: 'Rotazione', key: 'vfxAngle', type: 'range', min: -180, max: 180, step: 5, default: 0 },
    ],
    'vfx-ken-burns': [
        { label: 'Direzione', key: 'vfxType', type: 'select', options: ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'drift'] },
        { label: 'Intensità', key: 'vfxDensity', type: 'select', options: ['subtle', 'medium', 'strong'] },
    ],
};

// ═══ SORTABLE LAYER ROW ═══
function SortableLayerRow({ 
    layer, 
    durationMs, 
    isSelected, 
    onSelect, 
    onUpdate,
    cat 
}: { 
    layer: LayerItem, 
    durationMs: number, 
    isSelected: boolean, 
    onSelect: () => void, 
    onUpdate: (updates: Partial<LayerItem>) => void,
    cat: any 
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });
    const trackRef = React.useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState<{ active: 'left' | 'right' | null, initialX: number, initialStartMs: number, initialEndMs: number }>({ active: null, initialX: 0, initialStartMs: 0, initialEndMs: 0 });

    const handlePointerDown = (edge: 'left' | 'right', e: React.PointerEvent) => {
        e.stopPropagation();
        setDragState({
            active: edge,
            initialX: e.clientX,
            initialStartMs: layer.startMs,
            initialEndMs: layer.endMs
        });
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragState.active || !trackRef.current) return;
        
        const rect = trackRef.current.getBoundingClientRect();
        const pxPerMs = rect.width / durationMs;
        const deltaX = e.clientX - dragState.initialX;
        const deltaMs = deltaX / pxPerMs;

        if (dragState.active === 'left') {
            let newStart = Math.max(0, dragState.initialStartMs + deltaMs);
            newStart = Math.min(newStart, layer.endMs - 100); // min 100ms
            onUpdate({ startMs: newStart });
        } else {
            let newEnd = Math.max(layer.startMs + 100, dragState.initialEndMs + deltaMs);
            onUpdate({ endMs: newEnd });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragState.active) {
            (e.target as Element).releasePointerCapture(e.pointerId);
            setDragState(prev => ({ ...prev, active: null }));
        }
    };

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: dragState.active ? 'none' : transition, // disabilita transition se in resize res
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
        zIndex: isDragging ? 50 : 1,
    };

    const leftPc = Math.max(0, (layer.startMs / durationMs) * 100);
    const widthPc = Math.max(1, ((layer.endMs - layer.startMs) / durationMs) * 100);

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
            <div ref={trackRef} className="flex-1 relative h-full bg-zinc-900/50 rounded-r cursor-pointer">
                <div 
                    className={`absolute h-full rounded flex items-center justify-between group ${isSelected ? 'ring-1 ring-white/40' : ''}`}
                    style={{ 
                        left: `${leftPc}%`, 
                        width: `${widthPc}%`,
                        backgroundColor: `${cat?.color || '#666'}40`,
                        borderLeft: `3px solid ${cat?.color || '#666'}`,
                    }}
                >
                    {/* Left Resize Handle */}
                    <div 
                        onPointerDown={(e) => handlePointerDown('left', e)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        className="w-2 h-full cursor-ew-resize hover:bg-white/30 z-10 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    />

                    <span className="text-[8px] text-white/60 px-1.5 truncate block flex-1 pointer-events-none">{Math.round(layer.endMs - layer.startMs)}ms {layer.props.query ? `- ${layer.props.query}` : ''}</span>

                    {/* Right Resize Handle */}
                    <div 
                        onPointerDown={(e) => handlePointerDown('right', e)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        className="w-2 h-full cursor-ew-resize border-r-[3px] hover:bg-white/30 z-10 -mr-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ borderColor: cat?.color || '#666' }}
                    />
                </div>
            </div>
        </div>
    );
}

export default function VideoEditorProPage() {
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [vfxTab, setVfxTab] = useState<'widgets' | 'vfx'>('widgets');
    
    // ═══ SCRIPT & AUDIO STATE ═══
    const [headline, setHeadline] = useState("Sblocca il tuo vero potenziale con il Metodo Sincro. Stai ancora aspettando o agisci?");
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>('WS1kH1PJ5Xqt3tTn5Suw'); // Default Antonio Valente
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [words, setWords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [avatarVideoUrl, setAvatarVideoUrl] = useState('');
    const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
    
    // ═══ GLOBAL VIDEO SETTINGS ═══
    const [subtitleStyle, setSubtitleStyle] = useState<'tiktok' | 'impact' | 'karaoke' | 'hormozi' | 'neon-word' | 'minimal-word' | 'none'>('impact');
    const [exportQuality, setExportQuality] = useState<'1080p' | '4k'>('4k');
    const [exportFps, setExportFps] = useState<30 | 60>(60);
    
    // ═══ AVATAR STATE ═══
    const [heygenStatus, setHeygenStatus] = useState<string | null>(null);
    const [avatarList, setAvatarList] = useState<{avatar_id: string, avatar_name: string}[]>([]);
    const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');

    // ═══ PLAYER TIMELINE ═══
    const playerRef = React.useRef<any>(null);
    const playheadUiRef = React.useRef<HTMLDivElement>(null);
    const timecodeUiRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        let af: number;
        const tick = () => {
            if (playerRef.current && playheadUiRef.current) {
                const currentFrame = playerRef.current.getCurrentFrame() || 0;
                // Leggi la durata memorizzata nel data-attribute (o un valore di default)
                const totalF = parseFloat(playheadUiRef.current.dataset.duration || '600');
                const pct = Math.min(100, Math.max(0, (currentFrame / totalF) * 100));
                playheadUiRef.current.style.left = `${pct}%`;

                // Aggiorna contatore testuale CapCut style
                if (timecodeUiRef.current) {
                    const sec = currentFrame / 30; // 30 fps
                    const mins = Math.floor(sec / 60);
                    const secs = Math.floor(sec % 60);
                    const ms = Math.floor((sec % 1) * 10);
                    timecodeUiRef.current.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
                }
            }
            af = requestAnimationFrame(tick);
        };
        af = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(af);
    }, []);
    const [loadingAvatars, setLoadingAvatars] = useState(false);

    // ═══ RENDER MP4 STATE ═══
    const [renderJobId, setRenderJobId] = useState<string | null>(null);
    const [renderProgress, setRenderProgress] = useState<string | null>(null);
    const [renderUrl, setRenderUrl] = useState<string | null>(null);

    // Load Avatars on mount
    useEffect(() => {
        const loadAvatars = async () => {
            setLoadingAvatars(true);
            try {
                const res = await fetch('/api/heygen/avatars');
                const apiAvatars = res.ok ? (await res.json()).avatars || [] : [];
                
                const customAvatars = [
                    { avatar_id: 'df8fc9c5f0f74afba2217797cf1d83f4', avatar_name: 'Antonio Valente (Video)' },
                    { avatar_id: '56433fd8787d4f509a7d5d1470019277', avatar_name: 'Antonio Valente (Foto)' },
                ];
                
                const customIds = new Set(customAvatars.map(a => a.avatar_id));
                const merged = [...customAvatars, ...apiAvatars.filter((a: any) => !customIds.has(a.avatar_id))];
                
                setAvatarList(merged);
                if (merged.length > 0) setSelectedAvatarId(merged[0].avatar_id);
            } catch (err) {
                console.warn('Errore avatar HeyGen:', err);
                const fallback = [
                    { avatar_id: 'df8fc9c5f0f74afba2217797cf1d83f4', avatar_name: 'Antonio Valente (Video)' },
                    { avatar_id: '56433fd8787d4f509a7d5d1470019277', avatar_name: 'Antonio Valente (Foto)' },
                ];
                setAvatarList(fallback);
                setSelectedAvatarId(fallback[0].avatar_id);
            } finally {
                setLoadingAvatars(false);
            }
        };
        loadAvatars();
    }, []);
    
    const [layers, dispatch] = useReducer(layerReducer, []);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [customDurationMs, setCustomDurationMs] = useState<number | null>(null);

    // Duration calculation
    const durationMs = useMemo(() => {
        if (customDurationMs) return customDurationMs;
        
        let maxMs = 0;
        if (words.length > 0) {
            maxMs = Math.max(maxMs, ...words.map(w => w.endMs));
        }
        if (layers.length > 0) {
            maxMs = Math.max(maxMs, ...layers.map(l => l.endMs));
        }
        
        return maxMs > 0 ? maxMs : 12000;
    }, [words, layers, customDurationMs]);

    const durationInFrames = Math.max(30, Math.ceil((durationMs / 1000) * 60)); // Assicuriamoci che non sia 0 frame
    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!playerRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, e.clientX - rect.left);
        const percent = Math.min(1, x / rect.width);
        const targetFrame = Math.round(percent * durationInFrames);
        playerRef.current.seekTo(targetFrame);
    };

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

    const handleGenerateImage = async (layerId: string, prompt: string) => {
        if (!prompt) return alert('Inserisci prima un prompt nel campo relativo');
        setGeneratingImageId(layerId);
        try {
            const res = await fetch('/api/ai-engine/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const layer = layers.find(l => l.id === layerId);
            if (layer) {
                dispatch({
                    type: 'UPDATE',
                    id: layer.id,
                    updates: { props: { ...layer.props, url: data.imageUrl } }
                });
            }
        } catch (err: any) {
            alert(err.message || 'Errore generazione immagine');
        } finally {
            setGeneratingImageId(null);
        }
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

    // ═══ RENDER MP4 HANDLERS ═══
    const handleExportMP4 = async () => {
        if (!audioBase64) return alert("Genera prima l'audio e l'avatar!");
        
        setRenderProgress('Invio al VPS in corso...');
        setRenderUrl(null);
        try {
            const visualAssets = layers.map(l => ({
                ...l.props,
                type: l.type,
                startMs: l.startMs,
                endMs: l.endMs,
            }));
            
            const reqBody = {
                headline,
                audioBase64,
                words,
                visualAssets,
                enableMoneyVFX: layers.some(l => l.type === 'money-rain'),
                avatarVideoUrl: avatarVideoUrl || null,
                iosMessageText: layers.find(l => l.type === 'imessage')?.props?.query || null,
                backgroundMood: 'warm-studio',
                subtitleStyle,
                exportQuality,
                exportFps,
            };

            const res = await fetch('/api/render/job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });
            const job = await res.json();
            
            if (job.error || !job.id) throw new Error(job.error || "Errore sconosciuto");
            
            setRenderJobId(job.id);
            // Inizia il polling lento (non blocca la UI)
            pollRenderStatus(job.id);
        } catch (e) {
            setRenderProgress('Errore di invio');
            setTimeout(() => setRenderProgress(null), 3000);
        }
    };

    const pollRenderStatus = async (id: string) => {
        try {
            const res = await fetch('/api/render/job?id=' + id);
            const data = await res.json();
            
            if (data.status === 'completed') {
                setRenderProgress(null);
                setRenderJobId(null);
                setRenderUrl(data.video_url);
            } else if (data.status === 'failed') {
                setRenderProgress('Fallito: ' + (data.error || ''));
                setRenderJobId(null);
                setTimeout(() => setRenderProgress(null), 5000);
            } else {
                setRenderProgress(data.error || 'ServerVPS al Lavoro...');
                setTimeout(() => pollRenderStatus(id), 3000); // Polling ongi 3 secondi
            }
        } catch(e) {
             setRenderProgress('Errore connessione VPS. Riprovo...');
             setTimeout(() => pollRenderStatus(id), 5000);
        }
    };

    // Generate audio
    const handleGenerate = async () => {
        if (!headline.trim()) return;
        setLoading(true);
        setError(null);
        setAvatarVideoUrl(''); // Clear previous avatar video so it doesn't mute new TTS
        setHeygenStatus(null);
        try {
            const res = await fetch('/api/ai-engine/generate-video-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: headline, voiceId: selectedVoiceId })
            });
            const data = await res.json();
            if (res.ok && data.audioBase64) {
                setAudioBase64(data.audioBase64);
                setWords(data.words);
                // Auto-populate layers from AI se richiesto (Disabilitato come da richiesta utente)
                // if (data.visualAssets?.length > 0) {
                //     const aiLayers: LayerItem[] = data.visualAssets.map((asset: any, i: number) => {
                //         const cat = WIDGET_CATALOG.find(c => c.type === asset.type) || WIDGET_CATALOG[0];
                //         return {
                //             id: `ai-${asset.type}-${i}-${Date.now()}`,
                //             type: asset.type || 'b-roll',
                //             label: cat.label,
                //             startMs: asset.startMs,
                //             endMs: asset.endMs,
                //             props: { ...asset },
                //         };
                //     });
                //     dispatch({ type: 'SET_ALL', layers: aiLayers });
                // }
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
                        const originalUrl = statusData.video_url;
                        const proxyUrl = `/api/heygen/proxy?url=${encodeURIComponent(originalUrl)}`;
                        setAvatarVideoUrl(proxyUrl);
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
                    <h1 className="text-lg font-bold text-white">Video Editor Pro <span className="text-xs text-purple-400 ml-1">5.2</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">{layers.length} layer{layers.length !== 1 ? 's' : ''} • {(durationMs / 1000).toFixed(1)}s</span>
                    
                    <button 
                        onClick={() => setCurrentStep(5)}
                        className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                        Esporta ➡️
                    </button>
                </div>
            </div>

            {/* ═══ STEPPER BAR ═══ */}
            <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-2 flex items-center justify-center gap-4 flex-shrink-0">
                {[
                    { id: 1, label: 'Script', icon: '📝' },
                    { id: 2, label: 'Audio', icon: '🎧' },
                    { id: 3, label: 'Avatar', icon: '👤' },
                    { id: 4, label: 'Editor VFX', icon: '✨' },
                    { id: 5, label: 'Esporta', icon: '🎬' },
                ].map((s, index) => (
                    <div key={s.id} className="flex items-center gap-4">
                        <button 
                            onClick={() => setCurrentStep(s.id)}
                            className={`flex items-center gap-2 text-xs font-bold py-1.5 px-4 rounded-full transition-all ${
                                currentStep === s.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                            }`}
                        >
                            <span>{s.icon}</span>
                            {s.label}
                        </button>
                        {index < 4 && <div className="w-8 h-[1px] bg-zinc-800" />}
                    </div>
                ))}
            </div>

            {/* ═══ MAIN 3-COLUMN LAYOUT ═══ */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* ═══ LEFT: PANELS BY STEP ═══ */}
                <div className={`w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col overflow-y-auto flex-shrink-0 ${currentStep === 5 ? 'hidden' : ''}`}>
                    
                    {currentStep === 1 && (
                        <div className="p-4 space-y-6">
                            <h2 className="text-white font-bold text-sm">Passo 1: Scrivi il Testo</h2>
                            <textarea
                                rows={8}
                                value={headline}
                                onChange={e => setHeadline(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-purple-500 outline-none resize-none"
                                placeholder="Scrivi lo script..."
                            />
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">Stile Sottotitoli</label>
                                <select
                                    value={subtitleStyle}
                                    onChange={(e) => setSubtitleStyle(e.target.value as any)}
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-sm appearance-none focus:border-purple-500 outline-none cursor-pointer"
                                >
                                    <option value="impact">Impact (Bouncy & Giallo)</option>
                                    <option value="hormozi">⭐ Hormozi (Parola x Parola)</option>
                                    <option value="neon-word">💫 Neon (Parola x Parola)</option>
                                    <option value="minimal-word">➖ Minimal (Parola x Parola)</option>
                                    <option value="tiktok">TikTok (High Contrast)</option>
                                    <option value="karaoke">Karaoke (Verde/Hormozi)</option>
                                </select>
                            </div>
                            <button onClick={() => setCurrentStep(2)} className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold py-3 rounded-lg transition-colors">
                                Salva & Prosegui ➡️
                            </button>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="p-4 space-y-6">
                            <h2 className="text-white font-bold text-sm">Passo 2: Audio e Struttura AI</h2>
                            <p className="text-xs text-zinc-400">Clicca qui sotto per generare l'audio e l'infrastruttura di base (timing) tramite ElevenLabs e GPT-4o.</p>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">Voce ElevenLabs</label>
                                <select 
                                    value={selectedVoiceId} 
                                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-sm appearance-none focus:border-purple-500 outline-none cursor-pointer mb-4"
                                >
                                    <option value="WS1kH1PJ5Xqt3tTn5Suw">Antonio Valente</option>
                                    <option value="o5tUAYEqld5GJZ1Lv8uC">Dante</option>
                                    <option value="Xb7hH8WuIGAsOovEgwzZ">Voice - UK (Adam)</option>
                                    <option value="EXAVITQu4vr4xnSDxMaL">Voice - Bella</option>
                                    <option value="ErXwobaYiN019PkySvjV">Voice - Antoni</option>
                                    <option value="MF3mGyEYCl7XYWbV9V6O">Voice - Elli</option>
                                </select>
                            </div>

                            <button 
                                onClick={handleGenerate}
                                disabled={loading || renderJobId !== null}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? '⏳ Generazione in corso...' : '🎙️ Genera Audio e Struttura'}
                            </button>
                            {audioBase64 && (
                                <button onClick={() => setCurrentStep(3)} className="w-full border border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white text-sm font-bold py-3 rounded-lg transition-colors">
                                    Audio Generato! Prosegui ➡️
                                </button>
                            )}
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="p-4 space-y-6">
                            <h2 className="text-white font-bold text-sm">Passo 3: Video Avatar 3D</h2>
                            <p className="text-xs text-zinc-400">Se vuoi, puoi far presentare questo video da un avatar digitale.</p>
                            
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">Avatar HeyGen</label>
                                {loadingAvatars ? (
                                    <div className="text-xs text-zinc-500">Caricamento avatar...</div>
                                ) : (
                                    <select 
                                        value={selectedAvatarId} 
                                        onChange={(e) => setSelectedAvatarId(e.target.value)}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-sm appearance-none focus:border-purple-500 outline-none cursor-pointer"
                                    >
                                        {avatarList.map(avatar => (
                                            <option key={avatar.avatar_id} value={avatar.avatar_id}>
                                                {avatar.avatar_name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <button 
                                onClick={handleGenerateAvatar}
                                disabled={heygenStatus !== null || !audioBase64}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold py-3 rounded-lg transition-colors border border-zinc-700 disabled:opacity-50"
                            >
                                {heygenStatus ? '⏳ Rendering su HeyGen...' : (!audioBase64 ? '⚠️ Genera Audio Prima' : '🎥 Invia ad HeyGen')}
                            </button>
                            {heygenStatus && (
                                <p className="text-xs text-purple-400 mt-2 text-center font-mono">{heygenStatus}</p>
                            )}
                            
                            <button onClick={() => setCurrentStep(4)} className="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold py-3 rounded-lg transition-colors">
                                Prosegui all'Editor ➡️
                            </button>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <>
                            {/* Tab Switcher Widget / VFX */}
                            <div className="p-2 border-b border-zinc-800 flex gap-1">
                                <button
                                    onClick={() => setVfxTab('widgets')}
                                    className={`flex-1 text-[10px] uppercase tracking-widest font-bold py-2 px-3 rounded-lg transition-all ${
                                        vfxTab === 'widgets' ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                    }`}
                                >
                                    📦 Widget
                                </button>
                                <button
                                    onClick={() => setVfxTab('vfx')}
                                    className={`flex-1 text-[10px] uppercase tracking-widest font-bold py-2 px-3 rounded-lg transition-all ${
                                        vfxTab === 'vfx' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                    }`}
                                >
                                    ✨ VFX Pro
                                </button>
                            </div>

                            {vfxTab === 'widgets' && (
                                <>
                                    <div className="p-3 border-b border-zinc-800">
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Libreria Widget</span>
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
                                </>
                            )}

                            {vfxTab === 'vfx' && (
                                <>
                                    <div className="p-3 border-b border-zinc-800">
                                        <span className="text-[10px] uppercase tracking-widest font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">After Effects VFX</span>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        {VFX_CATALOG.map(vfx => (
                                            <button
                                                key={vfx.type}
                                                onClick={() => handleAddLayer(vfx as any)}
                                                className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-purple-500/30 transition-all text-left group"
                                            >
                                                <span className="text-lg">{vfx.icon}</span>
                                                <span className="text-xs font-medium text-zinc-300 group-hover:text-white flex-1">{vfx.label.replace(/^.{2} /, '')}</span>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: vfx.color }} />
                                                <Plus className="w-3 h-3 text-zinc-600 group-hover:text-pink-400 transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                    {/* VFX Pack info */}
                                    <div className="p-3 mt-2 mx-2 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                                        <p className="text-[10px] text-purple-300 font-medium">🎥 10 effetti cinematici professionali. Aggiungi alla timeline e personalizza dal pannello destro.</p>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* ═══ CENTER: VIDEO PREVIEW OR EXPORT PANEL ═══ */}
                <div className="flex-1 bg-zinc-900 flex flex-col items-center justify-center p-4">
                    {currentStep === 5 ? (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
                            <h2 className="text-white font-bold text-xl">Esporta Video</h2>
                            <p className="text-sm text-zinc-400">Tutti i livelli verranno calcolati alla massima risoluzione scelta per Instagram/TikTok.</p>
                            
                            {/* Export Settings */}
                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">Risoluzione</label>
                                    <select 
                                        value={exportQuality} 
                                        onChange={(e) => setExportQuality(e.target.value as any)}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500 cursor-pointer"
                                    >
                                        <option value="1080p">1080p (Full HD)</option>
                                        <option value="4k">4K (Ultra HD)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 block">Framerate</label>
                                    <select 
                                        value={exportFps} 
                                        onChange={(e) => setExportFps(Number(e.target.value) as any)}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500 cursor-pointer"
                                    >
                                        <option value={30}>30 FPS (Standard)</option>
                                        <option value={60}>60 FPS (Fluido)</option>
                                    </select>
                                </div>
                            </div>

                            <button 
                                onClick={handleExportMP4}
                                disabled={loading || renderJobId !== null || !audioBase64}
                                className="w-full bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-3 rounded-lg transition-colors disabled:opacity-50 h-12 flex justify-center items-center"
                            >
                                {renderProgress ? `🔄 Rendering in Corso: ${renderProgress}` : '🎬 Avvia Renderizzazione Finale'}
                            </button>

                            {renderUrl && (
                                <a href={renderUrl} target="_blank" download className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-3 rounded-lg transition-colors flex justify-center items-center gap-2">
                                    ⬇️ Scarica MP4 in 4K
                                </a>
                            )}
                            <button onClick={() => setCurrentStep(4)} className="text-zinc-500 hover:text-white text-xs underline mt-4">
                                Torna all'Editor
                            </button>
                        </div>
                    ) : (
                        <div className="relative" style={{ width: 360, height: 640 }}>
                            <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-zinc-700 relative">
                                {loading && (
                                    <div className="absolute inset-0 bg-black/80 z-[999] flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                                        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent flex-shrink-0 rounded-full animate-spin mb-4" />
                                        <h3 className="text-white font-bold mb-2">Generazione Audio AI...</h3>
                                        <p className="text-xs text-zinc-400">GPT-4o ed ElevenLabs stanno creando l'infrastruttura.</p>
                                    </div>
                                )}
                                {heygenStatus && (
                                    <div className="absolute inset-0 bg-black/80 z-[999] flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent flex-shrink-0 rounded-full animate-spin mb-4" />
                                        <h3 className="text-white font-bold mb-2">Renderizzazione Avatar 3D</h3>
                                        <p className="text-xs text-zinc-400">{heygenStatus}</p>
                                    </div>
                                )}
                                {audioBase64 ? (
                                    <VideoPlayerClient
                                        ref={playerRef}
                                        headline={headline}
                                        audioBase64={audioBase64}
                                        words={words}
                                        avatarVideoUrl={avatarVideoUrl || undefined}
                                        visualAssets={visualAssets}
                                        messageText={iosMessageText || undefined}
                                        useMoney={enableMoneyVFX}
                                        backgroundMood="warm-studio"
                                        subtitleStyle={subtitleStyle}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-zinc-950 flex flex-col items-center justify-center text-center p-8 gap-4">
                                        <Video className="w-12 h-12 text-zinc-600" />
                                        <p className="text-sm text-zinc-500">Premi <span className="text-purple-400 font-bold">"Genera Audio"</span> al Passo 2 per avviare il Player</p>
                                    </div>
                                )}
                            </div>
                            {currentStep === 4 && (
                                <div className="absolute -left-12 -right-12 -bottom-16 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] p-2 rounded-lg text-center backdrop-blur-md">
                                    <span className="font-bold block">💡 Info Posizionamento</span>
                                    Il drag & drop sul video è disabilitato da Remotion.<br/>
                                    Usa la colonna destra per scalare e posizionare.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══ RIGHT: PROPERTY PANEL ═══ */}
                <div className={`w-72 bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-y-auto flex-shrink-0 ${currentStep !== 4 ? 'hidden' : ''}`}>
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
                                <span className="text-lg">{(WIDGET_CATALOG.find(w => w.type === selectedLayer.type) || VFX_CATALOG.find(w => w.type === selectedLayer.type))?.icon || '⬛'}</span>
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

                            {/* Type-specific fields & Universal Transform */}
                            {[
                                ...(PROPERTY_FIELDS[selectedLayer.type] || []),
                                { label: 'Scala (Zoom)', key: 'scale', type: 'range' as const, min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
                                { label: 'Spaziatura Orizzontale (X)', key: 'xOffset', type: 'range' as const, min: -1080, max: 1080, step: 10, default: 0 },
                                { label: 'Spaziatura Verticale (Y)', key: 'yOffset', type: 'range' as const, min: -1920, max: 1920, step: 10, default: 0 },
                                { label: 'In Animazione', key: 'inAnim', type: 'select' as const, options: ['none', 'fade-in', 'slide-up', 'zoom-in', 'bounce'], default: 'none' },
                                { label: 'Out Animazione', key: 'outAnim', type: 'select' as const, options: ['none', 'fade-out', 'slide-right', 'zoom-out'], default: 'none' },
                                { label: 'Effetto Fisso (Idle)', key: 'idleAnim', type: 'select' as const, options: ['none', 'float', 'pulse', 'wiggle'], default: 'none' },
                                { label: 'Posizione (Z-Index)', key: 'layerOrder', type: 'select' as const, options: ['front', 'back'], default: 'front' }
                            ].map(field => {
                                const val = selectedLayer.props[field.key] !== undefined ? selectedLayer.props[field.key] : field.default;
                                return (
                                <div key={field.key}>
                                    <label className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">
                                        <span>{field.label}</span>
                                        {field.type === 'range' && (
                                            <span className="text-purple-400">{val}</span>
                                        )}
                                    </label>
                                    
                                    {field.type === 'text' && (
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={val || ''}
                                                onChange={e => handleUpdateProp(field.key, e.target.value)}
                                                className="w-full bg-black border border-zinc-800 rounded p-2 text-white text-xs focus:border-purple-500 outline-none pr-8"
                                                placeholder={field.key === 'query' ? 'Es. Donna che lavora al pc' : undefined}
                                            />
                                            {field.key === 'query' && ['b-roll', 'swipe-card'].includes(selectedLayer.type) && (
                                                <button 
                                                    onClick={() => handleGenerateImage(selectedLayer.id, val)}
                                                    disabled={generatingImageId === selectedLayer.id}
                                                    title="Genera Immagine con AI"
                                                    className="absolute right-1 top-1 bottom-1 px-2 flex items-center justify-center bg-purple-600/80 hover:bg-purple-500 text-white rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                >
                                                    {generatingImageId === selectedLayer.id ? (
                                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : '✨'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {field.type === 'number' && (
                                        <input
                                            type="number"
                                            value={val || 0}
                                            onChange={e => handleUpdateProp(field.key, Number(e.target.value))}
                                            className="w-full bg-black border border-zinc-800 rounded p-2 text-white text-xs"
                                        />
                                    )}
                                    {field.type === 'select' && (
                                        <select
                                            value={val || ''}
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
                                                value={val || '#ffffff'}
                                                onChange={e => handleUpdateProp(field.key, e.target.value)}
                                                className="w-8 h-8 rounded cursor-pointer border-none"
                                            />
                                            <input
                                                type="text"
                                                value={val || ''}
                                                onChange={e => handleUpdateProp(field.key, e.target.value)}
                                                className="flex-1 bg-black border border-zinc-800 rounded p-2 text-white text-xs"
                                            />
                                        </div>
                                    )}
                                    {field.type === 'range' && (
                                        <div className="pt-2 pb-1">
                                            <input
                                                type="range"
                                                min={field.min}
                                                max={field.max}
                                                step={field.step}
                                                value={val}
                                                onChange={e => handleUpdateProp(field.key, Number(e.target.value))}
                                                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            )})}

                            {/* Delete button */}
                            <button
                                onClick={() => handleDeleteLayer(selectedLayer.id)}
                                className="w-full mt-4 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Elimina Layer
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 space-y-6">
                            <div className="flex flex-col items-center justify-center text-center gap-3 text-zinc-500 border-b border-zinc-800 pb-6 border-dashed">
                                <Layers className="w-8 h-8 opacity-50" />
                                <p className="text-xs">Seleziona un layer o modificane le impostazioni globali qui sotto</p>
                            </div>
                            
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 flex items-center justify-between">
                                    <span>✂️ Fine Video (Durata Totale)</span>
                                    {!customDurationMs && <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[8px] text-zinc-400">Automatica</span>}
                                    {customDurationMs && <span className="bg-purple-600/20 text-purple-400 px-1.5 py-0.5 rounded text-[8px]">Manuale</span>}
                                </label>
                                <p className="text-[10px] text-zinc-400 mb-3 leading-relaxed">
                                    Il video termina automaticamente appena finiscono l'audio o le animazioni <b>({Math.round(durationMs / 100) / 10} sec)</b>.<br/> 
                                    Per tagliarlo prima, o estenderlo nel vuoto stile CapCut, sovrascrivi la durata in millisecondi (es. 15000 = 15s):
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={customDurationMs || ''}
                                        placeholder={`Es. ${durationMs}`}
                                        onChange={e => setCustomDurationMs(e.target.value ? Number(e.target.value) : null)}
                                        className="flex-1 bg-black border border-zinc-800 rounded p-2 text-white text-xs focus:border-purple-500 outline-none placeholder:text-zinc-600"
                                        step={100}
                                        min={1000}
                                    />
                                    <button 
                                        onClick={() => setCustomDurationMs(null)}
                                        disabled={!customDurationMs}
                                        className="px-3 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                                        title="Ripristina su base audio"
                                    >
                                        Auto
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ BOTTOM: TIMELINE ═══ */}
            <div className="h-48 bg-zinc-950 border-t border-zinc-800 flex flex-col flex-shrink-0 relative">
                
                {/* PLAYHEAD & SCRUBBER OVERLAY */}
                <div 
                    className="absolute top-10 bottom-0 left-[144px] right-4 z-50 cursor-text"
                    onClick={handleTimelineClick}
                >
                    <div 
                        ref={playheadUiRef}
                        data-duration={durationInFrames}
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] pointer-events-none flex flex-col items-center"
                        style={{ left: `0%` }}
                    >
                        {/* Timecode Box CapCut Style */}
                        <div 
                            ref={timecodeUiRef}
                            className="bg-red-500 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-lg -translate-y-6 select-none whitespace-nowrap"
                        >
                            00:00.0
                        </div>
                        <div className="absolute top-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                    </div>
                </div>

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
                                    const cat = WIDGET_CATALOG.find(w => w.type === layer.type) || VFX_CATALOG.find(w => w.type === layer.type);
                                    return (
                                        <SortableLayerRow 
                                            key={layer.id} 
                                            layer={layer} 
                                            durationMs={durationMs}
                                            isSelected={selectedLayerId === layer.id}
                                            onSelect={() => setSelectedLayerId(layer.id)}
                                            onUpdate={(updates) => dispatch({ type: 'UPDATE', id: layer.id, updates })}
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
