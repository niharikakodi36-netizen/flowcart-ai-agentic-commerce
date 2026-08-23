require("dotenv").config();

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const MAX_ORDER_INR = Number(process.env.MAX_ORDER_INR || 10000);
const AI_DISCOUNT_LIMIT_PERCENT = Number(process.env.AI_DISCOUNT_LIMIT_PERCENT || 15);

const catalog = [
  {
    id: "pulse-earbuds",
    name: "Pulse ANC Earbuds",
    category: "audio",
    price: 2499,
    stock: 24,
    tags: ["earbuds", "wireless", "music", "anc", "commute"],
    description: "Wireless ANC earbuds with low-latency mode and 28-hour battery.",
    upsell: "pulse-case"
  },
  {
    id: "pulse-case",
    name: "Pulse Protective Case",
    category: "accessories",
    price: 399,
    stock: 60,
    tags: ["case", "earbuds", "protection", "accessory"],
    description: "Compact protective case designed for Pulse ANC Earbuds."
  },
  {
    id: "nova-watch",
    name: "Nova Fit Watch",
    category: "wearables",
    price: 3299,
    stock: 18,
    tags: ["watch", "fitness", "health", "wearable"],
    description: "Fitness-focused smartwatch with activity tracking and 7-day battery.",
    upsell: "nova-strap"
  },
  {
    id: "nova-strap",
    name: "Nova Sport Strap",
    category: "accessories",
    price: 499,
    stock: 40,
    tags: ["strap", "watch", "fitness", "accessory"],
    description: "Breathable replacement strap for the Nova Fit Watch."
  },
  {
    id: "desk-hub",
    name: "Flow USB-C Desk Hub",
    category: "productivity",
    price: 1899,
    stock: 31,
    tags: ["usb-c", "hub", "laptop", "desk", "productivity"],
    description: "7-in-1 USB-C hub with HDMI, USB-A and SD card support."
  },
  {
    id: "desk-stand",
    name: "Flow Laptop Stand",
    category: "productivity",
    price: 1299,
    stock: 27,
    tags: ["stand", "laptop", "desk", "ergonomic", "productivity"],
    description: "Foldable aluminum laptop stand for a cleaner desk setup."
  }
];

const campaigns = [
  {
    id: "welcome10",
    name: "Welcome 10",
    percent: 10,
    rule: "new_customer"
  },
  {
    id: "bundle5",
    name: "Smart Bundle",
    percent: 5,
    rule: "bundle"
  }
];

const auditLog = [];

function now() {
  return new Date().toISOString();
}

function audit(type, message, metadata = {}) {
  const event = {
    id: crypto.randomUUID(),
    time: now(),
    type,
    message,
    metadata
  };
  auditLog.unshift(event);
  if (auditLog.length > 100) auditLog.pop();
  return event;
}

function money(n) {
  return Number(n.toFixed(2));
}

function findProduct(id) {
  return catalog.find(p => p.id === id);
}

function searchCatalog(query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return catalog.slice(0, 4);
  const words = q.split(/\s+/).filter(Boolean);
  return catalog
    .map(p => {
      const haystack = `${p.name} ${p.category} ${p.tags.join(" ")} ${p.description}`.toLowerCase();
      const score = words.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0);
      return { ...p, score };
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, 5);
}

function detectIntent(text) {
  const t = String(text || "").toLowerCase();

  let intent = "discover";
  if (/(buy|purchase|order|checkout|pay|add.*cart)/.test(t)) intent = "buy";
  else if (/(recommend|suggest|best|looking for|need)/.test(t)) intent = "recommend";
  else if (/(offer|discount|deal|cheaper|coupon)/.test(t)) intent = "offer";

  const budgetMatch = t.match(/(?:under|below|within|budget(?:\s+of)?|less than)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : null;

  const quantityMatch = t.match(/(\d+)\s*(?:x|units?|items?)/i);
  const quantity = quantityMatch ? Math.max(1, Math.min(5, Number(quantityMatch[1]))) : 1;

  const results = searchCatalog(t);
  const product = results[0] || null;

  return { intent, budget, quantity, product };
}

async function llmIntent(text) {
  if (!process.env.GEMINI_API_KEY) return detectIntent(text);

  const prompt = `
You are a commerce intent extractor. Return ONLY valid JSON.
Schema:
{"intent":"discover|recommend|buy|offer","query":"short product query","budget":number|null,"quantity":number}
User message: ${JSON.stringify(text)}
`;

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    }, { timeout: 12000 });

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return {
      intent: ["discover", "recommend", "buy", "offer"].includes(parsed.intent) ? parsed.intent : "discover",
      budget: Number.isFinite(Number(parsed.budget)) ? Number(parsed.budget) : null,
      quantity: Math.max(1, Math.min(5, Number(parsed.quantity) || 1)),
      product: searchCatalog(parsed.query || text)[0] || null
    };
  } catch (err) {
    audit("AI_FALLBACK", "LLM unavailable; deterministic intent parser used.", {
      reason: err.message
    });
    return detectIntent(text);
  }
}

function recommendationMessage(intent) {
  if (!intent.product) {
    return {
      text: "I couldn't match that request to the demo catalog. Try: “best earbuds under ₹3000” or “buy the laptop stand”.",
      products: searchCatalog("")
    };
  }

  let products = searchCatalog(intent.product.name);
  if (intent.budget) {
    products = products.filter(p => p.price <= intent.budget);
  }
  if (!products.length) {
    products = searchCatalog(intent.product.name);
  }

  const primary = products[0];
  const upsell = primary.upsell ? findProduct(primary.upsell) : null;

  return {
    text: `I found ${primary.name} for ₹${primary.price.toLocaleString("en-IN")}.` +
      (upsell ? ` A relevant add-on is ${upsell.name} for ₹${upsell.price.toLocaleString("en-IN")}.` : "") +
      ` I won't place an order unless you explicitly approve the final amount.`,
    products: products.slice(0, 3),
    upsell
  };
}

function buildCart(items) {
  const normalized = items.map(item => {
    const p = findProduct(item.productId);
    if (!p) throw new Error(`Unknown product: ${item.productId}`);
    const qty = Math.max(1, Math.min(5, Number(item.quantity) || 1));
    if (qty > p.stock) throw new Error(`${p.name} has only ${p.stock} units available.`);
    return {
      productId: p.id,
      name: p.name,
      price: p.price,
      quantity: qty,
      lineTotal: p.price * qty
    };
  });

  const subtotal = normalized.reduce((s, i) => s + i.lineTotal, 0);
  const hasBundle = normalized.length >= 2;

  let discountPercent = hasBundle ? 5 : 0;
  discountPercent = Math.min(discountPercent, AI_DISCOUNT_LIMIT_PERCENT);

  const discount = money(subtotal * discountPercent / 100);
  const total = money(subtotal - discount);

  if (total > MAX_ORDER_INR) {
    throw new Error(`Safety limit: AI-generated orders cannot exceed ₹${MAX_ORDER_INR.toLocaleString("en-IN")}.`);
  }

  return {
    items: normalized,
    subtotal,
    discountPercent,
    discount,
    total,
    currency: "INR"
  };
}

async function createRazorpayOrder(amountInr) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return {
      simulated: true,
      id: `demo_order_${Date.now()}`,
      amount: Math.round(amountInr * 100),
      currency: "INR"
    };
  }

  const response = await axios.post(
    "https://api.razorpay.com/v1/orders",
    {
      amount: Math.round(amountInr * 100),
      currency: "INR",
      receipt: `agentic_${Date.now()}`,
      notes: {
        source: "ai_growth_agent",
        environment: "test"
      }
    },
    {
      auth: {
        username: process.env.RAZORPAY_KEY_ID,
        password: process.env.RAZORPAY_KEY_SECRET
      },
      timeout: 12000
    }
  );

  return {
    simulated: false,
    id: response.data.id,
    amount: response.data.amount,
    currency: response.data.currency
  };
}

app.get("/api/catalog", (req, res) => {
  res.json({ catalog });
});

app.get("/api/audit", (req, res) => {
  res.json({ audit: auditLog });
});

app.post("/api/agent", async (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message is required." });

  const intent = await llmIntent(message);
  const result = recommendationMessage(intent);

  audit("AGENT_DECISION", "Agent interpreted a shopping request.", {
    message,
    intent: intent.intent,
    product: intent.product?.id || null,
    budget: intent.budget,
    quantity: intent.quantity
  });

  res.json({
    ok: true,
    intent: intent.intent,
    budget: intent.budget,
    quantity: intent.quantity,
    ...result
  });
});

app.post("/api/checkout/preview", (req, res) => {
  try {
    const cart = buildCart(req.body.items || []);
    audit("CHECKOUT_PREVIEW", "Final amount calculated and bounded before payment.", {
      total: cart.total,
      discountPercent: cart.discountPercent
    });
    res.json({ ok: true, cart });
  } catch (err) {
    audit("CHECKOUT_BLOCKED", "Checkout preview blocked by a safety rule.", { reason: err.message });
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/checkout/create-order", async (req, res) => {
  try {
    const cart = buildCart(req.body.items || []);

    // Explicit human approval gate.
    if (req.body.approved !== true) {
      audit("PAYMENT_GATE", "Payment action blocked because explicit approval was missing.", {
        total: cart.total
      });
      return res.status(403).json({
        error: "Explicit approval is required before creating a payment order.",
        cart
      });
    }

    const order = await createRazorpayOrder(cart.total);

    audit("ORDER_CREATED", "Razorpay test order created after explicit approval.", {
      orderId: order.id,
      amount: cart.total,
      simulated: order.simulated
    });

    res.json({
      ok: true,
      order,
      cart,
      keyId: process.env.RAZORPAY_KEY_ID || null
    });
  } catch (err) {
    audit("ORDER_FAILED", "Payment order creation failed; no retry was performed automatically.", {
      reason: err.response?.data?.error?.description || err.message
    });
    res.status(500).json({
      error: err.response?.data?.error?.description || err.message
    });
  }
});

app.post("/api/payment/verify", (req, res) => {
  const { order_id, payment_id, signature } = req.body;

  if (!order_id || !payment_id || !signature || !process.env.RAZORPAY_KEY_SECRET) {
    audit("PAYMENT_VERIFY_DEMO", "Payment verification demo endpoint received incomplete/live credentials.");
    return res.json({
      ok: true,
      verified: false,
      simulated: true,
      message: "Demo mode: no live payment was verified."
    });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${order_id}|${payment_id}`)
    .digest("hex");

  const verified = crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );

  audit(verified ? "PAYMENT_VERIFIED" : "PAYMENT_REJECTED",
    verified ? "Razorpay payment signature verified." : "Payment signature rejected.",
    { orderId: order_id, paymentId: payment_id }
  );

  res.json({ ok: true, verified });
});

// Raw-body webhook endpoint is intentionally kept separate from the normal JSON routes.
// For production, configure a public HTTPS webhook and validate X-Razorpay-Signature
// against the raw request body before trusting payment events.
app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (secret && signature) {
    const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
    if (expected !== signature) {
      audit("WEBHOOK_REJECTED", "Webhook signature validation failed.");
      return res.status(400).json({ error: "Invalid webhook signature." });
    }
  }

  let payload = {};
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch (_) {}

  audit("WEBHOOK_RECEIVED", "Payment webhook received.", {
    event: payload.event || "unknown"
  });

  res.json({ ok: true });
});

app.post("/api/demo/failure", (req, res) => {
  audit("FAILURE_HANDLED", "Simulated Razorpay/API failure handled gracefully.", {
    fallback: "No automatic retry; user remains in control and can retry manually."
  });
  res.json({
    ok: true,
    message: "Simulated payment-provider failure handled. No duplicate order was created."
  });
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  audit("SYSTEM_START", "Agentic Commerce demo started.", { port: PORT });
  console.log(`Agentic Commerce running at http://localhost:${PORT}`);
});
