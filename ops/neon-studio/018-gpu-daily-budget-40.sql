-- Jakob raised the daily GPU test ceiling from 20 to 40 USD on 19 October 2026
-- (Dragan trial evening: sixteen 1.20 USD reservations had filled the UTC day).
-- Per-job constraints and all retained reservation/ledger rows remain unchanged.
ALTER TABLE croupier_studio.gpu_budget_policies DROP CONSTRAINT gpu_budget_policies_daily_budget_micro_usd_check, ADD CONSTRAINT gpu_budget_policies_daily_budget_micro_usd_check CHECK (daily_budget_micro_usd BETWEEN 1 AND 40000000);
