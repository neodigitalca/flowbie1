# POST `/api/google-ads/fetch-reporting-bundle`

Server-only Google Ads GAQL bundle for the PPC report. Browser calls this app's API only.

## Auth

- OAuth refresh token from Dashboard → Google Services → Google Ads Connect
- Developer token
- MCC ID sent as `login-customer-id` (digits only, e.g. `3937136350` from `393-713-6350`)

## Body

```json
{
  "customerId": "1234567890",
  "startDate": "2026-08-01",
  "endDate": "2026-08-31",
  "compareStartDate": "2026-07-01",
  "compareEndDate": "2026-07-31"
}
```

`customerId` is the 10-digit client account under the MCC.

## Response

Account totals, campaigns, keywords, and search terms for both date ranges. Metrics: impressions, clicks, costMicros, CTR, average CPC, conversions, conversion value.
