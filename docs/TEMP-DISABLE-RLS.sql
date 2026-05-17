-- TEMP-DISABLE-RLS.sql
-- Emergency RLS rollback script. Keep accessible through Phase 4 of RLS hardening.
-- WARNING: Disables security. ONLY use for debugging or emergency rollback.
-- DO NOT leave RLS disabled in production.

-- ============================================================
-- STEP 1: Disable RLS on items table
-- ============================================================
ALTER TABLE items DISABLE ROW LEVEL SECURITY;

SELECT 'RLS disabled on items table' as status;

-- Now try your frontend query
-- If it works now, RLS policies are the problem
-- If it still fails, something else is wrong

-- ============================================================
-- STEP 2: Re-enable RLS (RUN THIS AFTER TESTING!)
-- ============================================================
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: If disabling items fixed it, try item_images
-- ============================================================
-- ALTER TABLE item_images DISABLE ROW LEVEL SECURITY;

-- SELECT 'RLS disabled on item_images table' as status;

-- ============================================================
-- STEP 4: Re-enable everything when done
-- ============================================================
/*
-- RUN THESE TO RE-ENABLE RLS AFTER TESTING:
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_visibility_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
*/

-- ============================================================
-- TEST QUERY AFTER DISABLING RLS
-- ============================================================
SELECT 'Test: Can you query items now?' as test;

SELECT 
    id,
    title,
    description,
    status,
    created_at
FROM items
ORDER BY created_at DESC
LIMIT 5;

SELECT 'Test: Can you query with join now?' as test;

SELECT 
    items.id,
    items.title,
    item_images.path
FROM items
LEFT JOIN item_images ON item_images.item_id = items.id
LIMIT 5;

-- ============================================================
-- INTERPRETATION
-- ============================================================
/*
If queries work after disabling RLS:
  → The problem is definitely in the RLS policies
  → Proceed to rls-policies-reference.sql (docs/) or write a new migration

If queries still fail after disabling RLS:
  → The problem is NOT RLS
  → Check for:
    - Missing columns
    - Corrupted data
    - Database connection issues
    - Foreign key constraints
*/
