const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to desktop
  await page.setViewportSize({ width: 1280, height: 720 });

  // Use a simple local server if needed, but here we can try to open the file
  // Note: Opening file directly might have CORS issues for fetch('blog_posts.json')
  // We'll use a simple background server

  const path = require('path');
  const filePath = `file://${path.resolve('index.html')}`;

  await page.goto(filePath);

  // Wait for blog to load
  await page.waitForTimeout(2000);

  // Take screenshot of blog section
  const blogSection = await page.$('#blog');
  if (blogSection) {
      await blogSection.screenshot({ path: 'blog_verification.png' });
      console.log('Blog screenshot saved.');
  } else {
      console.log('Blog section not found.');
  }

  // Click on "Read More" button
  const readMoreBtn = await page.$('.read-more-btn');
  if (readMoreBtn) {
      await readMoreBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'blog_modal_verification.png' });
      console.log('Modal screenshot saved.');
  } else {
      console.log('Read More button not found.');
  }

  await browser.close();
})();
