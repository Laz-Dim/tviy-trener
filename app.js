/**
 * Frontend logic for tviy-trener.com
 * Loads videos from videos_data.json and blog posts from blog_posts.json
 */

// Configuration
const CONFIG = {
    videosPerPage: 6,
    videosFile: 'videos_data.json',
    postsFile: 'blog_posts.json',
    channelUrl: 'https://www.youtube.com/@tviy_trener'
};

// State
let allVideos = [];
let filteredVideos = [];
let currentVideoPage = 1;
let currentFilter = 'all';

// DOM Elements
const videosGrid = document.getElementById('videos-grid');
const loadMoreBtn = document.getElementById('load-more-videos');
const filterTabs = document.querySelectorAll('.video-filter-tab');
const blogContainer = document.getElementById('blog-container');

/**
 * Initialize the app
 */
async function init() {
    await loadVideos();
    await loadBlogPosts();
    setupEventListeners();
    
    // Scroll to section if hash exists in URL (fixes scroll position after async layout shift)
    if (window.location.hash) {
        const targetElement = document.querySelector(window.location.hash);
        if (targetElement) {
            setTimeout(() => {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }, 150);
        }
    }
}

/**
 * Load videos from JSON file
 */
async function loadVideos() {
    try {
        const response = await fetch(CONFIG.videosFile);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        allVideos = await response.json();
        filteredVideos = allVideos;
        renderVideos();
    } catch (error) {
        console.error('Failed to load videos:', error);
        if (videosGrid) {
            videosGrid.innerHTML = '<p class="error">Не вдалося завантажити відео. Спробуйте пізніше.</p>';
        }
    }
}

/**
 * Load blog posts from JSON file
 */
async function loadBlogPosts() {
    try {
        const response = await fetch(CONFIG.postsFile);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const posts = await response.json();
        renderBlogPosts(posts);
    } catch (error) {
        console.error('Failed to load blog posts:', error);
        if (blogContainer) {
            blogContainer.innerHTML = '<p class="error">Не вдалося завантажити нотатки.</p>';
        }
    }
}

/**
 * Render videos to the grid
 */
function renderVideos() {
    if (!videosGrid) return;
    
    const start = (currentVideoPage - 1) * CONFIG.videosPerPage;
    const end = currentVideoPage * CONFIG.videosPerPage;
    const videosToShow = filteredVideos.slice(start, end);
    
    if (currentVideoPage === 1) {
        videosGrid.innerHTML = '';
    }
    
    videosToShow.forEach((video, index) => {
        const card = createVideoCard(video, start + index);
        videosGrid.appendChild(card);
    });
    
    // Show/hide load more button
    if (loadMoreBtn) {
        loadMoreBtn.style.display = (currentVideoPage * CONFIG.videosPerPage) < filteredVideos.length ? 'block' : 'none';
    }
}

/**
 * Create a video card element with Schema.org VideoObject markup
 */
function createVideoCard(video, index) {
    const card = document.createElement('article');
    card.className = 'video-item';
    card.setAttribute('itemscope', '');
    card.setAttribute('itemtype', 'https://schema.org/VideoObject');
    card.dataset.index = index;
    card.dataset.type = video.type || 'video';
    
    const videoId = video.id;
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const watchUrl = video.url || `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnail = video.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    const title = video.title || 'Без назви';
    const publishedAt = video.published_at ? new Date(video.published_at).toLocaleDateString('uk-UA') : '';
    const isShort = video.type === 'short';
    
    card.innerHTML = `
        <meta itemprop="url" content="${watchUrl}">
        <meta itemprop="embedUrl" content="${embedUrl}">
        <meta itemprop="thumbnailUrl" content="${thumbnail}">
        <meta itemprop="name" content="${escapeHtml(title)}">
        <meta itemprop="uploadDate" content="${video.published_at || ''}">
        <meta itemprop="duration" content="${video.duration || ''}">
        <meta itemprop="interactionStatistic" content="${video.view_count || 0}">
        
        <div class="video-wrapper">
            <iframe 
                loading="lazy" 
                width="100%" 
                height="250" 
                src="${embedUrl}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowfullscreen
                title="${escapeHtml(title)}"
            ></iframe>
            ${isShort ? '<span class="video-type-badge short">Shorts</span>' : ''}
        </div>
        <div class="video-info">
            <h4 itemprop="name">${escapeHtml(title)}</h4>
            ${publishedAt ? `<time class="video-date" datetime="${video.published_at}">${publishedAt}</time>` : ''}
            <a href="${watchUrl}" target="_blank" rel="noopener" class="video-link">
                <i class="fab fa-youtube"></i> Дивитись на YouTube
            </a>
        </div>
    `;
    
    return card;
}

/**
 * Render blog posts to the grid
 */
function renderBlogPosts(posts) {
    if (!blogContainer) return;
    
    if (!posts || posts.length === 0) {
        blogContainer.innerHTML = '<p class="no-posts">Нотатки ще не додані.</p>';
        return;
    }
    
    blogContainer.innerHTML = '';
    
    posts.forEach(post => {
        const card = createBlogCard(post);
        blogContainer.appendChild(card);
    });
}

/**
 * Create a blog post card element
 */
function createBlogCard(post) {
    const card = document.createElement('article');
    card.className = 'blog-card';
    
    const image = post.image || 'img_new/logo.jpg';
    const title = post.title || 'Без назви';
    const description = post.description || '';
    const slug = post.slug || '';
    const date = post.date ? new Date(post.date).toLocaleDateString('uk-UA') : '';
    const category = post.category || 'general';
    
    card.innerHTML = `
        <img class="blog-thumbnail" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
        <span class="blog-badge">${escapeHtml(category)}</span>
        <h3>${escapeHtml(title)}</h3>
        <p class="blog-preview">${escapeHtml(description)}</p>
        ${date ? `<time class="blog-date" datetime="${post.date}">${date}</time>` : ''}
        <a href="blog-${escapeHtml(slug)}.html" class="read-more-btn">Читати далі →</a>
    `;
    
    // Make entire card clickable
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.read-more-btn')) {
            window.location.href = `blog-${escapeHtml(slug)}.html`;
        }
    });
    
    return card;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Video filter tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const filter = tab.dataset.filter;
            setVideoFilter(filter);
        });
    });
    
    // Load more videos button
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentVideoPage++;
            renderVideos();
        });
    }
    
    // Mobile menu (for blog pages too)
    const mobileMenu = document.getElementById('mobile-menu');
    const navList = document.querySelector('.nav-list');
    if (mobileMenu && navList) {
        mobileMenu.addEventListener('click', () => {
            navList.classList.toggle('active');
            const icon = mobileMenu.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });
        document.querySelectorAll('.nav-list a').forEach(link => {
            link.addEventListener('click', () => {
                navList.classList.remove('active');
                const icon = mobileMenu.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            });
        });
    }
}

/**
 * Set video filter and re-render
 */
function setVideoFilter(filter) {
    currentFilter = filter;
    currentVideoPage = 1;
    
    // Update active tab
    filterTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    
    // Filter videos
    if (filter === 'all') {
        filteredVideos = allVideos;
    } else {
        filteredVideos = allVideos.filter(v => v.type === filter);
    }
    
    renderVideos();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for potential module usage
window.TviyTrenerApp = {
    loadVideos,
    loadBlogPosts,
    setVideoFilter
};