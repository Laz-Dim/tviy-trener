const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1280, height: 720 });

  // Connect to the local server
  try {
      await page.goto('http://localhost:8000/index.html');

      // Wait for blog to load (it fetches blog_posts.json)
      await page.waitForSelector('.blog-card', { timeout: 10000 });
      console.log('Blog cards found.');

      // Take screenshot of blog section
      const blogSection = await page.$('#blog');
      if (blogSection) {
          await blogSection.screenshot({ path: 'blog_verification.png' });
          console.log('Blog screenshot saved.');
      }

      // Click on the first "Read More" button
      const readMoreBtn = await page.$('.read-more-btn');
      if (readMoreBtn) {
          await readMoreBtn.click();
          // Wait for modal to be visible
          await page.waitForSelector('#blog-modal', { state: 'visible', timeout: 5000 });
          await page.waitForTimeout(1000); // Animation/render time
          await page.screenshot({ path: 'blog_modal_verification.png' });
          console.log('Modal screenshot saved.');
      } else {
          console.log('Read More button not found.');
      }
  } catch (err) {
      console.error('Test failed:', err);
  }

  await browser.close();
})();
