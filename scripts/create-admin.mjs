#!/usr/bin/env node
/**
 * Creates (or promotes) an admin user.
 *
 *   npm run create-admin -- you@example.com "StrongPassword123" [owner|admin|staff] ["Full Name"]
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * The service-role key is used here only, on your own machine. Never commit it.
 */
import { createClient } from "@supabase/supabase-js";

const [email, password, role = "owner", ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(" ");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function die(message) {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

if (!url || !serviceKey) die("Postavite NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY u .env.local.");
if (!email || !password) die('Upotreba: npm run create-admin -- email@primer.com "Lozinka" [owner|admin|staff] ["Ime Prezime"]');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) die("Neispravna e-adresa.");
if (password.length < 10) die("Lozinka mora imati najmanje 10 karaktera.");
if (!["owner", "admin", "staff"].includes(role)) die("Uloga mora biti owner, admin ili staff.");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(target) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

try {
  let user = await findUserByEmail(email);
  if (user) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (error) throw error;
    console.log(`  • Korisnik već postoji — lozinka je ažurirana.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    user = data.user;
    console.log(`  • Korisnik je kreiran.`);
  }

  const { error } = await supabase
    .from("admin_users")
    .upsert({ user_id: user.id, email, full_name: fullName, role }, { onConflict: "user_id" });
  if (error) throw error;

  console.log(`\n  ✔ ${email} je sada ${role}. Prijava: /admin/login\n`);
} catch (err) {
  die(`Nije uspelo: ${err?.message ?? err}\n    Da li ste pokrenuli supabase/migrations/0001_init.sql?`);
}
