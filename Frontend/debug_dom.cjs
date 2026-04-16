const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // Go to the login page
    await page.goto('http://localhost:5173/#/login', { waitUntil: 'networkidle2' });
    
    // Wait a brief moment for any JS animation/rendering
    await new Promise(r => setTimeout(r, 1000));
    
    // Get the outer HTML of the body
    const bodyHtml = await page.evaluate(() => document.body.outerHTML);
    const headerHtml = await page.evaluate(() => {
        const h = document.getElementById('header');
        return h ? { html: h.outerHTML, style: h.getAttribute('style'), rect: h.getBoundingClientRect() } : null;
    });
    const footerHtml = await page.evaluate(() => {
        const f = document.getElementById('footer');
        return f ? { html: f.outerHTML, style: f.getAttribute('style'), rect: f.getBoundingClientRect() } : null;
    });

    const output = {
        bodyTrimmedLength: bodyHtml.length,
        header: headerHtml,
        footer: footerHtml
    };
    
    fs.writeFileSync('/tmp/dom_debug.json', JSON.stringify(output, null, 2));
    
    await browser.close();
})();
