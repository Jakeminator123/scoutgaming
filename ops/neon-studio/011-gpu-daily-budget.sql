-- Jakob approved a 20 USD daily GPU test ceiling on 13 October 2026.
-- Per-job constraints and all retained reservation/ledger rows remain unchanged.
ALTER TABLE croupier_studio.gpu_budget_policies DROP CONSTRAINT gpu_budget_policies_daily_budget_micro_usd_check, ADD CONSTRAINT gpu_budget_policies_daily_budget_micro_usd_check CHECK (daily_budget_micro_usd BETWEEN 1 AND 20000000);
