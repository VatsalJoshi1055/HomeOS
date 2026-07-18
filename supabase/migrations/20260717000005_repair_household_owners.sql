-- Repair owners whose role was overwritten to MEMBER (e.g. login upsert bug).
-- Household creators must be OWNER.

UPDATE public.profiles AS p
SET role = 'OWNER'
FROM public.households AS h
WHERE p.id = h.created_by
  AND p.household_id = h.id
  AND p.role IS DISTINCT FROM 'OWNER';
