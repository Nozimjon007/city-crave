-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Staff can view other staff in same branch" ON public.staff;

-- Create a security definer function to get user's branch_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_branch_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id
  FROM public.staff
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Staff can view other staff in same branch"
ON public.staff
FOR SELECT
USING (
  branch_id = public.get_user_branch_id(auth.uid())
);