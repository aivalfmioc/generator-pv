async function loadCompanies() {
  const list = document.getElementById("company-list");
  const status = document.getElementById("company-status");

  status.textContent = "Loading companies...";

  try {
    const response = await fetch("/api/companies");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load companies.");
    }

    list.replaceChildren();
    for (const name of result.companies) {
      const item = document.createElement("li");
      item.textContent = name;
      list.appendChild(item);
      console.log(name);
    }
    status.textContent = result.companies.length
      ? ""
      : "No companies found.";
  } catch (error) {
    status.textContent = error.message || "Could not load companies.";
  }
}

async function loadInvoiceNumbers() {
  const input = document.getElementById("invoice-number");
  const options = document.getElementById("invoice-numbers");
  const status = document.getElementById("status");

  status.textContent = "Loading invoice numbers...";

  try {
    const response = await fetch("/api/database");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load invoice numbers.");
    }

    options.replaceChildren();
    for (const invoice of result.invoices) {
      const option = document.createElement("option");
      option.value = invoice.invoice_number;
      options.appendChild(option);
    }

    if (result.invoices.length > 0) {
      input.value = result.invoices[0].invoice_number;
      status.textContent = "";
    } else {
      input.value = "";
      status.textContent = "No invoices found.";
    }
  } catch (error) {
    status.textContent =
      error.message || "Could not load invoice numbers.";
  }
}

async function generatePDF() {
  const invoiceNumber = document.getElementById("invoice-number").value.trim();
  const status = document.getElementById("status");

  if (!invoiceNumber) {
    status.textContent = "Enter an invoice number.";
    return;
  }

  status.textContent = "Loading invoice...";

  try {
    const response = await fetch(
      `/api/invoices/${encodeURIComponent(invoiceNumber)}`
    );
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load the invoice.");
    }

    createInvoicePDF(result.invoice, result.items);
    status.textContent = "PDF generated.";
  } catch (error) {
    status.textContent = error.message || "Could not generate the PDF.";
  }
}

function createInvoicePDF(invoice, items) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineHeight = 7;
  let y = 20;

  function writeLine(text, x = margin, width = pageWidth - margin * 2) {
    const lines = doc.splitTextToSize(String(text ?? ""), width);
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, x, y);
      y += lineHeight;
    }
  }

  function money(value) {
    return `${Number(value).toFixed(2)} EUR`;
  }

  doc.setFontSize(20);
  writeLine("INVOICE");
  doc.setFontSize(11);
  writeLine(`Invoice number: ${invoice.invoice_number}`);
  writeLine(`Invoice date: ${invoice.invoice_date}`);
  writeLine(`Due date: ${invoice.due_date}`);
  y += 4;

  doc.setFontSize(13);
  writeLine("Seller");
  doc.setFontSize(10);
  writeLine(invoice.seller.name);
  writeLine(invoice.seller.street);
  writeLine(
    `${invoice.seller.postal_code || ""} ${invoice.seller.city || ""}`.trim()
  );
  writeLine(`VAT: ${invoice.seller.vat_number || ""}`);
  y += 3;

  doc.setFontSize(13);
  writeLine("Buyer");
  doc.setFontSize(10);
  writeLine(invoice.buyer.name);
  writeLine(invoice.buyer.street);
  writeLine(
    `${invoice.buyer.postal_code || ""} ${invoice.buyer.city || ""}`.trim()
  );
  writeLine(`VAT: ${invoice.buyer.vat_number || ""}`);
  y += 5;

  doc.setFontSize(13);
  writeLine("Items");
  doc.setFontSize(10);
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
    0
  );
  for (const item of items) {
    const total = Number(item.quantity) * Number(item.unit_price);
    writeLine(
      `${item.description} | ${item.quantity} x ${money(item.unit_price)} = ${money(total)}`
    );
  }

  const tax = subtotal * (Number(invoice.tax_rate) / 100);
  y += 3;
  writeLine(`Subtotal: ${money(subtotal)}`);
  writeLine(`Tax (${invoice.tax_rate}%): ${money(tax)}`);
  writeLine(`Total: ${money(subtotal + tax)}`);
  writeLine(`Payment method: ${invoice.payment_method || ""}`);
  if (invoice.iban) {
    writeLine(`IBAN: ${invoice.iban}`);
  }
  if (invoice.bic) {
    writeLine(`BIC: ${invoice.bic}`);
  }

  const filename = invoice.invoice_number.replace(/[^\w.-]/g, "_");
  doc.save(`${filename}.pdf`);
}

loadCompanies();
loadInvoiceNumbers();
