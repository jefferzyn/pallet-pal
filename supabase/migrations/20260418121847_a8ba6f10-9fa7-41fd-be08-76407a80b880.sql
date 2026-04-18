
-- Roles enum and table
create type public.app_role as enum ('admin', 'manager', 'worker');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer role check (avoids recursive RLS)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin_or_manager(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin','manager')
  )
$$;

-- Profiles (display name)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Warehouses
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.warehouses enable row level security;

-- Worker -> warehouse assignments (workers only see assigned ones)
create table public.user_warehouses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, warehouse_id)
);
alter table public.user_warehouses enable row level security;

create or replace function public.can_access_warehouse(_user_id uuid, _warehouse_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    public.is_admin_or_manager(_user_id)
    or exists (
      select 1 from public.user_warehouses
      where user_id = _user_id and warehouse_id = _warehouse_id
    )
$$;

-- Products catalog (UPC-keyed, shared across org)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  upc text not null unique,
  name text not null,
  brand text,
  image_url text,
  default_units_per_box integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;

-- Pallets
create type public.pallet_status as enum ('draft','counted','confirmed','archived');

create table public.pallets (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  upc text,
  ai_count integer,
  ai_confidence numeric(3,2),
  ai_reasoning text,
  final_count integer,
  status pallet_status not null default 'draft',
  video_path text,
  notes text,
  captured_by uuid references auth.users(id) on delete set null,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pallets enable row level security;
create index pallets_warehouse_idx on public.pallets(warehouse_id);
create index pallets_product_idx on public.pallets(product_id);

-- Audit log of count edits
create table public.pallet_count_history (
  id uuid primary key default gen_random_uuid(),
  pallet_id uuid not null references public.pallets(id) on delete cascade,
  previous_count integer,
  new_count integer not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.pallet_count_history enable row level security;

-- Generic updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();
create trigger warehouses_updated before update on public.warehouses
  for each row execute function public.tg_set_updated_at();
create trigger products_updated before update on public.products
  for each row execute function public.tg_set_updated_at();
create trigger pallets_updated before update on public.pallets
  for each row execute function public.tg_set_updated_at();

-- Auto-create profile + first user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _is_first boolean;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  select count(*) = 0 into _is_first from public.user_roles;
  if _is_first then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'worker');
  end if;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== RLS POLICIES =====

-- profiles: own + admin/manager read all
create policy "profiles_select_own_or_mgmt" on public.profiles for select
  using (id = auth.uid() or public.is_admin_or_manager(auth.uid()));
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid());

-- user_roles: read own or mgmt; only admin can change
create policy "roles_select" on public.user_roles for select
  using (user_id = auth.uid() or public.is_admin_or_manager(auth.uid()));
create policy "roles_admin_all" on public.user_roles for all
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- warehouses: workers see assigned, mgmt sees all
create policy "warehouses_select" on public.warehouses for select
  using (
    public.is_admin_or_manager(auth.uid())
    or exists (select 1 from public.user_warehouses
               where warehouse_id = warehouses.id and user_id = auth.uid())
  );
create policy "warehouses_mgmt_write" on public.warehouses for all
  using (public.is_admin_or_manager(auth.uid()))
  with check (public.is_admin_or_manager(auth.uid()));

-- user_warehouses: read own or mgmt; only mgmt writes
create policy "uw_select" on public.user_warehouses for select
  using (user_id = auth.uid() or public.is_admin_or_manager(auth.uid()));
create policy "uw_mgmt_write" on public.user_warehouses for all
  using (public.is_admin_or_manager(auth.uid()))
  with check (public.is_admin_or_manager(auth.uid()));

-- products: any authenticated user can read; any authenticated can insert/update (catalog grows)
create policy "products_select_auth" on public.products for select
  to authenticated using (true);
create policy "products_insert_auth" on public.products for insert
  to authenticated with check (auth.uid() is not null);
create policy "products_update_auth" on public.products for update
  to authenticated using (auth.uid() is not null);
create policy "products_delete_mgmt" on public.products for delete
  using (public.is_admin_or_manager(auth.uid()));

-- pallets: scoped by warehouse access; mgmt edit/delete
create policy "pallets_select" on public.pallets for select
  using (public.can_access_warehouse(auth.uid(), warehouse_id));
create policy "pallets_insert" on public.pallets for insert
  with check (public.can_access_warehouse(auth.uid(), warehouse_id) and captured_by = auth.uid());
create policy "pallets_update" on public.pallets for update
  using (
    public.is_admin_or_manager(auth.uid())
    or (captured_by = auth.uid() and public.can_access_warehouse(auth.uid(), warehouse_id))
  );
create policy "pallets_delete_mgmt" on public.pallets for delete
  using (public.is_admin_or_manager(auth.uid()));

-- count history: same access as pallet
create policy "pch_select" on public.pallet_count_history for select
  using (exists (select 1 from public.pallets p
                 where p.id = pallet_id and public.can_access_warehouse(auth.uid(), p.warehouse_id)));
create policy "pch_insert" on public.pallet_count_history for insert
  with check (exists (select 1 from public.pallets p
                      where p.id = pallet_id and public.can_access_warehouse(auth.uid(), p.warehouse_id)));

-- ===== STORAGE: pallet videos (private) =====
insert into storage.buckets (id, name, public) values ('pallet-videos','pallet-videos', false)
  on conflict (id) do nothing;

create policy "videos_select" on storage.objects for select
  using (bucket_id = 'pallet-videos' and auth.uid() is not null);
create policy "videos_insert" on storage.objects for insert
  with check (bucket_id = 'pallet-videos' and auth.uid() is not null
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos_delete_own_or_mgmt" on storage.objects for delete
  using (bucket_id = 'pallet-videos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin_or_manager(auth.uid())
  ));
