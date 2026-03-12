/**
 * Test: Authentication & authorisation guards
 *
 * 1. Admin-only endpoints called with no token           → 401
 * 2. Admin-only endpoints called with a parent JWT       → 403
 * 3. Parent portal endpoints called with an admin JWT    → 403
 * 4. Parent2 JWT accessing parent1's child data          → 403
 *
 * Requires the server to be running (npm run dev) and the DB to be seeded
 * (npm run seed).  Makes real HTTP requests — no mocking.
 */

import 'dotenv/config';
import prisma from '../../src/config/prisma';
import { signToken } from '../../src/utils/jwt';

const BASE_URL = `http://localhost:${process.env.PORT || 5001}`;

// ─── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label: string) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label: string, reason: string) {
  console.error(`  FAIL  ${label}`);
  console.error(`        reason: ${reason}`);
  failed++;
}

async function req(
  path: string,
  token?: string,
  method = 'GET',
  body?: object,
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

async function assertStatus(
  label: string,
  path: string,
  expected: number,
  token?: string,
  method = 'GET',
  body?: object,
) {
  const { status, json } = await req(path, token, method, body);
  if (status === expected) {
    pass(`[${expected}] ${label}`);
  } else {
    fail(
      `[${expected}] ${label}`,
      `expected HTTP ${expected}, got ${status}` +
        (json?.message ? ` — "${json.message}"` : ''),
    );
  }
}

async function serverIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Auth & Authorisation Test ===\n');

  if (!(await serverIsUp())) {
    console.error(`FAIL — Server not reachable at ${BASE_URL}. Run: npm run dev`);
    process.exitCode = 1;
    return;
  }

  // ── Resolve users from DB ──────────────────────────────────────────────────
  const [admin, parent1, parent2] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'admin@school.com' } }),
    prisma.user.findUnique({ where: { email: 'parent1@test.com' } }),
    prisma.user.findUnique({ where: { email: 'parent2@test.com' } }),
  ]);

  if (!admin || !parent1 || !parent2) {
    console.error('FAIL — Seed users not found. Run: npm run seed');
    process.exitCode = 1;
    return;
  }

  // Arjun Kumar (STU001) belongs to parent1; we need his DB id for cross-parent check
  const arjun = await prisma.student.findUnique({
    where: { admissionNumber: 'STU001' },
    select: { id: true, parentId: true },
  });

  if (!arjun || arjun.parentId !== parent1.id) {
    console.error('FAIL — STU001 not found or not owned by parent1. Run: npm run seed');
    process.exitCode = 1;
    return;
  }

  console.log(`  admin   : ${admin.email}  (id ${admin.id})`);
  console.log(`  parent1 : ${parent1.email}  (id ${parent1.id})`);
  console.log(`  parent2 : ${parent2.email}  (id ${parent2.id})`);
  console.log(`  STU001  : Arjun Kumar  (id ${arjun.id}, owned by parent1)\n`);

  // Mint JWTs (no DB call — same logic as the real auth controller)
  const adminJwt   = signToken({ userId: admin.id,   role: 'ADMIN',  email: admin.email });
  const parent1Jwt = signToken({ userId: parent1.id, role: 'PARENT', email: parent1.email });
  const parent2Jwt = signToken({ userId: parent2.id, role: 'PARENT', email: parent2.email });

  // ── Check 1: Admin-only endpoints — no token → 401 ────────────────────────
  console.log('Check 1 — Admin-only endpoints without any JWT → 401');
  await assertStatus('GET  /api/admin/students',          '/api/admin/students',                                          401);
  await assertStatus('POST /api/admin/student',           '/api/admin/student',                                           401, undefined, 'POST', { name: 'x' });
  await assertStatus('GET  /api/admin/stats',             '/api/admin/stats',                                             401);
  await assertStatus('GET  /api/admin/audit-logs',        '/api/admin/audit-logs',                                        401);
  await assertStatus('GET  /api/ledger/',                 '/api/ledger/',                                                 401);
  await assertStatus('PATCH /api/ledger/:id (fake id)',   '/api/ledger/00000000-0000-0000-0000-000000000000',             401, undefined, 'PATCH', {});

  // ── Check 2: Admin-only endpoints — parent JWT → 403 ─────────────────────
  console.log('\nCheck 2 — Admin-only endpoints with parent JWT → 403');
  await assertStatus('GET  /api/admin/students',          '/api/admin/students',           403, parent1Jwt);
  await assertStatus('POST /api/admin/student',           '/api/admin/student',            403, parent1Jwt, 'POST', { name: 'x' });
  await assertStatus('GET  /api/admin/stats',             '/api/admin/stats',              403, parent1Jwt);
  await assertStatus('GET  /api/admin/audit-logs',        '/api/admin/audit-logs',         403, parent1Jwt);
  await assertStatus('GET  /api/ledger/ (admin-only)',    '/api/ledger/',                  403, parent1Jwt);
  await assertStatus('PATCH /api/ledger/:id (admin-only)','/api/ledger/00000000-0000-0000-0000-000000000000', 403, parent1Jwt, 'PATCH', {});

  // ── Check 3: Parent portal endpoints — admin JWT → 403 ───────────────────
  console.log('\nCheck 3 — Parent portal endpoints with admin JWT → 403');
  await assertStatus('GET /api/parent/children',                  '/api/parent/children',                   403, adminJwt);
  await assertStatus('GET /api/parent/student/:id',               `/api/parent/student/${arjun.id}`,        403, adminJwt);
  await assertStatus('GET /api/parent/student/:id/ledger',        `/api/parent/student/${arjun.id}/ledger`, 403, adminJwt);

  // ── Check 4: Parent2 accessing parent1's child data → 403 ─────────────────
  console.log('\nCheck 4 — Parent2 JWT accessing parent1\'s child (STU001) → 403');
  await assertStatus('GET /api/parent/student/:arjunId',        `/api/parent/student/${arjun.id}`,        403, parent2Jwt);
  await assertStatus('GET /api/parent/student/:arjunId/ledger', `/api/parent/student/${arjun.id}/ledger`, 403, parent2Jwt);

  // ── Sanity check: parent1 can access her own child ────────────────────────
  console.log('\nSanity — Parent1 can access her own child (STU001) → 200');
  await assertStatus('GET /api/parent/student/:arjunId',        `/api/parent/student/${arjun.id}`,        200, parent1Jwt);
  await assertStatus('GET /api/parent/student/:arjunId/ledger', `/api/parent/student/${arjun.id}/ledger`, 200, parent1Jwt);
  await assertStatus('GET /api/parent/children',                '/api/parent/children',                   200, parent1Jwt);

  // ── Result ─────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  if (failed === 0) {
    console.log(`\nPASS — All ${passed} checks passed.`);
  } else {
    console.error(`\nFAIL — ${failed} of ${passed + failed} checks failed (see above).`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => { console.error('Unexpected error:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
