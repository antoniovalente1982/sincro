-- ============================================================
-- Migration: Fix RLS for calendar_availability management
-- ============================================================

-- 1. Drop existing overly restrictive policy
DROP POLICY IF EXISTS "Users can manage own calendar_availability" ON public.calendar_availability;

-- 2. Create new policy allowing admins and owners to manage everyone's availability in their org
CREATE POLICY "Users can manage own calendar_availability and admins all" ON public.calendar_availability
    FOR ALL USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.organization_members 
            WHERE user_id = auth.uid() 
            AND organization_id = calendar_availability.organization_id 
            AND role IN ('admin', 'owner')
            AND deactivated_at IS NULL
        )
    )
    WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.organization_members 
            WHERE user_id = auth.uid() 
            AND organization_id = calendar_availability.organization_id 
            AND role IN ('admin', 'owner')
            AND deactivated_at IS NULL
        )
    );
