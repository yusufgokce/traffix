-- Traffix simulator schema.

-- Lot layouts (the LotSpec JSON from src/sim/lots).
create table if not exists lots (
  id text primary key,
  name text not null,
  spec jsonb not null,
  created_at timestamptz not null default now()
);

-- One row per with/without comparison run.
create table if not exists sim_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lot_id text not null,
  scenario text not null,
  seed integer not null,
  compliance real not null,
  sim_seconds integer not null,
  baseline jsonb not null,
  traffix jsonb not null
);

-- Parking sessions from the driver app. Times are simulated seconds.
create table if not exists parking_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lot_id text not null,
  plate text not null,
  spot_id text,
  sim_entered integer,
  sim_parked integer,
  sim_exited integer,
  amount_cents integer not null default 0
);

alter table lots enable row level security;
alter table sim_runs enable row level security;
alter table parking_sessions enable row level security;

-- Demo access: anyone with the anon key can read lots and runs and add rows.
-- Plates are write-only from the browser.
create policy "lots readable" on lots for select using (true);
create policy "runs readable" on sim_runs for select using (true);
create policy "runs insertable" on sim_runs for insert with check (true);
create policy "sessions insertable" on parking_sessions for insert with check (true);
