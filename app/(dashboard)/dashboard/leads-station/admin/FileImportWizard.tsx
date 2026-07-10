'use client'

import { useState, useCallback, useRef } from 'react'
import { X, Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
    onClose: () => void
}

type Step = 1 | 2 | 3 | 4

export default function FileImportWizard({ onClose }: Props) {
    const [step, setStep] = useState<Step>(1)
    const [file, setFile] = useState<File | null>(null)
    const [listName, setListName] = useState('')
    const [tags, setTags] = useState('')
    const [isDragging, setIsDragging] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const dropped = e.dataTransfer.files[0]
        if (dropped) {
            setFile(dropped)
            setListName(dropped.name.replace(/\.[^.]+$/, ''))
            setStep(2)
        }
    }, [])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0]
        if (selected) {
            setFile(selected)
            setListName(selected.name.replace(/\.[^.]+$/, ''))
            setStep(2)
        }
    }

    const handleImport = async () => {
        if (!file) return
        setIsLoading(true)
        setError(null)
        setStep(3)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('list_name', listName || file.name)
        if (tags) formData.append('tags', tags)

        try {
            const res = await fetch('/api/leads-pool/import', {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Errore durante l\'importazione')
                setStep(2)
            } else {
                setResult(data)
                setStep(4)
            }
        } catch {
            setError('Errore di rete. Riprova.')
            setStep(2)
        } finally {
            setIsLoading(false)
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const STEPS = [
        { n: 1, label: 'Carica file' },
        { n: 2, label: 'Configura' },
        { n: 3, label: 'Importa' },
        { n: 4, label: 'Completato' },
    ]

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                width: '560px', maxWidth: '95vw',
                background: 'var(--color-surface-0)',
                borderRadius: '20px',
                border: '1px solid var(--color-surface-200)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--color-surface-200)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <h2 className="font-bold" style={{ color: 'var(--color-surface-900)' }}>
                            📥 Importa Nuova Lista Leads
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-surface-500)' }}>
                            Supporta CSV, XLSX, JSON
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-surface-500)' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step indicators */}
                <div style={{ padding: '16px 24px 0', display: 'flex', gap: '0', position: 'relative' }}>
                    {STEPS.map((s, i) => (
                        <div key={s.n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            {i < STEPS.length - 1 && (
                                <div style={{
                                    position: 'absolute', top: '12px', left: '50%', right: '-50%',
                                    height: '2px',
                                    background: step > s.n ? '#a855f7' : 'var(--color-surface-200)',
                                    transition: 'background 0.3s',
                                }} />
                            )}
                            <div style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: '700', zIndex: 1,
                                background: step > s.n ? '#a855f7' : step === s.n ? '#7c3aed' : 'var(--color-surface-200)',
                                color: step >= s.n ? 'white' : 'var(--color-surface-500)',
                                transition: 'all 0.3s',
                            }}>
                                {step > s.n ? <Check className="w-3 h-3" /> : s.n}
                            </div>
                            <span style={{
                                fontSize: '10px', marginTop: '4px', textAlign: 'center',
                                color: step === s.n ? '#a855f7' : 'var(--color-surface-400)',
                                fontWeight: step === s.n ? '600' : '400',
                            }}>
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                    {/* Step 1: Drop file */}
                    {step === 1 && (
                        <div
                            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: `2px dashed ${isDragging ? '#a855f7' : 'var(--color-surface-300)'}`,
                                borderRadius: '16px',
                                padding: '48px 24px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: isDragging ? 'rgba(168,85,247,0.05)' : 'var(--color-surface-50)',
                                transition: 'all 0.2s',
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls,.json"
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />
                            <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: isDragging ? '#a855f7' : 'var(--color-surface-400)' }} />
                            <p className="font-semibold mb-1" style={{ color: 'var(--color-surface-700)' }}>
                                Trascina il file qui o clicca per selezionarlo
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-surface-500)' }}>
                                Formati supportati: CSV, Excel (.xlsx/.xls), JSON
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-surface-400)' }}>
                                Max 50.000 righe per import
                            </p>
                        </div>
                    )}

                    {/* Step 2: Configure */}
                    {step === 2 && file && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* File info */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 14px', borderRadius: '12px',
                                background: 'var(--color-surface-100)',
                                border: '1px solid var(--color-surface-200)',
                            }}>
                                <FileText className="w-5 h-5" style={{ color: '#a855f7', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-surface-900)' }}>{file.name}</div>
                                    <div className="text-xs" style={{ color: 'var(--color-surface-500)' }}>{formatFileSize(file.size)}</div>
                                </div>
                                <button
                                    onClick={() => { setFile(null); setStep(1) }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-surface-400)' }}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* List name */}
                            <div>
                                <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--color-surface-600)' }}>
                                    Nome lista *
                                </label>
                                <input
                                    type="text"
                                    value={listName}
                                    onChange={e => setListName(e.target.value)}
                                    placeholder="Es. Lista Luglio 2026 — Metodo Sincro"
                                    style={{
                                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                                        fontSize: '13px',
                                        background: 'var(--color-surface-100)',
                                        border: '1px solid var(--color-surface-300)',
                                        color: 'var(--color-surface-900)',
                                        outline: 'none', fontFamily: 'inherit',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--color-surface-600)' }}>
                                    Tag (opzionali, separati da virgola)
                                </label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={e => setTags(e.target.value)}
                                    placeholder="Es. luglio2026, cold, meta-ads"
                                    style={{
                                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                                        fontSize: '13px',
                                        background: 'var(--color-surface-100)',
                                        border: '1px solid var(--color-surface-300)',
                                        color: 'var(--color-surface-900)',
                                        outline: 'none', fontFamily: 'inherit',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* Column mapping note */}
                            <div style={{
                                padding: '12px', borderRadius: '10px',
                                background: 'rgba(59,130,246,0.08)',
                                border: '1px solid rgba(59,130,246,0.2)',
                                fontSize: '12px', color: '#3b82f6', lineHeight: '1.5',
                            }}>
                                ℹ️ Il sistema riconosce automaticamente le colonne: <strong>nome, cognome, telefono, email, città, provincia, età</strong> (anche in inglese).
                                Tutti gli altri campi vengono salvati nei dati grezzi.
                            </div>

                            {error && (
                                <div style={{
                                    padding: '10px 12px', borderRadius: '10px',
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                    color: '#ef4444', fontSize: '12px',
                                    display: 'flex', gap: '8px', alignItems: 'flex-start',
                                }}>
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
                                </div>
                            )}

                            <button
                                onClick={handleImport}
                                disabled={!listName.trim()}
                                style={{
                                    width: '100%', padding: '12px',
                                    borderRadius: '12px', fontSize: '14px', fontWeight: '600',
                                    background: !listName.trim() ? 'var(--color-surface-200)' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                                    color: !listName.trim() ? 'var(--color-surface-500)' : 'white',
                                    border: 'none', cursor: !listName.trim() ? 'not-allowed' : 'pointer',
                                    boxShadow: !listName.trim() ? 'none' : '0 4px 14px rgba(168,85,247,0.35)',
                                    marginTop: '4px',
                                }}
                            >
                                Avvia Importazione →
                            </button>
                        </div>
                    )}

                    {/* Step 3: Loading */}
                    {step === 3 && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: '#a855f7' }} />
                            <p className="font-semibold" style={{ color: 'var(--color-surface-700)' }}>Importazione in corso...</p>
                            <p className="text-xs mt-2" style={{ color: 'var(--color-surface-500)' }}>
                                Parsing del file, mapping colonne e inserimento nel pool...
                            </p>
                        </div>
                    )}

                    {/* Step 4: Success */}
                    {step === 4 && result && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%',
                                background: 'rgba(34,197,94,0.1)', border: '2px solid #22c55e',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px',
                            }}>
                                <Check className="w-6 h-6" style={{ color: '#22c55e' }} />
                            </div>
                            <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--color-surface-900)' }}>
                                Importazione completata!
                            </h3>

                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '20px 0' }}>
                                {[
                                    { label: 'Leads importati', value: result.inserted, color: '#22c55e' },
                                    { label: 'Righe nel file', value: result.parsed_rows, color: '#3b82f6' },
                                    { label: 'Righe saltate', value: result.skipped || 0, color: '#f59e0b' },
                                ].map((s, i) => (
                                    <div key={i} style={{
                                        padding: '12px', borderRadius: '10px',
                                        background: 'var(--color-surface-100)',
                                    }}>
                                        <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-surface-500)', marginTop: '2px' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Preview */}
                            {result.preview?.length > 0 && (
                                <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-surface-600)' }}>
                                        Anteprima prime righe importate:
                                    </p>
                                    {result.preview.map((p: any, i: number) => (
                                        <div key={i} style={{
                                            padding: '8px 10px', borderRadius: '8px',
                                            background: 'var(--color-surface-50)',
                                            border: '1px solid var(--color-surface-200)',
                                            marginBottom: '4px', fontSize: '12px',
                                            color: 'var(--color-surface-700)',
                                        }}>
                                            <strong>{p.full_name || '—'}</strong>
                                            {p.phone && ` · 📱 ${p.phone}`}
                                            {p.city && ` · 📍 ${p.city}`}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {result.errors?.length > 0 && (
                                <div style={{
                                    padding: '10px', borderRadius: '8px',
                                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                                    fontSize: '11px', color: '#f59e0b', textAlign: 'left', marginBottom: '16px',
                                }}>
                                    ⚠️ Alcuni batch con errori: {result.errors.join(', ')}
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                style={{
                                    width: '100%', padding: '12px',
                                    borderRadius: '12px', fontSize: '14px', fontWeight: '600',
                                    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                                    color: 'white', border: 'none', cursor: 'pointer',
                                }}
                            >
                                ✅ Chiudi e aggiorna
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
