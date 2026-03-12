/**
 * Browser helper — shared Puppeteer setup/teardown for all E2E tests
 */

import puppeteer, { type Browser, type Page } from 'puppeteer';

export const BASE_URL    = process.env.FRONTEND_URL || 'http://localhost:5173';
export const BACKEND_URL = process.env.BACKEND_URL  || 'http://localhost:5001';

export const ADMIN_EMAIL    = 'admin@school.com';
export const ADMIN_PASSWORD = 'admin123';
export const PARENT1_EMAIL    = 'parent1@test.com';
export const PARENT1_PASSWORD = 'test123';

let browser: Browser | null = null;

export async function launchBrowser(headless = true): Promise<Browser> {
  browser = await puppeteer.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
  });
  return browser;
}

export async function newPage(b: Browser): Promise<Page> {
  const page = await b.newPage();
  // Log browser console errors to terminal
  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[browser] ${msg.text()}`);
  });
  return page;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/** Navigate to login page and sign in with given credentials */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from login page
  await page.waitForFunction(
    () => !window.location.pathname.includes('/login'),
    { timeout: 10000 }
  );
}

/** Print PASS / FAIL and track result */
const results: { name: string; passed: boolean; reason: string }[] = [];

export function assert(name: string, condition: boolean, reason: string): void {
  results.push({ name, passed: condition, reason });
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name} — ${reason}`);
  }
}

export function printSummary(): void {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log('\n──────────────────────────────────────');
  console.log(` ${passed} passed  ${failed} failed`);
  console.log('──────────────────────────────────────');
  if (failed > 0) {
    results.filter(r => !r.passed).forEach(r => console.error(`  FAIL: ${r.name} — ${r.reason}`));
    process.exitCode = 1;
  } else {
    console.log('\nPASS — All E2E assertions passed.');
  }
}
