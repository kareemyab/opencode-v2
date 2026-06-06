import { chromium } from '@playwright/test';
const url = 'http://localhost:4096/L1VzZXJzL25hdGhhbi9uZW5pLWFwcC9hcHBzL3dlYnNpdGUtdjI/session/ses_161a1e966ffeBuJstxK67YlL5z';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(6000);
const data = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  const pick = (el) => el ? {
    fontFamily: getComputedStyle(el).fontFamily,
    fontSize: getComputedStyle(el).fontSize,
    borderRadius: getComputedStyle(el).borderRadius,
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
  } : null;
  const allClasses = Array.from(document.querySelectorAll('[class]')).map(el => el.className?.toString?.() || '').join(' ');
  const fontFamilies = new Set();
  document.querySelectorAll('body, [data-component], textarea, button').forEach(el => {
    fontFamilies.add(getComputedStyle(el).fontFamily);
  });
  return {
    title: document.title,
    bodyClasses: document.body.className,
    htmlAttrs: {
      dataColorScheme: document.documentElement.getAttribute('data-color-scheme'),
      dataTheme: document.documentElement.getAttribute('data-theme'),
    },
    vars: {
      fontFamilySans: root.getPropertyValue('--font-family-sans').trim(),
      fontFamilyText: root.getPropertyValue('--font-family-text').trim(),
      berkeley: root.getPropertyValue('--font-berkeley-mono').trim(),
      radiusSm: root.getPropertyValue('--radius-sm').trim(),
    },
    body: pick(document.body),
    titlebar: pick(document.querySelector('[data-component="titlebar"]')),
    prompt: pick(document.querySelector('[data-component="prompt-input"]')),
    fontFamilies: [...fontFamilies],
    hardcodedHex: [...new Set((allClasses.match(/(?:bg|text|border)-\[#[0-9a-fA-F]+\]/g) || []))],
    arbitraryRadius: [...new Set((allClasses.match(/rounded-\[[^\]]+\]/g) || []))],
    v2Tokens: (allClasses.match(/(?:text|bg|border)-v2-[\w-]+/g) || []).length,
    legacyTokens: (allClasses.match(/(?:text|bg|border)-(?:text|background|border|surface)-[\w-]+/g) || []).length,
    hasSessionContent: !!document.querySelector('[data-component="session-turn"]') || !!document.querySelector('[data-component="prompt-input"]'),
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
