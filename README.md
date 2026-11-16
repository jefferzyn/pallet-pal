## Pallet Inventory Counter

### Core flow (warehouse worker on phone)

1. Pick or create a **Warehouse → Pallet**.
2. **Scan UPC barcode** of one box on the pallet (camera). System auto-fills product info from free Open Facts databases when available. If unknown, user fills it in once and it's saved to the catalog.
3. **Record/upload a short video** walking around the pallet (multiple angles).
4. AI vision analyzes the video frames → returns **estimated box count** + reasoning.
5. Worker reviews the suggested count, can **adjust ± manually**, and confirms.
6. Pallet entry saved with: product, AI count, final count, video, timestamp, worker, location.

### Pages / routes

- `/login` + `/signup` — email auth (Cloud)
- `/` — Dashboard: total inventory, recent pallets, low-detection alerts
- `/warehouses` — list/create warehouses, locations, zones
- `/warehouses/$id` — pallets in this warehouse
- `/pallets/new` — capture flow (barcode → video → AI count → confirm)
- `/pallets/$id` — pallet detail (video playback, count history, edit)
- `/inventory` — searchable/filterable table of all items across warehouses, CSV export
- `/catalog` — UPC product catalog (auto-filled + manual entries)
- `/admin/users` — manager-only: add workers, assign warehouses

### Roles

- **Worker** — capture pallets in assigned warehouses
- **Manager** — all warehouses, edit/delete, manage users, export
- **Admin** — full access

### Key technical decisions

- **AI counting**: AI Gateway with `google/gemini-2.5-pro` (multimodal vision). Extract ~6–10 frames from the video server-side, send to Gemini with a structured prompt → JSON `{ estimated_count, confidence, reasoning, visible_boxes_per_face }`. Always show this as a **suggestion**, never silently authoritative.
- **Barcode scanning**: `@zxing/browser` library — works on mobile + desktop webcam, no native install.
- **UPC lookup**: Free Open Facts databases first (`Open Food Facts`, `Open Beauty Facts`, `Open Pet Food Facts`, then `Open Products Facts`) with fallback to manual entry; results cached in our `products` catalog table.
- **Video storage**: Lovable Cloud storage bucket (private), 30s max, compressed client-side before upload.
- **Mobile-first UI**: Large touch targets, camera-first capture screens; full table/dashboard views on desktop.

### Cloudflare deployment notes

- The app uses Supabase as the database. Cloudflare must provide both server and Vite public variables:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Keep `SUPABASE_SERVICE_ROLE_KEY` as a Cloudflare secret only for trusted server-side admin code.
- `VITE_BARCODE_LOOKUP_API_KEY` is no longer required for UPC lookup.
- Enable Supabase Auth email confirmations so new signups receive a verification email before sign-in.

### Local environment

Copy `.env.example` to `.env` and set the Supabase project URL and publishable key. Keep `.env` and all service-role or deployment credentials out of version control.

### Data model (high level)

- `warehouses` (name, address, manager)
- `pallets` (warehouse_id, product_id, ai_count, final_count, status, video_url, captured_by, captured_at, notes)
- `products` (upc, name, brand, image_url, default_units_per_box) — internal catalog, grows over time
- `pallet_count_history` (audit log of count edits)
- `user_roles` (separate table — worker / manager / admin)
- `user_warehouses` (which warehouses each worker can access)

### Honest limitations called out in UI

- AI count shown with a confidence badge + "Verify before confirming" hint
- One-tap +/- adjustment buttons next to AI estimate
- Option to "Recapture video" if confidence is low

### Out of scope (v1)

- Real-time live counting from camera stream (videos uploaded then analyzed)
- Multi-SKU per pallet (v1 = one product per pallet; can be added later)
- Offline capture with sync
