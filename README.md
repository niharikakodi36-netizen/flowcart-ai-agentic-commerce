# FlowCart AI — Agentic Commerce Growth Agent

**Razorpay AI Builder 2026 — Track: AI Growth & Agentic Commerce**

## One-line pitch

FlowCart AI is an explainable shopping agent that turns natural-language intent into product discovery, bounded upsell recommendations and a customer-approved Razorpay Test Mode order, with a complete audit trail.

## Why this fits the track

Razorpay's AI Builder brief asks builders in AI Growth & Agentic Commerce to grow merchant revenue or make a merchant transactable by an AI buyer, while keeping every money action explainable, bounded and gated.

This prototype demonstrates both:
- AI buyer intent → merchant catalog → recommendation
- AI-proposed bundle/upsell → bounded discount
- explicit customer approval → Razorpay Test Mode order
- audit trail for every important agent decision
- graceful payment-provider failure handling

## Architecture

```text
Customer
   |
   v
Web UI
   |
   v
Express API
   |
   +---- AI intent extraction
   |       |
   |       +---- Gemini (optional)
   |       +---- deterministic fallback
   |
   +---- Agent policy layer
   |       +---- catalog matching
   |       +---- upsell
   |       +---- discount cap
   |       +---- max order cap
   |       +---- explicit approval gate
   |
   +---- Razorpay Orders API (Test Mode)
   |
   +---- Payment verification / webhook skeleton
   |
   +---- Audit trail
```

## Key safety/product decisions

1. **No autonomous payment:** the agent can recommend and prepare a cart, but order creation requires `approved: true`.
2. **Transaction ceiling:** AI-generated orders are capped by `MAX_ORDER_INR`.
3. **Discount ceiling:** AI bundle discounts cannot exceed `AI_DISCOUNT_LIMIT_PERCENT`.
4. **Inventory check:** quantities are checked against the merchant catalog.
5. **No blind retries:** simulated provider failure is logged and surfaced to the user instead of silently retrying and risking a duplicate order.
6. **Secrets stay server-side:** Razorpay secret is never placed in frontend code.
7. **Auditability:** intent, checkout preview, payment gate, order creation and failures are recorded.

## Run locally

Requires Node.js 18+.

```bash
npm install
copy .env.example .env
npm start
```

Open:

`http://localhost:3000`

On macOS/Linux, use:

```bash
cp .env.example .env
npm start
```

The app works without API keys in demo mode.

## Optional Gemini setup

Put a Gemini API key in `.env`:

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

If Gemini is unavailable, the app automatically falls back to a deterministic intent parser. This keeps the demo runnable during an outage.

## Razorpay Test Mode

Add Test Mode credentials to `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxx
```

The backend creates orders through Razorpay's server-side Orders API. Never commit the secret.

For a production-grade integration, configure a public HTTPS webhook and set:

```env
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Then validate `X-Razorpay-Signature` against the raw webhook body before trusting payment events.

## Demo script

1. Open the dashboard.
2. Ask: **"Recommend the best earbuds under ₹3000."**
3. Ask: **"Buy the earbuds."**
4. Show that the agent adds the product but does not pay automatically.
5. Add the protective case as an upsell.
6. Show the bundle discount and final amount.
7. Tick the approval checkbox.
8. Click **Create Test Order**.
9. Open the Audit Trail and explain each decision.
10. Click **Simulate Provider Failure** and show graceful failure handling.
11. Explain that the same architecture can be extended to AI-readable catalogs, conversational checkout and merchant growth campaigns.

## Suggested evaluation metrics

For the next version, measure:
- intent accuracy on 100 synthetic shopping prompts
- recommendation click-through rate
- cart conversion rate
- average order value uplift from approved upsells
- percentage of orders blocked by policy
- payment failure recovery rate
- duplicate-order rate (target: 0)

## Important

This is a prototype for Razorpay Test Mode. Do not put live keys in the repository and do not claim a simulated order is a real payment.
