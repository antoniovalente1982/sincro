-- ═══════════════════════════════════════════════════════════════
-- Migration: Fix handle_new_user trigger for team invitations
-- Date: 2026-04-10
-- 
-- PROBLEM: When a user is invited to a team via /api/team POST,
-- the generateLink({ type: 'invite' }) creates the auth user,
-- which triggers handle_new_user. This trigger auto-creates a
-- NEW organization + owner membership for every user, including
-- invited ones. Result: invited users get their own blank org
-- instead of joining the existing one.
--
-- FIX: Check if the user already has a pending invite in
-- organization_members before creating a new org.
-- ═══════════════════════════════════════════════════════════════

-- First, read the current trigger to verify its structure:
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'handle_new_user';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _has_pending_invite BOOLEAN;
  _new_org_id UUID;
BEGIN
  -- Check if this user was pre-created via team invite
  -- (has a pending org_member record with joined_at = NULL)
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members 
    WHERE user_id = NEW.id AND joined_at IS NULL
  ) INTO _has_pending_invite;

  -- Always create/update profile
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);

  -- ONLY create organization + membership if this is NOT an invited user
  IF NOT _has_pending_invite THEN
    _new_org_id := gen_random_uuid();
    
    INSERT INTO public.organizations (id, name, slug, created_at, updated_at)
    VALUES (
      _new_org_id,
      'La mia organizzazione',
      NEW.id::text,
      now(),
      now()
    );
    
    INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
    VALUES (_new_org_id, NEW.id, 'owner', now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
