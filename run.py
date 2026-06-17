"""Structured entry point for the Defect Tracker Flask app."""

from app import create_app


application = create_app()


if __name__ == "__main__":
    application.run(debug=True)
