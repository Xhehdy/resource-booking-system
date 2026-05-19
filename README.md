<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Resource Booking System

This app is a React + Express resource booking system backed by Supabase Postgres.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy [.env.example](.env.example) to `.env` and fill in:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
3. Create the tables in Supabase using [schema.sql](schema.sql).
4. Run the app:
   ```bash
   npm run dev
   ```

## Notes

- The server seeds base resources and a default admin user on startup if they do not exist.
- The default admin credentials are `admin` / `admin123`; change them after first login.
- The app uses the Supabase service role key on the server only. Do not expose it in client code.
