/**
 * E2E Test: Admin login flow
 *
 * 1. Opens the frontend login page
 * 2. Submits valid admin credentials
 * 3. Confirms redirect to admin dashboard
 * 4. Confirms dashboard content is visible
 * 5. Tests invalid credentials show an error message
 * 6. Prints PASS or FAIL with reason
 */

import {
  launchBrowser, newPage, closeBrowser, login,
  assert, printSummary,
  BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD,
} from '../helpers/browser';

async function main() {
  console.log('=== E2E: Admin Login Flow ===\n');
  console.log(`Frontend: ${BASE_URL}\n`);

  const browser = await launchBrowser(true); // set false to watch in browser
  const page    = await newPage(browser);

  try {
    // ── Test 1: Login page loads ────────────────────────────────────────────
    console.log('── Login page ──────────────────────────────────');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

    const emailInput    = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitButton  = await page.$('button[type="submit"]');

    assert('Email input present',    !!emailInput,    'No email input found on /login');
    assert('Password input present', !!passwordInput, 'No password input found on /login');
    assert('Submit button present',  !!submitButton,  'No submit button found on /login');

    // ── Test 2: Invalid credentials show error ──────────────────────────────
    console.log('\n── Invalid credentials ─────────────────────────');
    await page.type('input[type="email"]',    'wrong@example.com');
    await page.type('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Wait briefly for error toast/message
    await new Promise(r => setTimeout(r, 2000));

    const currentUrlAfterBadLogin = page.url();
    assert(
      'Stays on login page after bad credentials',
      currentUrlAfterBadLogin.includes('/login'),
      `Redirected away to ${currentUrlAfterBadLogin}`
    );

    // ── Test 3: Valid admin login ───────────────────────────────────────────
    console.log('\n── Valid admin login ───────────────────────────');
    // Navigate fresh so React state is clean (clearing controlled inputs via evaluate
    // does not trigger React's onChange — a fresh page is more reliable)
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]',    ADMIN_EMAIL);
    await page.type('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForFunction(
      () => !window.location.pathname.includes('/login'),
      { timeout: 10000 }
    );

    const dashboardUrl = page.url();
    assert(
      'Redirected away from /login',
      !dashboardUrl.includes('/login'),
      `Still on ${dashboardUrl}`
    );
    assert(
      'Landed on admin route',
      dashboardUrl.includes('/admin') || dashboardUrl.includes('/dashboard'),
      `Unexpected URL: ${dashboardUrl}`
    );

    // ── Test 4: Dashboard content visible ──────────────────────────────────
    console.log('\n── Dashboard content ───────────────────────────');
    await new Promise(r => setTimeout(r, 1000));

    const pageText = await page.evaluate(() => document.body.innerText);
    const hasContent = pageText.length > 100;

    assert('Dashboard has content', hasContent, 'Page body is empty or too short');

    // Check for common admin UI indicators
    const hasAdminUI = pageText.toLowerCase().includes('student')
      || pageText.toLowerCase().includes('ledger')
      || pageText.toLowerCase().includes('payment')
      || pageText.toLowerCase().includes('dashboard');

    assert(
      'Admin UI elements visible',
      hasAdminUI,
      'Could not find student/ledger/payment/dashboard text on page'
    );

    console.log(`\n  Current URL : ${dashboardUrl}`);
    console.log(`  Page title  : ${await page.title()}`);

  } catch (err: any) {
    console.error('\nUnexpected error during test:', err.message);
    process.exitCode = 1;
  } finally {
    await closeBrowser();
  }

  printSummary();
}

main();
