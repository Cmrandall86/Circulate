-- ============================================================
-- Migration: Add indexes and constraints for groups/members
-- ============================================================
-- Purpose: Performance indexes and single-owner enforcement
-- ============================================================

-- Performance indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);

-- Indexes for group_invitations and group_join_requests removed:
-- those tables were never created. Restore when the invitation system is implemented.

-- Enforce at most one owner per group
-- This prevents accidentally promoting multiple owners
CREATE UNIQUE INDEX uq_group_single_owner ON public.group_members(group_id) WHERE role = 'owner';

-- Document role values (supports 'owner', 'admin', 'member')
COMMENT ON COLUMN public.group_members.role IS 'one of: owner | admin | member';

-- ✓ Indexes and constraints created
SELECT '✓ Indexes and single-owner constraint created' AS status;

