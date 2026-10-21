-- Jakob's 21 October 2026 decision: budget caps must not be what stops a demo
-- evening. Technical capacity only: grant ceiling 45 -> 150 USD and daily GPU
-- ceiling 40 -> 60 USD. Existing grants still need their own funded amendment;
-- all retained reservation/ledger rows remain unchanged.
ALTER TABLE croupier_studio.moving_speech_bindings DROP CONSTRAINT moving_speech_bindings_budget_limit_micro_usd_check, ADD CONSTRAINT moving_speech_bindings_budget_limit_micro_usd_check CHECK (budget_limit_micro_usd BETWEEN 1 AND 150000000);
ALTER TABLE croupier_studio.moving_speech_budget_amendments DROP CONSTRAINT moving_speech_budget_amendments_previous_limit_micro_usd_check, ADD CONSTRAINT moving_speech_budget_amendments_previous_limit_micro_usd_check CHECK (previous_limit_micro_usd BETWEEN 1 AND 150000000);
ALTER TABLE croupier_studio.moving_speech_budget_amendments DROP CONSTRAINT moving_speech_budget_amendments_budget_limit_micro_usd_check, ADD CONSTRAINT moving_speech_budget_amendments_budget_limit_micro_usd_check CHECK (budget_limit_micro_usd BETWEEN 1 AND 150000000);
ALTER TABLE croupier_studio.gpu_budget_policies DROP CONSTRAINT gpu_budget_policies_daily_budget_micro_usd_check, ADD CONSTRAINT gpu_budget_policies_daily_budget_micro_usd_check CHECK (daily_budget_micro_usd BETWEEN 1 AND 60000000);
