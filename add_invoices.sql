-- Sample data: companies, invoices and invoice items.
-- Run after "pg local.session.sql". Safe to run again: rows that already exist are skipped.
BEGIN;

-- Companies
INSERT INTO companies (name, street, city, postal_code, country, vat_number)
SELECT * FROM (
    VALUES
        ('Company A', 'Musterstrasse 1', 'Berlin',  '10115', 'DE', 'DE123456789'),
        ('Company B', 'Beispielweg 2',   'Hamburg', '20095', 'DE', 'DE987654321')
) AS c (name, street, city, postal_code, country, vat_number)
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE companies.name = c.name);

-- Invoices (seller/buyer looked up by company name)
INSERT INTO invoices (
        invoice_number, invoice_date, due_date, seller_id, buyer_id,
        tax_rate, payment_method, iban, bic
    )
SELECT v.invoice_number, v.invoice_date::date, v.due_date::date, s.company_id, b.company_id,
       v.tax_rate, v.payment_method, v.iban, v.bic
FROM (
    VALUES
        ('INV-20241215-001', '2024-12-15', '2025-01-15', 'Company A', 'Company B', 19.00, 'Bank transfer', 'DE12345678901234567890', 'DEUTDEFFXXX'),
        ('INV-20250110-002', '2025-01-10', '2025-02-10', 'Company A', 'Company B', 19.00, 'Bank transfer', 'DE12345678901234567890', 'DEUTDEFFXXX'),
        ('INV-20250205-003', '2025-02-05', '2025-03-05', 'Company A', 'Company B', 19.00, 'Bank transfer', 'DE12345678901234567890', 'DEUTDEFFXXX'),
        ('INV-20250312-004', '2025-03-12', '2025-04-12', 'Company B', 'Company A',  7.00, 'Bank transfer', 'DE98765432109876543210', 'COBADEFFXXX'),
        ('INV-20250420-005', '2025-04-20', '2025-05-20', 'Company A', 'Company B', 19.00, 'Bank transfer', 'DE12345678901234567890', 'DEUTDEFFXXX'),
        ('INV-20250518-006', '2025-05-18', '2025-06-18', 'Company B', 'Company A', 19.00, 'Bank transfer', 'DE98765432109876543210', 'COBADEFFXXX')
) AS v (invoice_number, invoice_date, due_date, seller, buyer, tax_rate, payment_method, iban, bic)
JOIN companies AS s ON s.name = v.seller
JOIN companies AS b ON b.name = v.buyer
ON CONFLICT (invoice_number) DO NOTHING;

-- Invoice items (added only to invoices that have no items yet)
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price)
SELECT i.invoice_id, v.description, v.quantity, v.unit_price
FROM (
    VALUES
        ('INV-20241215-001', 'Delivery of product X',        1, 1000.00),
        ('INV-20250110-002', 'Consulting services',          8,  120.00),
        ('INV-20250205-003', 'Delivery of product Y',        3,  450.00),
        ('INV-20250312-004', 'Printed brochures',          500,    0.80),
        ('INV-20250420-005', 'Software license (annual)',    1, 2400.00),
        ('INV-20250518-006', 'Maintenance and support',     12,   75.00)
) AS v (invoice_number, description, quantity, unit_price)
JOIN invoices AS i ON i.invoice_number = v.invoice_number
WHERE NOT EXISTS (SELECT 1 FROM invoice_items WHERE invoice_items.invoice_id = i.invoice_id);

COMMIT;

-- Check the result
SELECT
    (SELECT count(*) FROM companies)     AS companies,
    (SELECT count(*) FROM invoices)      AS invoices,
    (SELECT count(*) FROM invoice_items) AS invoice_items;
