const state = { cart: [], catalog: [] };

const $ = id => document.getElementById(id);

function money(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function addMessage(text, role = "ai") {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  $("chat").appendChild(el);
  $("chat").scrollTop = $("chat").scrollHeight;
}

function renderCatalog() {
  $("catalog").innerHTML = state.catalog.map(p => `
    <div class="product">
      <div class="icon">${p.name.split(" ").map(x => x[0]).slice(0,2).join("")}</div>
      <h4>${p.name}</h4>
      <p>${p.description}</p>
      <div class="price">${money(p.price)}</div>
      <button onclick="addToCart('${p.id}')">Add to cart</button>
    </div>
  `).join("");
}

function renderCart() {
  const box = $("cartItems");
  $("cartCount").textContent = state.cart.reduce((s, x) => s + x.quantity, 0);

  if (!state.cart.length) {
    box.innerHTML = `<div class="empty">Ask the agent to add a product.</div>`;
    $("cartSummary").classList.add("hidden");
    $("checkoutBtn").disabled = true;
    return;
  }

  box.innerHTML = state.cart.map(item => `
    <div class="cart-row">
      <div>
        <b>${item.name}</b>
        <small>${money(item.price)} each</small>
      </div>
      <div class="qty">
        <button onclick="changeQty('${item.productId}', -1)">−</button>
        <span>${item.quantity}</span>
        <button onclick="changeQty('${item.productId}', 1)">+</button>
      </div>
    </div>
  `).join("");

  previewCart();
}

async function previewCart() {
  const response = await fetch("/api/checkout/preview", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({items: state.cart.map(x => ({productId:x.productId, quantity:x.quantity}))})
  });
  const data = await response.json();
  if (!data.ok) {
    $("cartSummary").innerHTML = `<div class="sumline"><span>Blocked</span><b>${data.error}</b></div>`;
    $("cartSummary").classList.remove("hidden");
    $("checkoutBtn").disabled = true;
    return;
  }

  const c = data.cart;
  $("cartSummary").innerHTML = `
    <div class="sumline"><span>Subtotal</span><b>${money(c.subtotal)}</b></div>
    <div class="sumline"><span>AI bundle discount (${c.discountPercent}%)</span><b>−${money(c.discount)}</b></div>
    <div class="sumline total"><span>Final amount</span><b>${money(c.total)}</b></div>
  `;
  $("cartSummary").classList.remove("hidden");
  $("checkoutBtn").disabled = !$("approval").checked;
}

window.addToCart = function(id) {
  const existing = state.cart.find(x => x.productId === id);
  if (existing) existing.quantity += 1;
  else {
    const p = state.catalog.find(x => x.id === id);
    state.cart.push({ productId:p.id, name:p.name, price:p.price, quantity:1 });
  }
  addMessage(`${state.cart.find(x=>x.productId===id).name} added to the cart.`, "ai");
  renderCart();
};

window.changeQty = function(id, delta) {
  const item = state.cart.find(x => x.productId === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) state.cart = state.cart.filter(x => x.productId !== id);
  renderCart();
};

async function askAgent(text) {
  addMessage(text, "user");
  const response = await fetch("/api/agent", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:text})
  });
  const data = await response.json();

  if (!data.ok) {
    addMessage(data.error || "The agent could not process that request.");
    return;
  }

  addMessage(data.text);

  if (data.products?.length) {
    const primary = data.products[0];
    const exists = state.cart.find(x => x.productId === primary.id);
    if (data.intent === "buy" && !exists) {
      addToCart(primary.id);
    }
  }
}

$("chatForm").addEventListener("submit", e => {
  e.preventDefault();
  const text = $("message").value.trim();
  if (!text) return;
  $("message").value = "";
  askAgent(text);
});

document.querySelectorAll(".quick button").forEach(btn => {
  btn.addEventListener("click", () => askAgent(btn.dataset.prompt));
});

$("approval").addEventListener("change", () => {
  if (state.cart.length) previewCart();
});

$("clearBtn").addEventListener("click", () => {
  $("chat").innerHTML = "";
  state.cart = [];
  renderCart();
  addMessage("Hi! I’m FlowCart AI. Tell me what you want to buy, your budget, or a product category.");
});

$("checkoutBtn").addEventListener("click", async () => {
  if (!$("approval").checked) return;
  $("checkoutMessage").textContent = "Creating bounded Razorpay Test Mode order…";

  const response = await fetch("/api/checkout/create-order", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      items: state.cart.map(x => ({productId:x.productId, quantity:x.quantity})),
      approved: true
    })
  });
  const data = await response.json();

  if (!data.ok) {
    $("checkoutMessage").textContent = `Blocked: ${data.error}`;
    return;
  }

  if (data.order.simulated) {
    $("checkoutMessage").textContent =
      `Demo order created: ${data.order.id}. Add Razorpay Test Mode keys to create a real test order.`;
  } else {
    $("checkoutMessage").textContent =
      `Razorpay Test Mode order created: ${data.order.id}. Open Checkout from your configured integration.`;
  }

  $("approval").checked = false;
  $("checkoutBtn").disabled = true;
  loadAudit();
});

$("failureBtn").addEventListener("click", async () => {
  const response = await fetch("/api/demo/failure", {method:"POST"});
  const data = await response.json();
  $("checkoutMessage").textContent = data.message;
  loadAudit();
});

async function loadAudit() {
  const response = await fetch("/api/audit");
  const data = await response.json();
  $("audit").innerHTML = data.audit.map(e => `
    <div class="audit-item">
      <strong>${e.type}</strong>
      <span>${new Date(e.time).toLocaleTimeString()}</span>
      <div>${e.message}</div>
      <pre>${JSON.stringify(e.metadata || {}, null, 2)}</pre>
    </div>
  `).join("");
}

async function init() {
  const response = await fetch("/api/catalog");
  const data = await response.json();
  state.catalog = data.catalog;
  renderCatalog();
  renderCart();
  addMessage("Hi! I’m FlowCart AI. Try “recommend earbuds under ₹3000” or “buy the Flow laptop stand”.");
  loadAudit();
}

$("refreshAudit").addEventListener("click", loadAudit);
init();
