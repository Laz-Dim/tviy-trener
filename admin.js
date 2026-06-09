/**
 * Admin panel logic for tviy-trener.com
 * Handles Telegram OTP authentication and blog post management
 */

// Configuration
const CONFIG = {
    apiBase: '/api/admin',  // Cloudflare Workers endpoints
    postsFile: 'blog_posts.json',
    githubApiBase: 'https://api.github.com/repos/OWNER/REPO',  // Will be configured via env
};

// State
let authToken = null;
let currentUser = null;

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
const codeGroup = document.getElementById('codeGroup');
const verifyGroup = document.getElementById('verifyGroup');
const loginStatus = document.getElementById('loginStatus');
const telegramIdInput = document.getElementById('telegramId');
const otpCodeInput = document.getElementById('otpCode');
const postForm = document.getElementById('postForm');
const postTitle = document.getElementById('postTitle');
const postSlug = document.getElementById('postSlug');
const postImage = document.getElementById('postImage');
const imagePreview = document.getElementById('imagePreview');
const publishBtn = document.getElementById('publishBtn');
const postStatus = document.getElementById('postStatus');
const adminTabs = document.querySelectorAll('.admin-tab');
const adminPanels = document.querySelectorAll('.admin-panel');
const postsListBody = document.getElementById('postsListBody');
const refreshPostsBtn = document.getElementById('refreshPostsBtn');

/**
 * Initialize admin panel
 */
function init() {
    // Check for existing auth in sessionStorage
    const savedToken = sessionStorage.getItem('admin_token');
    if (savedToken) {
        authToken = savedToken;
        showDashboard();
    }
    
    setupEventListeners();
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('postDate').value = today;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Send OTP code
    sendCodeBtn?.addEventListener('click', sendOtpCode);
    
    // Verify OTP code
    verifyCodeBtn?.addEventListener('click', verifyOtpCode);
    
    // Enter key in OTP input
    otpCodeInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyOtpCode();
    });
    
    // Auto-generate slug from title
    postTitle?.addEventListener('input', () => {
        if (!postSlug.dataset.manual) {
            postSlug.value = slugify(postTitle.value);
        }
    });
    
    // Mark slug as manually edited
    postSlug?.addEventListener('input', () => {
        postSlug.dataset.manual = 'true';
    });
    
    // Image preview
    postImage?.addEventListener('change', handleImagePreview);
    
    // Form submission (save draft)
    postForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        savePost(false);
    });
    
    // Publish button
    publishBtn?.addEventListener('click', () => savePost(true));
    
    // Admin tabs
    adminTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Refresh posts list
    refreshPostsBtn?.addEventListener('click', loadPostsList);
    
    // Logout on tab close
    window.addEventListener('beforeunload', () => {
        // Keep sessionStorage for session persistence
    });
}

/**
 * Switch admin tab
 */
function switchTab(tabName) {
    adminTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    adminPanels.forEach(p => p.classList.toggle('active', p.id === `${tabName}Panel`));
    
    if (tabName === 'list') {
        loadPostsList();
    }
}

/**
 * Send OTP code via Telegram
 */
async function sendOtpCode() {
    const telegramId = telegramIdInput.value.trim();
    if (!telegramId) {
        showStatus(loginStatus, 'Введіть Telegram ID або @username', 'error');
        return;
    }
    
    sendCodeBtn.disabled = true;
    sendCodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Надсилання...';
    showStatus(loginStatus, 'Надсилаю код...', 'info');
    
    try {
        const response = await fetch(`${CONFIG.apiBase}/send-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_id: telegramId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus(loginStatus, '✅ Код надіслано в Telegram! Перевірте повідомлення.', 'success');
            codeGroup.style.display = 'block';
            verifyGroup.style.display = 'block';
            otpCodeInput.focus();
        } else {
            showStatus(loginStatus, `❌ ${result.error || 'Помилка відправки коду'}`, 'error');
        }
    } catch (err) {
        console.error('Send code error:', err);
        showStatus(loginStatus, '❌ Помилка з\'єднання. Перевірте, чи працює API.', 'error');
    } finally {
        sendCodeBtn.disabled = false;
        sendCodeBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отримати код';
    }
}

/**
 * Verify OTP code
 */
async function verifyOtpCode() {
    const code = otpCodeInput.value.trim();
    const telegramId = telegramIdInput.value.trim();
    
    if (!code || code.length !== 6) {
        showStatus(loginStatus, 'Введіть 6-значний код', 'error');
        return;
    }
    
    verifyCodeBtn.disabled = true;
    verifyCodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Перевірка...';
    showStatus(loginStatus, 'Перевіряю код...', 'info');
    
    try {
        const response = await fetch(`${CONFIG.apiBase}/verify-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, telegram_id: telegramId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            authToken = result.token;
            currentUser = result.user;
            sessionStorage.setItem('admin_token', authToken);
            showStatus(loginStatus, '✅ Успішний вхід! Завантажую панель...', 'success');
            
            setTimeout(() => {
                showDashboard();
            }, 500);
        } else {
            showStatus(loginStatus, `❌ ${result.error || 'Невірний код'}`, 'error');
        }
    } catch (err) {
        console.error('Verify code error:', err);
        showStatus(loginStatus, '❌ Помилка з\'єднання', 'error');
    } finally {
        verifyCodeBtn.disabled = false;
        verifyCodeBtn.innerHTML = '<i class="fas fa-lock-open"></i> Увійти';
    }
}

/**
 * Show dashboard after successful login
 */
function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.classList.add('visible');
    
    // Load posts list by default
    loadPostsList();
}

/**
 * Save post (draft or publish)
 */
async function savePost(publish = false) {
    const formData = new FormData();
    formData.append('title', postTitle.value.trim());
    formData.append('slug', postSlug.value.trim());
    formData.append('category', postCategory.value);
    formData.append('tags', postTags.value.trim());
    formData.append('description', postDescription.value.trim());
    formData.append('content', postContent.value.trim());
    formData.append('date', postDate.value || new Date().toISOString().split('T')[0]);
    formData.append('publish', publish.toString());
    
    if (postImage.files[0]) {
        formData.append('image', postImage.files[0]);
    }
    
    // Add auth token
    formData.append('token', authToken);
    
    const btn = publish ? publishBtn : postForm.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (publish ? 'Публікація...' : 'Збереження...');
    showStatus(postStatus, publish ? 'Публікую нотатку...' : 'Зберігаю чернетку...', 'info');
    
    try {
        const response = await fetch(`${CONFIG.apiBase}/posts`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus(postStatus, `✅ ${publish ? 'Опубліковано!' : 'Чернетку збережено!'}`, 'success');
            if (publish) {
                // Reset form after successful publish
                postForm.reset();
                postSlug.dataset.manual = 'false';
                imagePreview.classList.remove('visible');
                document.getElementById('postDate').value = new Date().toISOString().split('T')[0];
                
                // Refresh posts list if visible
                if (document.getElementById('listPanel').classList.contains('active')) {
                    loadPostsList();
                }
            }
        } else {
            showStatus(postStatus, `❌ ${result.error || 'Помилка'}`, 'error');
        }
    } catch (err) {
        console.error('Save post error:', err);
        showStatus(postStatus, '❌ Помилка з\'єднання', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Load posts list for admin
 */
async function loadPostsList() {
    postsListBody.innerHTML = '<p style="padding: 40px; text-align: center; color: var(--text-gray);">Завантаження...</p>';
    
    try {
        // Try to load from blog_posts.json first (for local testing)
        const response = await fetch(CONFIG.postsFile);
        let posts = [];
        if (response.ok) {
            posts = await response.json();
        }
        
        renderPostsList(posts);
    } catch (err) {
        console.error('Load posts error:', err);
        postsListBody.innerHTML = '<p style="padding: 40px; text-align: center; color: #ff6b6b;">Помилка завантаження</p>';
    }
}

/**
 * Render posts list in admin
 */
function renderPostsList(posts) {
    if (!posts || posts.length === 0) {
        postsListBody.innerHTML = '<p style="padding: 40px; text-align: center; color: var(--text-gray);">Нотаток ще немає</p>';
        return;
    }
    
    postsListBody.innerHTML = posts.map(post => `
        <div class="post-row">
            <img class="post-thumb" src="${escapeHtml(post.image || 'img_new/logo.jpg')}" alt="${escapeHtml(post.title)}" loading="lazy">
            <div class="post-title-cell">${escapeHtml(post.title)}</div>
            <span class="post-category">${escapeHtml(post.category)}</span>
            <span class="post-date">${post.date ? new Date(post.date).toLocaleDateString('uk-UA') : ''}</span>
            <div class="post-actions">
                <a href="blog-${escapeHtml(post.slug)}.html" target="_blank" class="cta-button secondary btn" style="padding: 8px 12px; font-size: 12px;">
                    <i class="fas fa-eye"></i> Перегляд
                </a>
                <button type="button" class="cta-button btn danger" onclick="deletePost('${escapeHtml(post.slug)}')" style="padding: 8px 12px; font-size: 12px;">
                    <i class="fas fa-trash"></i> Видалити
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Delete post (placeholder - would need API endpoint)
 */
async function deletePost(slug) {
    if (!confirm(`Видалити нотатку "${slug}"? Це незворотне.`)) return;
    
    // This would call the API to delete
    // For now, just show not implemented
    alert('Функція видалення буде реалізована в API. Поки що видаляйте вручну через GitHub.');
}

/**
 * Handle image preview
 */
function handleImagePreview(e) {
    const file = e.target.files[0];
    if (!file) {
        imagePreview.classList.remove('visible');
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        showStatus(postStatus, '❌ Оберіть файл зображення', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showStatus(postStatus, '❌ Файл занадто великий (макс. 2MB)', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        imagePreview.src = event.target.result;
        imagePreview.classList.add('visible');
    };
    reader.readAsDataURL(file);
}

/**
 * Slugify text for URL
 */
function slugify(text) {
    const translit = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
        'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
        'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '', 'ю': 'yu', 'я': 'ya',
    };
    return text.toLowerCase()
        .split('')
        .map(c => translit[c] || (c.match(/[a-z0-9]/i) ? c : '-'))
        .join('')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Show status message
 */
function showStatus(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = `status ${type}`;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}