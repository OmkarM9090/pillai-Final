const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER_PAGE_ERROR:', error.message));
    
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2' });
    console.log('Page loaded successfully. Checking body...');
    const bodyText = await page.evaluate(() => document.body.innerHTML);
    if (!bodyText || bodyText === '<div id="root"></div>') {
      console.log('Body is completely blank or only has empty root element!');
    }
    await browser.close();
  } catch (err) {
    console.error('SCRIPT_ERROR:', err);
  }
})();
