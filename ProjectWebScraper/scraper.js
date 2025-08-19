const fs = require('fs');
const puppeteer = require('puppeteer');

async function readUrls(filePath) {
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'));
}

async function scrapeBidtracer(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2' });

  // --- Extraction logic ---
  // Update selectors based on provided HTML
  const mainInfo = await page.evaluate(() => {
    const getText = (selector) => document.querySelector(selector)?.innerText || '';
    const getChecked = (selector) => document.querySelector(selector)?.checked || false;
    return {
      projectName: getText('#ctl00_contentPlaceHolderBid_lblProjectName1'),
      address: getText('#ctl00_contentPlaceHolderBid_lblAddress1'),
      biddingPerSpec: getChecked('#ctl00_contentPlaceHolderBid_VendorsGrid_ctl00_ctl04_cbdgBidPerSpec'),
    };
  });
  console.log('Main Info:', mainInfo);

  // --- Extract file explorer link ---
  const fileExplorerUrl = await page.evaluate(() => {
    const anchor = document.querySelector('#ctl00_contentPlaceHolderBid_InvitesGrid_ctl00_ctl06_cmdFolder2 a');
    return anchor ? anchor.getAttribute('href') : null;
  });
  console.log('File Explorer URL:', fileExplorerUrl);

  let pdfLinks = [];
  if (fileExplorerUrl) {
    // If the link is relative, prepend the base URL
    const baseUrl = new URL(page.url()).origin;
    const fullFileExplorerUrl = fileExplorerUrl.startsWith('http') ? fileExplorerUrl : baseUrl + '/' + fileExplorerUrl.replace(/^\//, '');
    console.log('Navigating to File Explorer:', fullFileExplorerUrl);
    await page.goto(fullFileExplorerUrl, { waitUntil: 'networkidle2' });
    // Extract PDF links from the file explorer page
    pdfLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => href && href.match(/\.pdf$/i));
    });
    console.log('PDF Links:', pdfLinks);
  } else {
    console.log('No file explorer link found.');
  }

  await browser.close();
}

(async () => {
  const urls = await readUrls('urls.txt');
  for (const url of urls) {
    await scrapeBidtracer(url);
  }
})(); 