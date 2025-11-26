## Installation
1. Create virtual env via `python3 -m venv .venv`
2. Activate virtual environment via `source .venv/bin/activate`
3. Create .env with the following variables

`DATABASE_URL=postgresql://postgres@localhost:5432/cafe_local`

`JWT_SECRET = PUT_JWT_HERE`

`APP_ENV = dev` <= either "prod" or "dev"

4. Make sure to install all dependencies with `pip3 install -r requirements.txt`
5. (Optional) If you caught an error with WeasyPrint, feel free to check: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation (but imho on Linux there's should be no problem with it though)

