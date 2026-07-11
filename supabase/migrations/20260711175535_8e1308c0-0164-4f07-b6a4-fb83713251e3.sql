ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type = ANY (ARRAY[
    'deposit','withdraw','commission','adjustment','refund',
    'game_reward','game_loss',
    'demo_credit','demo_game_reward','demo_game_loss'
  ]));