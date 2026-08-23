# 5-Minute Pitch Video Script

## 0:00–0:30 — Hook

"Imagine telling an AI, 'I need wireless earbuds under three thousand rupees.' Instead of just giving me links, the AI understands my intent, recommends the right product, suggests a relevant add-on, and takes me all the way to a payment-ready order.

But there is one important difference: the AI does not get unrestricted access to money.

This is FlowCart AI — an explainable agentic commerce growth engine built for the Razorpay AI Builder 2026 challenge."

## 0:30–1:15 — Problem

"Traditional e-commerce separates discovery, recommendation and checkout. AI can collapse these steps into one conversation, but that creates a new problem: an AI agent must not be allowed to make financial decisions without boundaries.

For merchants, the opportunity is also bigger than convenience. Better recommendations and contextual upsells can increase average order value and conversion.

So my goal was to build the bridge between conversational shopping and safe transactions."

## 1:15–2:45 — Live Demo

"First, I ask the agent: recommend the best earbuds under three thousand rupees.

The agent extracts my intent, searches the merchant's structured catalog and returns the Pulse ANC Earbuds.

Now I say buy the earbuds.

The product is added to the cart, but notice that no payment happens.

The agent can recommend a relevant protective case, and when two products are selected, a small bundle discount is calculated.

Now the checkout panel shows the exact subtotal, discount and final amount.

The important part is this approval checkbox. I explicitly approve the amount before the backend is allowed to create a Razorpay Test Mode order.

Here is the audit trail. It records the agent decision, checkout preview, payment gate and order creation.

Finally, I can simulate a payment-provider failure. The system does not blindly retry. It logs the failure and keeps the customer in control."

## 2:45–3:45 — Architecture

"The architecture follows Observe, Reason, Recommend, Gate, Act and Audit.

The frontend sends the customer's request to an Express backend.

For reasoning, I support Gemini for natural-language intent extraction, with a deterministic fallback if the model is unavailable.

The policy layer is where I enforce the important boundaries: inventory checks, a maximum transaction amount, a maximum AI discount and explicit human approval.

Only after those checks does the system call the Razorpay Orders API in Test Mode.

The backend also contains payment-signature verification and a webhook validation path for a production deployment."

## 3:45–4:30 — Why it matters for Razorpay

"This directly maps to AI Growth and Agentic Commerce.

For growth, the agent improves product discovery and introduces contextual upsells.

For agentic commerce, it turns a conversational intent into a transaction-ready flow.

And for trust, every money action is explainable, bounded and gated, with an audit trail and failure handling."

## 4:30–5:00 — Closing

"My next steps would be to connect this to a real merchant catalog, persist the audit trail, add idempotency and event deduplication, and measure conversion and average-order-value uplift across a synthetic batch.

The key idea is simple: AI should not just recommend what to buy. It should help complete commerce — but within clear, auditable boundaries.

That's FlowCart AI."
