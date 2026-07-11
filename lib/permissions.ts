// ============================================================
// Permissions System — Matrice Ruoli / Sezioni / Azioni
// ============================================================

export type Role = 'owner' | 'admin' | 'manager' | 'closer' | 'coach' | 'viewer'
export type Department = 'marketing' | 'sales' | 'coaching' | 'admin' | 'it' | null

// ── Sezioni visibili nella sidebar ──
export type Section =
    | 'dashboard'
    | 'crm'
    | 'arena'
    | 'sales'
    | 'leads_station'
    | 'calendar'
    | 'funnels'
    | 'operations'
    | 'analytics'
    | 'team'
    | 'connections'
    | 'settings'

const SECTION_ACCESS: Record<Section, Role[]> = {
    dashboard:      ['owner', 'admin', 'manager', 'coach', 'viewer'],
    crm:            ['owner', 'admin', 'manager', 'closer', 'coach', 'viewer'],
    arena:          ['owner', 'admin', 'manager'],
    sales:          ['owner', 'admin', 'manager', 'closer', 'coach', 'viewer'],
    leads_station:  ['owner', 'admin', 'manager', 'closer'],
    calendar:       ['owner', 'admin', 'manager', 'closer', 'coach'],
    funnels:        ['owner', 'admin', 'manager'],
    operations:     ['owner', 'admin', 'manager'],
    analytics:      ['owner', 'admin', 'manager', 'coach', 'viewer'],
    team:           ['owner', 'admin'],
    connections:    ['owner', 'admin'],
    settings:       ['owner', 'admin', 'manager', 'closer', 'coach', 'viewer'],
}

// Manager access is further restricted by department
const MANAGER_SECTION_BY_DEPT: Record<string, Section[]> = {
    marketing: ['dashboard', 'crm', 'arena', 'sales', 'leads_station', 'calendar', 'funnels', 'operations', 'analytics', 'settings'],
    sales:     ['dashboard', 'crm', 'arena', 'sales', 'leads_station', 'calendar', 'analytics', 'settings'],
    coaching:  ['dashboard', 'crm', 'sales', 'leads_station', 'calendar', 'analytics', 'settings'],
    admin:     ['dashboard', 'crm', 'sales', 'leads_station', 'calendar', 'analytics', 'settings'],
    it:        ['dashboard', 'crm', 'arena', 'sales', 'leads_station', 'calendar', 'funnels', 'operations', 'analytics', 'team', 'connections', 'settings'],
}

// Map href to section
const HREF_TO_SECTION: Record<string, Section> = {
    '/dashboard':                     'dashboard',
    '/dashboard/crm':                 'crm',
    '/dashboard/crm/arena':           'arena',
    '/dashboard/sales':               'sales',
    '/dashboard/leads-station':       'leads_station',
    '/dashboard/calendar':            'calendar',
    '/dashboard/funnels':             'funnels',
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
    let canAccess = SECTION_ACCESS[section]?.includes(role) ?? false

    // Amministrazione override for CRM and Calendar
    if (department === 'admin' && (section === 'crm' || section === 'calendar')) {
        canAccess = true
    }

    return canAccess
}

// ── Filter nav items for role ──
export function filterNavItems(
    navItems: { href: string; label: string; icon: any }[],
    role: Role,
    department: Department
): typeof navItems {
    return navItems.filter(item => {
        const section = hrefToSection(item.href)
        if (!section) return role === 'owner' || role === 'admin'
        return canAccessSection(role, department, section)
    })
}


// ============================================================
// CRM Permissions — granular per-stage move rules
// ============================================================

export type CrmAction = 'view_all' | 'view_own' | 'move_to_appointment' | 'move_from_appointment' | 'edit_lead' | 'delete_lead' | 'drag_drop'

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

    // Closer (Venditore): can move leads across all stages
    if (role === 'closer') return true

    // Amministrazione can move leads to book appointments
    if (department === 'admin') return true

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
    if (role === 'closer') return true // own leads
    if (department === 'admin') return true // Amministrazione can book appointments
    return false
}

// Can this user delete leads?
export function canDeleteLead(role: Role): boolean {
    return role === 'owner' || role === 'admin' || role === 'manager'
}

// Is this user read-only in CRM?
export function isCrmReadOnly(role: Role, department: Department): boolean {
    if (department === 'admin') return false // Amministrazione can edit
    if (role === 'coach' || role === 'viewer') return true
    if (role === 'manager' && department === 'marketing') return false // marketing managers CAN edit
    return false
}

// Should CRM filter to show only user's assigned leads?
// Disabled: everyone sees all leads, use filters to narrow down
export function shouldFilterOwnLeads(role: Role): boolean {
    return false
}


// ============================================================
// Qualifica Workflow Fields (setter_step, try_anthon, esito)
// ============================================================

// Can this user edit qualifica workflow fields on a lead?
export function canEditSetterFields(role: Role, department: Department): boolean {
    if (role === 'owner' || role === 'admin') return true
    if (role === 'manager' && department === 'sales') return true
    if (department === 'admin') return true // Amministrazione can edit setter fields
    if (role === 'closer') return true
    return false
}

// ============================================================
// Role configuration for UI
// ============================================================

export const ROLE_CONFIG: Record<Role, { label: string; color: string; description: string }> = {
    owner:   { label: 'Owner',        color: '#f59e0b', description: 'Accesso completo a tutto il sistema' },
    admin:   { label: 'Admin',        color: '#8b5cf6', description: 'Accesso completo, gestione team' },
    manager: { label: 'Responsabile', color: '#ec4899', description: 'Responsabile di reparto' },
    closer:  { label: 'Venditore',    color: '#22c55e', description: 'Gestione lead, qualifica e vendite' },
    coach:   { label: 'Coach',        color: '#f97316', description: 'Visualizzazione CRM e clienti' },
    viewer:  { label: 'Viewer',       color: '#71717a', description: 'Solo visualizzazione' },
}

export const DEPARTMENT_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
    marketing: { label: 'Marketing & Ads',   emoji: '🎯', color: '#a855f7' },
    sales:     { label: 'Vendite',           emoji: '💰', color: '#22c55e' },
    coaching:  { label: 'Coaching',          emoji: '🏋️', color: '#f97316' },
    admin:     { label: 'Amministrazione',   emoji: '📊', color: '#71717a' },
    it:        { label: 'IT / Tech',         emoji: '🛠️', color: '#06b6d4' },
}

export const ALL_ROLES: Role[] = ['owner', 'admin', 'manager', 'closer', 'coach', 'viewer']
export const INVITABLE_ROLES: Role[] = ['admin', 'manager', 'closer', 'coach', 'viewer']
export const ALL_DEPARTMENTS = Object.keys(DEPARTMENT_CONFIG)
