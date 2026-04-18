-- Hotfix: Add explicit WITH CHECK to conversation_leases RLS policy
-- Date: 2026-04-18
-- Bug: INSERT/UPSERT into conversation_leases fails with
--      "new row violates row-level security policy for table conversation_leases"
-- Root cause: The "Users can manage own leases" policy used FOR ALL with only
--      a USING clause. Since conversation_leases has no user_id column, ownership
--      is checked via a subquery to conversations. A subquery-based USING does not
--      reliably satisfy WITH CHECK for INSERT/UPSERT in PostgreSQL/Supabase RLS.
-- Fix: Drop and recreate the policy with an explicit WITH CHECK clause.

-- Drop the incomplete policy
DROP POLICY IF EXISTS "Users can manage own leases" ON public.conversation_leases;

-- Recreate with both USING (for SELECT/UPDATE/DELETE) and WITH CHECK (for INSERT/UPDATE)
CREATE POLICY "Users can manage own leases"
  ON public.conversation_leases FOR ALL
  USING (
    auth.uid() = (SELECT user_id FROM public.conversations WHERE id = conversation_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.conversations WHERE id = conversation_id)
  );
