-- =========================================================
-- BougieSec — mise en place de la base de données (Supabase)
-- ---------------------------------------------------------
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query
-- > coller tout ce fichier > Run.
--
-- AVANT D'EXÉCUTER : remplacez VOTRE_EMAIL_ADMIN (2 occurrences
-- dans la fonction is_bougiesec_admin) par l'email du compte
-- administrateur que vous créez dans Authentication > Users.
-- =========================================================

-- ---------- Tables ----------

create table if not exists public.products (
    id           text primary key,
    category     text not null,
    name         text not null,
    price        numeric,
    availability text not null default 'disponible'
                 check (availability in ('disponible', 'limite', 'indisponible')),
    position     integer not null default 0,
    updated_at   timestamptz not null default now()
);

create table if not exists public.orders (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),
    type            text not null default 'demande' check (type in ('commande', 'demande')),
    lastname        text not null,
    firstname       text not null,
    phone           text not null,
    email           text,
    subject         text,
    message         text,
    items           jsonb not null default '[]'::jsonb,
    total_bags      integer not null default 0,
    total_weight    numeric not null default 0,
    estimated_total numeric,
    status          text not null default 'nouveau'
                    check (status in ('nouveau', 'en_cours', 'traite', 'annule')),
    admin_note      text
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- ---------- Qui est administrateur ? ----------
-- Seul le compte dont l'email correspond a le droit de lire / modifier les commandes.

create or replace function public.is_bougiesec_admin()
returns boolean
language sql
stable
as $$
    select coalesce(auth.jwt() ->> 'email', '') = 'VOTRE_EMAIL_ADMIN'
$$;

-- ---------- Sécurité (Row Level Security) ----------

alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- Produits : tout le monde peut lire (le site public), seul l'admin peut modifier
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
    for select to anon, authenticated using (true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
    for all to authenticated
    using (public.is_bougiesec_admin()) with check (public.is_bougiesec_admin());

-- Commandes : un visiteur peut ENVOYER une commande (jamais la relire),
-- seul l'admin peut les lire, modifier ou supprimer.
drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders
    for insert to anon, authenticated
    with check (
        status = 'nouveau'
        and admin_note is null
        and length(lastname)  <= 100
        and length(firstname) <= 100
        and length(phone)     <= 40
        and coalesce(length(message), 0) <= 4000
    );

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
    for all to authenticated
    using (public.is_bougiesec_admin()) with check (public.is_bougiesec_admin());
