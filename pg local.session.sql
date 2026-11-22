CREATE TABLE companies (
    company_id serial PRIMARY KEY,
    name text NOT NULL,
    street text,
    city text,
    postal_code text,
    country char(2),
    vat_number text
);
CREATE TABLE invoices (
    invoice_id serial PRIMARY KEY,
    invoice_number text NOT NULL UNIQUE,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    seller_id int REFERENCES companies,
    buyer_id int REFERENCES companies,
    tax_rate numeric(5, 2) NOT NULL,
    payment_method text,
    iban text,
    bic text
);
CREATE TABLE invoice_items (
    item_id serial PRIMARY KEY,
    invoice_id int REFERENCES invoices,
    description text NOT NULL,
    quantity numeric NOT NULL,
    unit_price numeric(12, 2) NOT NULL
);



INSERT INTO companies (
        name,
        street,
        city,
        postal_code,
        country,
        vat_number
    )
VALUES (
        'Company A',
        'Musterstrasse 1',
        'Berlin',
        '10115',
        'DE',
        'DE123456789'
    ),
    (
        'Company B',
        'Beispielweg 2',
        'Hamburg',
        '20095',
        'DE',
        'DE987654321'
    );

SELECT * FROM companies;

INSERT INTO invoices (
        invoice_number,
        invoice_date,
        due_date,
        seller_id,
        buyer_id,
        tax_rate,
        payment_method,
        iban,
        bic
    )
VALUES (
        'INV-20241215-001',
        '2024-12-15',
        '2025-01-15',
        1,
        2,
        19.00,
        'Bank transfer',
        'DE12345678901234567890',
        'DEUTDEFFXXX'
    );

select * from invoices;

INSERT INTO invoice_items (invoice_id,
    description,
    quantity,
    unit_price
    )
VALUES (
    1,
    'Delivery of product X',
    1,
    1000.00
);



SELECT (
        SELECT count(*)
        FROM companies
    ) AS companies,
    (
        SELECT count(*)
        FROM invoices
    ) AS invoices,
    (
        SELECT count(*)
        FROM invoice_items
    ) AS invoice_items;
SELECT invoice_number
FROM invoices;
SELECT current_database(),
    current_schema();