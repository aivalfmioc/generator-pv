import json
import logging
import os
from decimal import Decimal
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

import psycopg
from psycopg.rows import dict_row


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class RequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/companies":
            self.handle_companies_request()
            return
        if path == "/api/database":
            self.handle_database_request()
            return

        prefix = "/api/invoices/"
        if path.startswith(prefix):
            invoice_number = unquote(path[len(prefix):])
            self.handle_invoice_request(invoice_number)
            return
        super().do_GET()

    def handle_database_request(self):
        try:
            with psycopg.connect(
                host=os.getenv("PGHOST", "localhost"),
                port=int(os.getenv("PGPORT", "5432")),
                dbname=os.environ["PGDATABASE"],
                user=os.environ["PGUSER"],
                password=os.environ["PGPASSWORD"],
                row_factory=dict_row,
            ) as connection:
                companies = connection.execute(
                    """
                    SELECT company_id, name, street, city, postal_code, country, vat_number
                    FROM companies
                    ORDER BY company_id
                    """
                ).fetchall()
                invoices = connection.execute(
                    """
                    SELECT i.invoice_id, i.invoice_number, i.invoice_date, i.due_date,
                           i.seller_id, i.buyer_id, i.tax_rate, i.payment_method, i.iban, i.bic
                    FROM invoices AS i
                    ORDER BY i.invoice_id
                    """
                ).fetchall()
                items = connection.execute(
                    """
                    SELECT item_id, invoice_id, description, quantity, unit_price
                    FROM invoice_items
                    ORDER BY item_id
                    """
                ).fetchall()

            for invoice in invoices:
                invoice["invoice_date"] = invoice["invoice_date"].isoformat()
                invoice["due_date"] = invoice["due_date"].isoformat()

            self.send_json(
                200,
                {
                    "companies": companies,
                    "invoices": invoices,
                    "invoice_items": items,
                },
            )
        except KeyError as error:
            logging.exception("Missing database configuration: %s", error)
            self.send_json(500, {"error": "Database configuration is incomplete."})
        except (psycopg.Error, ValueError):
            logging.exception("Could not load database records")
            self.send_json(500, {"error": "Could not read the database."})

    def handle_companies_request(self):
        try:
            with psycopg.connect(
                host=os.getenv("PGHOST", "localhost"),
                port=int(os.getenv("PGPORT", "5432")),
                dbname=os.environ["PGDATABASE"],
                user=os.environ["PGUSER"],
                password=os.environ["PGPASSWORD"],
                row_factory=dict_row,
            ) as connection:
                companies = connection.execute(
                    "SELECT DISTINCT name FROM companies ORDER BY name"
                ).fetchall()
            self.send_json(
                200, {"companies": [company["name"] for company in companies]}
            )
        except KeyError as error:
            logging.exception("Missing database configuration: %s", error)
            self.send_json(500, {"error": "Database configuration is incomplete."})
        except (psycopg.Error, ValueError):
            logging.exception("Could not load company names")
            self.send_json(500, {"error": "Could not read the company database."})

    def handle_invoice_request(self, invoice_number):
        if not invoice_number:
            self.send_json(400, {"error": "Invoice number is required."})
            return

        try:
            with psycopg.connect(
                host=os.getenv("PGHOST", "localhost"),
                port=int(os.getenv("PGPORT", "5432")),
                dbname=os.environ["PGDATABASE"],
                user=os.environ["PGUSER"],
                password=os.environ["PGPASSWORD"],
                row_factory=dict_row,
            ) as connection:
                invoice = connection.execute(
                    """
                    SELECT
                        i.invoice_id,
                        i.invoice_number,
                        i.invoice_date,
                        i.due_date,
                        i.tax_rate,
                        i.payment_method,
                        i.iban,
                        i.bic,
                        seller.name AS seller_name,
                        seller.street AS seller_street,
                        seller.city AS seller_city,
                        seller.postal_code AS seller_postal_code,
                        seller.vat_number AS seller_vat_number,
                        buyer.name AS buyer_name,
                        buyer.street AS buyer_street,
                        buyer.city AS buyer_city,
                        buyer.postal_code AS buyer_postal_code,
                        buyer.vat_number AS buyer_vat_number
                    FROM invoices AS i
                    JOIN companies AS seller ON seller.company_id = i.seller_id
                    JOIN companies AS buyer ON buyer.company_id = i.buyer_id
                    WHERE i.invoice_number = %s
                    """,
                    (invoice_number,),
                ).fetchone()

                if invoice is None:
                    self.send_json(404, {"error": "Invoice not found."})
                    return

                items = connection.execute(
                    """
                    SELECT description, quantity, unit_price
                    FROM invoice_items
                    WHERE invoice_id = %s
                    ORDER BY item_id
                    """,
                    (invoice["invoice_id"],),
                ).fetchall()

            response_invoice = {
                "invoice_number": invoice["invoice_number"],
                "invoice_date": invoice["invoice_date"].isoformat(),
                "due_date": invoice["due_date"].isoformat(),
                "tax_rate": float(invoice["tax_rate"]),
                "payment_method": invoice["payment_method"],
                "iban": invoice["iban"],
                "bic": invoice["bic"],
                "seller": {
                    "name": invoice["seller_name"],
                    "street": invoice["seller_street"],
                    "city": invoice["seller_city"],
                    "postal_code": invoice["seller_postal_code"],
                    "vat_number": invoice["seller_vat_number"],
                },
                "buyer": {
                    "name": invoice["buyer_name"],
                    "street": invoice["buyer_street"],
                    "city": invoice["buyer_city"],
                    "postal_code": invoice["buyer_postal_code"],
                    "vat_number": invoice["buyer_vat_number"],
                },
            }
            response_items = [
                {
                    "description": item["description"],
                    "quantity": float(item["quantity"]),
                    "unit_price": float(item["unit_price"]),
                }
                for item in items
            ]
            self.send_json(
                200, {"invoice": response_invoice, "items": response_items}
            )
        except KeyError as error:
            logging.exception("Missing database configuration: %s", error)
            self.send_json(500, {"error": "Database configuration is incomplete."})
        except (psycopg.Error, ValueError):
            logging.exception("Could not load invoice %s", invoice_number)
            self.send_json(500, {"error": "Could not read the invoice database."})

    def send_json(self, status, data):
        payload = json.dumps(data, default=decimal_to_float).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def decimal_to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    server = ThreadingHTTPServer(("127.0.0.1", 8000), RequestHandler)
    print("Open http://127.0.0.1:8000/database.html")
    print("Invoice generator: http://127.0.0.1:8000/pdf.html")
    server.serve_forever()
