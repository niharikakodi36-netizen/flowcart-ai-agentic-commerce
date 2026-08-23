# Architecture Notes

## Agent loop

**Observe → Reason → Recommend → Gate → Act → Audit**

### Observe
Natural-language customer request.

### Reason
Optional Gemini model extracts:
- intent
- product query
- budget
- quantity

A deterministic parser is the fallback.

### Recommend
The catalog search ranks products by matching words against:
- name
- category
- tags
- description

The agent can identify a related accessory through the product's `upsell` field.

### Gate
Before a payment order:
- inventory must be sufficient
- total must be <= MAX_ORDER_INR
- discount must be <= AI_DISCOUNT_LIMIT_PERCENT
- customer must explicitly approve the final amount

### Act
The backend creates a Razorpay order using Test Mode credentials when configured.

### Audit
Important decisions are stored with:
- timestamp
- event type
- human-readable message
- structured metadata

## Failure handling

If the AI provider fails:
- the system falls back to deterministic intent extraction.

If the payment provider fails:
- no automatic retry occurs
- the user sees a clear failure message
- the failure is logged
- this prevents accidental duplicate orders.

## Production extensions

- Persist audit events in PostgreSQL.
- Add merchant authentication and per-merchant policies.
- Add idempotency keys for order creation.
- Add signed webhook verification and event deduplication.
- Add a real agent-readable catalog endpoint / schema.
- Add experimentation for upsell policies.
- Add campaign orchestration using merchant-approved budgets.
