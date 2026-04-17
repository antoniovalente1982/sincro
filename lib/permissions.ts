// ============================================================
// Permissions System — Matrice Ruoli / Sezioni / Azioni
// ============================================================

export type Role = 'owner' | 'admin' | 'manager' | 'setter' | 'closer' | 'coach' | 'viewer'
export type Department = 'marketing' | 'setting' | 'sales' | 'coaching' | 'admin' | 'it' | null

// ── Sezioni visibili nella sidebar ──
export type Section =
    | 'dashboard'
    | 'crm'
    | 'calendar'
    | 'funnels'
    | 'ads'
    | 'ai_engine'
    | 'creative_studio'
    | 'operations'
    | 'analytics'
    | 'team'
    | 'connections'
    | 'settings'

const SECTION_ACCESS: Record<Section, Role[]> = {
    dashboard:      ['owner', 'admin', 'manager', 'coach', 'viewer'],
    crm:            ['owner', 'admin', 'manager', 'setter', 'closer', 'coach', 'viewer'],
    calendar:       ['owner', 'admin', 'manager', 'setter', 'closer', 'coach'],
    funnels:        ['owner', 'admin', 'manager'],
    ads:            ['owner', 'admin', 'manager'],
    ai_engine:      ['owner', 'admin', 'manager'],
    creative_studio:['owner', 'admin', 'manager'],
    operations:     ['owner', 'admin', 'manager'],
    analytics:      ['owner', 'admin', 'manager', 'coach', 'viewer'],
    team:           ['owner', 'admin'],
    connections:    ['owner', 'admin'],
    settings:       ['owner', 'admin', 'manager', 'setter', 'closer', 'coach', 'viewer'],
}

// Manager access is further restricted by department
const MANAGER_SECTION_BY_DEPT: Record<string, Section[]> = {
    marketing: ['dashboard', 'crm', 'calendar', 'funnels', 'ads', 'ai_engine', 'creative_studio', 'operations', 'analytics', 'settings'],
    setting:   ['dashboard', 'crm', 'calendar', 'analytics', 'settings'],
    sales:     ['dashboard', 'crm', 'calendar', 'analytics', 'settings'],
    coaching:  ['dashboard', 'crm', 'calendar', 'analytics', 'settings'],
    admin:     ['dashboard', 'analytics', 'settings'],
    it:        ['dashboard', 'crm', 'calendar', 'funnels', 'ads', 'ai_engine', 'creative_studio', 'operations', 'analytics', 'team', 'connections', 'settings'],
}

// Map href to section
const HREF_TO_SECTION: Record<string, Section> = {
    '/dashboard':                     'dashboard',
    '/dashboard/crm':                 'crm',
    '/dashboard/calendar':            'calendar',
    '/dashboard/funnels':             'funnels',
    '/dashboard/ads':                 'ads',
    '/dashboard/ai-engine':           'ai_engine',
    '/dashboard/ai-engine/creative-studio': 'creative_studio',
    '/dashboard/operations':          'operations',
    '/dashboard/analytics':           'analytics',
    '/dashboard/team':                'team',
    '/dashboard/connections':         'connections',
    '/dashboard/settings':            'settings',
}

export function hrefToSection(href: string): Section | null {
    return HREF_TO_SECTION[href] || null
}

// ── Can this role see this section? ──
export function canAccessSection(role: Role, department: Department, section: Section): boolean {
    // Owner and admin see everything
    if (role === 'owner' || role === 'admin') return true

    // Manager: check department restrictions
    if (role === 'manager') {
        const dept = department || 'it' // fallback
        const allowed = MANAGER_SECTION_BY_DEPT[dept] || []
        return allowed.includes(section)
    }

    // Other roles: check the base matrix
    return SECTION_ACCESS[section]?.includes(role) ?? false
}

// ── Filter nav items for role ──
export function filterNavItems(
    navItems: { href: string; label: string; icon: any }[],
    role: Role,
    department: Department
): typeof navItems {
    return navItems.filter(item => {
        const section = hrefToSection(item.href)
        if (!section) return true // unknown sections: show to owner/admin only
        return canAccessSection(role, department, section)
    })
}


// ============================================================
// CRM Permissions — granular per-stage move rules
// ============================================================

export type CrmAction = 'view_all' | 'view_own' | 'move_to_appointment' | 'move_from_appointment' | 'edit_lead' | 'delete_lead' | 'drag_drop'

// Stage slug -> zone mapping
// Setter zone:  lead stages before appointment
// Closer zone:  appointment and beyond
export function getStageZone(stageSlug: string, isWon?: boolean, isLost?: boolean): 'setter' | 'closer' {
    const setterSlugs = ['nuovo', 'lead', 'new', 'contattato', 'contacted', 'qualificato', 'qualified']
    if (setterSlugs.includes(stageSlug.toLowerCase())) return 'setter'
    return 'closer'
}

// Can this user move a lead FROM one stage TO another?
export function canMoveLead(
    role: Role, 
    department: Department,
    fromStageSlug: string, 
    toStageSlug: string,
    fromIsWon?: boolean,
    toIsWon?: boolean,
    fromIsLost?: boolean,
    toIsLost?: boolean
): boolean {
    // Owner and admin can move anything
    if (role === 'owner' || role === 'admin') return true

    // Manager can move anything in their domain
    if (role === 'manager') return true

    // Setter: can only move within setter zone OR from setter zone to first closer stage (appointment)
    if (role === 'setter') {
        const fromZone = getStageZone(fromStageSlug, fromIsWon, fromIsLost)
        const toZone = getStageZone(toStageSlug, toIsWon, toIsLost)
        
        // Setter can move within setter zone
        if (fromZone === 'setter') return true
        // Setter cannot move in closer zone
        return false
    }

    // Closer: can only move within closer zone
    if (role === 'closer') {
        const fromZone = getStageZone(fromStageSlug, fromIsWon, fromIsLost)
        // Closer can move from appointment onwards
        if (fromZone === 'closer') return true
        return false
    }

    // Coach, viewer, marketing: no moves
    return false
}

// Can this user view all leads or just their own?
export function canViewAllLeads(role: Role, department: Department): boolean {
    if (role === 'owner' || role === 'admin') return true
    if (role === 'manager') return true
    if (role === 'coach' || role === 'viewer') return true // read-only but see all
    // Marketing managers see all (read-only implied by canEditLead check)
    if (department === 'marketing') return true
    return false
}

// Can this user edit lead data?
export function canEditLead(role: Role, department: Department): boolean {
    if (role === 'owner' || role === 'admin' || role === 'manager') return true
    if (role === 'setter' || role === 'closer') return true // own leads
    return false
}

// Can this user delete leads?
export function canDeleteLead(role: Role): boolean {
    return role === 'owner' || role === 'admin'
}

// Is this user read-only in CRM?
export function isCrmReadOnly(role: Role, department: Department): boolean {
    if (role === 'coach' || role === 'viewer') return true
    if (role === 'manager' && department === 'marketing') return false // marketing managers CAN edit
    return false
}

// Should CRM filter to show only user's assigned leads?
// Disabled: everyone sees all leads, use setter/closer filters to narrow down
export function shouldFilterOwnLeads(role: Role): boolean {
    return false
}


// ============================================================
// Role configuration for UI
// ============================================================

export const ROLE_CONFIG: Record<Role, { label: string; color: string; description: string }> = {
    owner:   { label: 'Owner',        color: '#f59e0b', description: 'Accesso completo a tutto il sistema' },
    admin:   { label: 'Admin',        color: '#8b5cf6', description: 'Accesso completo, gestione team' },
    manager: { label: 'Responsabile', color: '#ec4899', description: 'Responsabile di reparto' },
    setter:  { label: 'Setter',       color: '#3b82f6', description: 'Gestione lead e prenotazione app' },
    closer:  { label: 'Closer',       color: '#22c55e', description: 'Gestione vendite e appuntamenti' },
    coach:   { label: 'Coach',        color: '#f97316', description: 'Visualizzazione CRM e clienti' },
    viewer:  { label: 'Viewer',       color: '#71717a', description: 'Solo visualizzazione' },
}

export const DEPARTMENT_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
    marketing: { label: 'Marketing & Ads',   emoji: '🎯', color: '#a855f7' },
    setting:   { label: 'Setting',           emoji: '📞', color: '#3b82f6' },
    sales:     { label: 'Sales / Closing',   emoji: '💰', color: '#22c55e' },
    coaching:  { label: 'Coaching',          emoji: '🏋️', color: '#f97316' },
    admin:     { label: 'Amministrazione',   emoji: '📊', color: '#71717a' },
    it:        { label: 'IT / Tech',         emoji: '🛠️', color: '#06b6d4' },
}

export const ALL_ROLES: Role[] = ['owner', 'admin', 'manager', 'setter', 'closer', 'coach', 'viewer']
export const INVITABLE_ROLES: Role[] = ['admin', 'manager', 'setter', 'closer', 'coach', 'viewer']
export const ALL_DEPARTMENTS = Object.keys(DEPARTMENT_CONFIG)
