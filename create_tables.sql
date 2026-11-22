-- Database schema: tables and the relations between them.
-- Run once on an empty database. Data lives in add_invoices.sql.

-- Companies act as both sellers and buyers.
CREATE TABLE companies (
    company_id  serial PRIMARY KEY,
    name        text NOT NULL,
    street      text,
    city        text,
    postal_code text,
    country     char(2),
    vat_number  text
);

-- Each invoice has one seller and one buyer (both companies).
CREATE TABLE invoices (
    invoice_id     serial PRIMARY KEY,
    invoice_number text NOT NULL UNIQUE,
    invoice_date   date NOT NULL,
    due_date       date NOT NULL,
    seller_id      int REFERENCES companies (company_id),
    buyer_id       int REFERENCES companies (company_id),
    tax_rate       numeric(5, 2) NOT NULL,
    payment_method text,
    iban           text,
    bic            text
);

-- Each invoice has one or more line items.
CREATE TABLE invoice_items (
    item_id     serial PRIMARY KEY,
    invoice_id  int REFERENCES invoices (invoice_id),
    description text NOT NULL,
    quantity    numeric NOT NULL,
    unit_price  numeric(12, 2) NOT NULL
);
