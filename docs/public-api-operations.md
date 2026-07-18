# Public API operations

Keep `PUBLIC_API_ENABLED=false` until migrations, automated security tests, and live two-organization checks pass. Enable it only in the application environment; the database tables remain deny-by-default behind RLS.

## Retention cleanup

Run this maintenance daily with a trusted database scheduler such as Supabase Cron. Do not expose it through the Data API.

```sql
delete from public.api_rate_limit_buckets
where bucket_start < now() - interval '1 day';

delete from public.api_idempotency_keys
where expires_at < now() - interval '1 day';
```

The one-day grace period preserves recent diagnostics. Revoked `api_tokens` and `api_audit_events` are not removed by this job because they provide credential and mutation history.

## Rollback

1. Set `PUBLIC_API_ENABLED=false` and redeploy.
2. Revoke active tokens from Workspace Settings.
3. Keep token and audit rows for investigation; the additive schema can remain deployed.

