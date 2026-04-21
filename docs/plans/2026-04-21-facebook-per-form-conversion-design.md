# Facebook Per-Form Conversion Design

**Date:** 2026-04-21  
**Status:** Validated design

## Goal

Move Facebook conversion controls to each lead form while keeping the admin/payment funnel separate.

## Scope

### Lead form settings
Each lead form should own its own:
- Meta CAPI access token
- Meta dataset ID
- Meta test event code
- Purchase value
- `Qualified sending to Facebook` toggle
- `Purchase sending to Facebook` toggle

### Admin/payment funnel settings
The admin/payment funnel should stay separate and keep its own:
- Meta CAPI access token
- Meta dataset ID
- Meta test event code
- Purchase value

## Event model

### Lead forms
- If **Qualified sending to Facebook** is on, send standard `Lead` when that form produces a qualified lead.
- If **Purchase sending to Facebook** is on, send standard `Purchase` when that lead reaches `sold`.
- `Purchase` for lead forms fires on `sold`, not on `qualified`.

### Admin/payment funnel
- `PageView` for payment hero visit
- `Lead` for receipt submitted for review
- `Purchase` for admin-confirmed payment

## Ownership rules

- Lead-form Facebook settings must not affect admin/payment events.
- Admin/payment settings must not affect lead-form events.
- If a lead form has missing Meta config, skip sending without breaking the lead flow.

## Data model

### `lead_forms`
Add fields for:
- `meta_capi_access_token`
- `meta_capi_dataset_id`
- `meta_capi_test_event_code`
- `facebook_purchase_value`
- `send_qualified_to_facebook`
- `send_purchase_to_facebook`

### `users`
Keep admin/payment-specific Facebook settings here, including payment purchase value.

## UI changes

### Lead form editor
Add a Facebook settings section with:
- token
- dataset id
- test event code
- purchase value
- qualified toggle
- purchase toggle

### Admin payment settings
Add editable purchase value alongside the existing payment Meta settings.

## Runtime behavior

### Qualified lead flow
- Read the submitting lead form’s Facebook config.
- If the qualified toggle is enabled and config exists, send `Lead`.

### Sold lead flow
- Read the lead form’s Facebook config.
- If the purchase toggle is enabled and config exists, send `Purchase` with the form’s purchase value.

### Payment funnel
- Keep using admin/payment config only.
- Use admin-configured purchase value for admin-confirmed payment purchases.

## Error handling

- Meta failures must not block lead qualification, lead stage changes, or admin receipt review.
- Missing form-level config should return a safe no-send path.
- Toggle-off states should skip sending cleanly.

## Verification plan

Add tests for:
- per-form config persistence
- qualified toggle on/off
- purchase toggle on/off
- sold uses form purchase value
- admin payment funnel uses its own purchase value
- no cross-contamination between lead-form config and admin config
