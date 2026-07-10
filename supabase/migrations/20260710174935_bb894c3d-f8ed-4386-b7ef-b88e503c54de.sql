
ALTER TYPE public.commission_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.commission_status ADD VALUE IF NOT EXISTS 'reversed';

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS notes text;
