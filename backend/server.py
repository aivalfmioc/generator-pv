import json
import logging
import os
from decimal import Decimal
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
from psycopg.rows import dict_row


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class RequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/database":
            self.handle_database_request()
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
    print("Open http://127.0.0.1:8000/invoices.html")
    server.serve_forever()
