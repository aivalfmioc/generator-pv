let databaseData = null;
let currentTable = "invoices";

async function loadDatabase() {
  const status = document.getElementById("status");
  status.textContent = "Loading...";

  try {
    const response = await fetch("/api/database");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load the database.");
    }

    databaseData = result;
    status.textContent = `${countRows()} rows`;
    renderTable(currentTable);
  } catch (error) {
    status.textContent = error.message || "Could not load the database.";
  }
}

function countRows() {
  return databaseData[currentTable].length;
}

function formatValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function renderTable(tableName) {
  if (!databaseData) {
    return;
  }

  currentTable = tableName;
  const companiesById = new Map(
    databaseData.companies.map((company) => [company.company_id, company.name])
  );
  const rows = tableName === "invoices"
    ? databaseData.invoices.map((invoice) => ({
        ...invoice,
        seller_name: companiesById.get(invoice.seller_id) || "",
        buyer_name: companiesById.get(invoice.buyer_id) || "",
      }))
    : databaseData[tableName];
  const head = document.getElementById("table-head");
  const body = document.getElementById("table-body");
  const status = document.getElementById("status");

  head.replaceChildren();
  body.replaceChildren();

  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.textContent = "No records found.";
    row.appendChild(cell);
    body.appendChild(row);
    status.textContent = "0 rows";
    return;
  }

  const columns = Object.keys(rows[0]);
  const headerRow = document.createElement("tr");
  for (const column of columns) {
    const th = document.createElement("th");
    th.textContent = column;
    headerRow.appendChild(th);
  }
  head.appendChild(headerRow);

  for (const record of rows) {
    const row = document.createElement("tr");
    for (const column of columns) {
      const td = document.createElement("td");
      td.textContent = formatValue(record[column]);
      row.appendChild(td);
    }
    body.appendChild(row);
  }

  status.textContent = `${rows.length} rows`;

  for (const button of document.querySelectorAll(".table-button")) {
    button.classList.toggle("active", button.dataset.table === tableName);
  }
}

for (const button of document.querySelectorAll(".table-button")) {
  button.addEventListener("click", () => renderTable(button.dataset.table));
}

loadDatabase();
