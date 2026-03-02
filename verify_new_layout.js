const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1280, height: 1000 });

  try {
      await page.goto('http://localhost:8000/index.html');

      // Wait for blog to load
      await page.waitForSelector('.main-blog-card', { timeout: 10000 });
      console.log('Main blog card found.');

      const hasHistory = await page.$('.history-grid');
      if (hasHistory) {
          console.log('History grid found.');
      }

      // Take screenshot of blog section
      const blogSection = await page.$('#blog');
      if (blogSection) {
          await blogSection.screenshot({ path: 'blog_new_layout.png' });
          console.log('New layout screenshot saved.');
      }

      // Test modal
      const readMoreBtn = await page.$('.main-blog-card button');
      if (readMoreBtn) {
          await readMoreBtn.click();
          await page.waitForSelector('#blog-modal', { state: 'visible', timeout: 5000 });
          console.log('Modal opened.');

          // Check if modal has content
          const modalText = await page.$eval('#modal-body h2', el => el.innerText);
          console.log('Modal title:', modalText);

          await page.screenshot({ path: 'blog_new_modal.png' });
      }
  } catch (err) {
      console.error('Test failed:', err);
  }

  await browser.close();
})();
