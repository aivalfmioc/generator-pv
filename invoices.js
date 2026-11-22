let invoices = [];

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function loadInvoices() {
  const status = document.getElementById("status");
  try {
    const response = await fetch("/api/database");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load invoices.");

    const companies = new Map(data.companies.map((c) => [c.company_id, c.name]));

    invoices = data.invoices.map((invoice) => {
      const items = data.invoice_items.filter((item) => item.invoice_id === invoice.invoice_id);
      const net = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
      const taxRate = Number(invoice.tax_rate);
      return {
        ...invoice,
        items,
        seller: companies.get(invoice.seller_id) || "-",
        buyer: companies.get(invoice.buyer_id) || "-",
        net,
        total: net * (1 + taxRate / 100),
      };
    });

    status.textContent = `${invoices.length} invoices`;
    render();
  } catch (error) {
    status.textContent = error.message;
  }
}

function render() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const body = document.getElementById("invoice-body");
  const rows = invoices.filter((inv) =>
    [inv.invoice_number, inv.seller, inv.buyer].some((v) => v.toLowerCase().includes(query))
  );

  if (rows.length === 0) {
    body.innerHTML = '<tr><td colspan="8" class="empty">No invoices found.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((inv) => `
    <tr class="invoice-row" data-id="${inv.invoice_id}">
      <td><strong>${escapeHtml(inv.invoice_number)}</strong></td>
      <td>${escapeHtml(inv.invoice_date)}</td>
      <td>${escapeHtml(inv.due_date)}</td>
      <td>${escapeHtml(inv.seller)}</td>
      <td>${escapeHtml(inv.buyer)}</td>
      <td class="num">${Number(inv.tax_rate)}%</td>
      <td class="num">${money.format(inv.net)}</td>
      <td class="num"><strong>${money.format(inv.total)}</strong></td>
    </tr>
    <tr class="details" id="details-${inv.invoice_id}" hidden>
      <td colspan="8">
        <table>
          <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${inv.items.map((item) => `
              <tr>
                <td>${escapeHtml(item.description)}</td>
                <td class="num">${Number(item.quantity)}</td>
                <td class="num">${money.format(item.unit_price)}</td>
                <td class="num">${money.format(item.quantity * item.unit_price)}</td>
              </tr>`).join("") || '<tr><td colspan="4" class="empty">No items</td></tr>'}
          </tbody>
        </table>
        <p>Payment: ${escapeHtml(inv.payment_method)} · IBAN ${escapeHtml(inv.iban)} · BIC ${escapeHtml(inv.bic)}</p>
      </td>
    </tr>`).join("");
}

document.getElementById("invoice-body").addEventListener("click", (event) => {
  const row = event.target.closest("tr.invoice-row");
  if (!row) return;
  const details = document.getElementById(`details-${row.dataset.id}`);
  details.hidden = !details.hidden;
});

document.getElementById("search").addEventListener("input", render);

loadInvoices();
