'use client'

/**
 * Reusable skeleton components for dashboard loading states.
 * Used by loading.tsx files in each route to show instant feedback while data loads.
 */

export function SkeletonPulse({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <div
            className={`animate-pulse rounded-xl ${className}`}
            style={{ background: 'var(--color-surface-200)', ...style }}
        />
    )
}

export function SkeletonCard({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
    return (
        <div className={`glass-card p-5 ${className}`}>
            {children}
        </div>
    )
}

export function SkeletonHeader() {
    return (
        <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
                <SkeletonPulse className="h-7 w-64 mb-2" />
                <SkeletonPulse className="h-4 w-40" />
            </div>
            <SkeletonPulse className="h-9 w-48 rounded-xl" />
        </div>
    )
}

export function SkeletonMetricGrid({ count = 4 }: { count?: number }) {
    return (
        <div className={`grid grid-cols-2 md:grid-cols-${Math.min(count, 4)} lg:grid-cols-${count} gap-3`}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i}>
                    <div className="flex items-center gap-2 mb-3">
                        <SkeletonPulse className="w-6 h-6 rounded-md" />
                        <SkeletonPulse className="h-3 w-16" />
                    </div>
                    <SkeletonPulse className="h-7 w-20" />
                </SkeletonCard>
            ))}
        </div>
    )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <SkeletonCard>
            <div className="flex items-center gap-2 mb-5">
                <SkeletonPulse className="w-5 h-5 rounded-md" />
                <SkeletonPulse className="h-5 w-40" />
            </div>
            <div className="space-y-3">
                {/* Header row */}
                <div className="flex gap-4 pb-3" style={{ borderBottom: '1px solid var(--color-surface-200)' }}>
                    {Array.from({ length: cols }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-3 flex-1" />
                    ))}
                </div>
                {/* Data rows */}
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                        {Array.from({ length: cols }).map((_, j) => (
                            <SkeletonPulse
                                key={j}
                                className="h-4 flex-1"
                                style={{ opacity: 1 - (i * 0.12) }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </SkeletonCard>
    )
}

export function SkeletonPipeline({ stages = 6 }: { stages?: number }) {
    return (
        <SkeletonCard>
            <div className="flex items-center gap-2 mb-5">
                <SkeletonPulse className="w-5 h-5 rounded-md" />
                <SkeletonPulse className="h-5 w-52" />
            </div>
            <div className="space-y-3">
                {Array.from({ length: stages }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <SkeletonPulse className="w-24 h-4" />
                        <div className="flex-1 h-7 rounded-lg overflow-hidden" style={{ background: 'var(--color-surface-200)' }}>
                            <SkeletonPulse
                                className="h-full rounded-lg"
                                style={{
                                    width: `${Math.max(90 - i * 15, 8)}%`,
                                    background: 'var(--color-surface-300)',
                                }}
                            />
                        </div>
                        <SkeletonPulse className="w-10 h-4" />
                    </div>
                ))}
            </div>
        </SkeletonCard>
    )
}

export function SkeletonKanban({ columns = 5 }: { columns?: number }) {
    return (
        <div className="flex gap-3 overflow-x-auto pb-4">
            {Array.from({ length: columns }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-72">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <SkeletonPulse className="w-3 h-3 rounded-full" />
                        <SkeletonPulse className="h-4 w-24" />
                        <SkeletonPulse className="h-5 w-6 rounded-full" />
                    </div>
                    <div className="space-y-2">
                        {Array.from({ length: Math.max(3 - i, 1) }).map((_, j) => (
                            <SkeletonCard key={j} className="!p-4">
                                <SkeletonPulse className="h-4 w-32 mb-2" />
                                <SkeletonPulse className="h-3 w-24 mb-3" />
                                <div className="flex gap-2">
                                    <SkeletonPulse className="h-5 w-14 rounded-full" />
                                    <SkeletonPulse className="h-5 w-14 rounded-full" />
                                </div>
                            </SkeletonCard>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

export function SkeletonConnectionCards({ count = 4 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} className="!p-5">
                    <div className="flex items-center gap-4">
                        <SkeletonPulse className="w-11 h-11 rounded-xl" />
                        <div className="flex-1">
                            <SkeletonPulse className="h-4 w-28 mb-2" />
                            <SkeletonPulse className="h-3 w-48" />
                        </div>
                        <SkeletonPulse className="h-6 w-20 rounded-full" />
                    </div>
                </SkeletonCard>
            ))}
        </div>
    )
}

// Pre-built page skeletons for each dashboard page

export function DashboardPageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <SkeletonHeader />
            <SkeletonMetricGrid count={7} />
            <SkeletonCard>
                <div className="flex items-center gap-2 mb-4">
                    <SkeletonPulse className="w-8 h-8 rounded-lg" />
                    <SkeletonPulse className="h-5 w-28" />
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-10 w-full" />
                    ))}
                </div>
            </SkeletonCard>
            <SkeletonPipeline />
        </div>
    )
}

export function CRMPageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <SkeletonPulse className="w-6 h-6 rounded-md" />
                    <SkeletonPulse className="h-7 w-36" />
                </div>
                <div className="flex gap-2">
                    <SkeletonPulse className="h-9 w-28 rounded-xl" />
                    <SkeletonPulse className="h-9 w-28 rounded-xl" />
                </div>
            </div>
            <SkeletonKanban columns={5} />
        </div>
    )
}

export function AdsPageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <SkeletonPulse className="w-6 h-6 rounded-md" />
                <SkeletonPulse className="h-7 w-24" />
            </div>
            <SkeletonMetricGrid count={4} />
            <SkeletonTable rows={6} cols={5} />
        </div>
    )
}

export function FunnelsPageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <SkeletonPulse className="w-6 h-6 rounded-md" />
                    <SkeletonPulse className="h-7 w-28" />
                </div>
                <SkeletonPulse className="h-9 w-36 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonCard key={i}>
                        <SkeletonPulse className="h-5 w-36 mb-3" />
                        <SkeletonPulse className="h-3 w-48 mb-4" />
                        <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                                <SkeletonPulse className="h-6 w-12 mx-auto mb-1" />
                                <SkeletonPulse className="h-3 w-10 mx-auto" />
                            </div>
                            <div className="text-center">
                                <SkeletonPulse className="h-6 w-12 mx-auto mb-1" />
                                <SkeletonPulse className="h-3 w-10 mx-auto" />
                            </div>
                            <div className="text-center">
                                <SkeletonPulse className="h-6 w-12 mx-auto mb-1" />
                                <SkeletonPulse className="h-3 w-10 mx-auto" />
                            </div>
                        </div>
                    </SkeletonCard>
                ))}
            </div>
        </div>
    )
}

export function AIEnginePageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <SkeletonPulse className="w-6 h-6 rounded-md" />
                <SkeletonPulse className="h-7 w-44" />
            </div>
            <SkeletonMetricGrid count={4} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SkeletonTable rows={4} cols={3} />
                <SkeletonTable rows={4} cols={3} />
            </div>
        </div>
    )
}

export function AnalyticsPageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <SkeletonHeader />
            <SkeletonMetricGrid count={5} />
            <SkeletonCard>
                <SkeletonPulse className="h-5 w-36 mb-4" />
                <SkeletonPulse className="h-64 w-full rounded-xl" />
            </SkeletonCard>
            <SkeletonTable rows={5} cols={5} />
        </div>
    )
}

export function OperationsPageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <SkeletonPulse className="w-6 h-6 rounded-md" />
                <SkeletonPulse className="h-7 w-32" />
            </div>
            <SkeletonTable rows={8} cols={4} />
        </div>
    )
}

export function SettingsPageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
                <SkeletonPulse className="w-6 h-6 rounded-md" />
                <SkeletonPulse className="h-7 w-36" />
            </div>
            <SkeletonCard>
                <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i}>
                            <SkeletonPulse className="h-3 w-24 mb-2" />
                            <SkeletonPulse className="h-10 w-full rounded-xl" />
                        </div>
                    ))}
                </div>
            </SkeletonCard>
        </div>
    )
}

export function TeamPageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <SkeletonPulse className="w-6 h-6 rounded-md" />
                    <SkeletonPulse className="h-7 w-20" />
                </div>
                <SkeletonPulse className="h-9 w-36 rounded-xl" />
            </div>
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonCard key={i} className="!p-4">
                        <div className="flex items-center gap-4">
                            <SkeletonPulse className="w-10 h-10 rounded-full" />
                            <div className="flex-1">
                                <SkeletonPulse className="h-4 w-32 mb-2" />
                                <SkeletonPulse className="h-3 w-48" />
                            </div>
                            <SkeletonPulse className="h-6 w-16 rounded-full" />
                        </div>
                    </SkeletonCard>
                ))}
            </div>
        </div>
    )
}

export function ConnectionsPageSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <SkeletonPulse className="w-6 h-6 rounded-md" />
                    <SkeletonPulse className="h-7 w-32" />
                </div>
                <SkeletonPulse className="h-4 w-72 mt-2" />
            </div>
            <SkeletonCard className="animate-pulse-glow">
                <div className="flex items-start gap-3">
                    <SkeletonPulse className="w-5 h-5 rounded-md" />
                    <div className="flex-1">
                        <SkeletonPulse className="h-4 w-48 mb-2" />
                        <SkeletonPulse className="h-3 w-full" />
                    </div>
                </div>
            </SkeletonCard>
            <SkeletonConnectionCards count={5} />
        </div>
    )
}
