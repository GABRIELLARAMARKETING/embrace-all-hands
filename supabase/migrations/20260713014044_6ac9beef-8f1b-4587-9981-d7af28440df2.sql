DO $$
DECLARE
  bruna_id uuid := '0b3ddd32-469c-4c99-a779-24f5ec565692';
  ref_code text := '496VCX';
  target_ids uuid[] := ARRAY[
    'b6892aa7-a222-4322-b9e8-233e8e0f5b51'::uuid, -- Vanessa Pinheiro Ruivo
    '7276fc78-4241-491b-a189-2db469acc94f'::uuid  -- 69999743368
  ];
  t uuid;
  d record;
BEGIN
  FOREACH t IN ARRAY target_ids LOOP
    -- Só vincula se ainda não tiver indicador
    UPDATE public.profiles
       SET referred_by_id = bruna_id,
           manager_id     = bruna_id,
           is_influencer  = true
     WHERE id = t AND referred_by_id IS NULL;

    INSERT INTO public.referrals(referrer_id, referred_id, manager_id, level, source_code)
      VALUES (bruna_id, t, bruna_id, 1, ref_code)
      ON CONFLICT DO NOTHING;

    INSERT INTO public.referral_logs(referrer_id, referred_id, source_code)
      VALUES (bruna_id, t, ref_code);

    -- Reprocessa comissões dos depósitos já pagos/creditados que ainda não geraram comissão
    FOR d IN
      SELECT dep.id
        FROM public.deposits dep
        WHERE dep.user_id = t
          AND dep.status IN ('paid','approved')
          AND dep.credited_at IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.commissions c WHERE c.deposit_id = dep.id)
    LOOP
      PERFORM public.process_deposit_commissions(d.id);
    END LOOP;
  END LOOP;
END $$;