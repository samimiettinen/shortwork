-- Drop the existing restrictive policy and replace with a permissive one
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;

-- Create a permissive INSERT policy that allows authenticated users to create workspaces
CREATE POLICY "Users can create workspaces" 
ON public.workspaces 
FOR INSERT 
TO authenticated
WITH CHECK (true);