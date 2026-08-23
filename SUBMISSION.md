# Razorpay AI Builder Submission Draft

## Project Name / Title

FlowCart AI — Explainable Agentic Commerce Growth Engine

## Project Objectives

FlowCart AI helps merchants convert natural-language shopping intent into revenue. The agent understands what a customer wants, finds relevant products from an AI-readable catalog, proposes a contextual upsell/bundle, calculates a bounded discount, and prepares a Razorpay Test Mode order only after explicit customer approval. It solves the gap between conversational product discovery and safe, transactable commerce while maintaining an audit trail for every important decision.

## Build Challenges & Technical Obstacles

The main challenge was making the AI agent useful without allowing it to take an unsafe or unexplained financial action. I solved this by separating the agent's recommendation layer from the payment execution layer. The agent can interpret intent, recommend products and prepare a cart, but the backend enforces a maximum order value, a discount ceiling, inventory checks and an explicit approval gate before creating a Razorpay order.

Another challenge was reliability. An LLM can fail, return malformed output or become unavailable during a demo. I added a deterministic intent parser as a fallback, so the application remains usable even when the AI provider fails.

I also added a failure-handling path for payment-provider errors. Instead of blindly retrying, the system logs the failure and leaves the user in control, reducing the risk of duplicate orders.

Finally, I kept payment secrets on the server and designed the integration around Razorpay Test Mode. The project includes payment-signature verification and a webhook validation skeleton so the prototype has a clear path toward a production-grade implementation.
