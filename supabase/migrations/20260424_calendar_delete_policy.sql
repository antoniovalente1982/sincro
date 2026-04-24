-- Add DELETE policy for calendar_events (was missing, blocking event deletion)
CREATE POLICY "Users can delete own org calendar_events" ON public.calendar_events
    FOR DELETE USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND deactivated_at IS NULL
        )
    );
