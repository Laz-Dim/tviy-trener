#!/usr/bin/env python3
"""
Generate static blog HTML pages from blog-template.html + blog_posts.json.
Also generates sitemap.xml.
"""
import os
import json
import re
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent
TEMPLATE_FILE = BASE_DIR / "blog-template.html"
POSTS_FILE = BASE_DIR / "blog_posts.json"
SITEMAP_FILE = BASE_DIR / "sitemap.xml"
ROBOTS_FILE = BASE_DIR / "robots.txt"
MAIN_DOMAIN = "https://tviy-trener.com"

# Regex patterns (can't use backslashes in f-string expressions)
NUMBERED_LIST_PATTERN = re.compile(r'^\d+\. ')

def slugify(text):
    """Convert text to URL-friendly slug."""
    text = text.lower()
    # Transliterate Ukrainian
    translit = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
        'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
        'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '', 'ю': 'yu', 'я': 'ya',
    }
    result = []
    for char in text:
        if char in translit:
            result.append(translit[char])
        elif char.isalnum() or char in '-_':
            result.append(char)
        else:
            result.append('-')
    # Collapse multiple dashes
    slug = re.sub(r'-+', '-', ''.join(result))
    return slug.strip('-')

def parse_markdown(text):
    """Simple Markdown to HTML conversion."""
    if not text:
        return ""
    # Escape HTML first
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    # Bold and italic
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'_(.+?)_', r'<em>\1</em>', text)
    
    # Headers
    text = re.sub(r'^### (.+)$', r'<h3>\1</h3>', text, flags=re.MULTILINE)
    text = re.sub(r'^## (.+)$', r'<h2>\1</h2>', text, flags=re.MULTILINE)
    text = re.sub(r'^# (.+)$', r'<h1>\1</h1>', text, flags=re.MULTILINE)
    
    # Lists
    lines = text.split('\n')
    in_list = False
    result = []
    for line in lines:
        if line.startswith('- ') or line.startswith('* '):
            if not in_list:
                result.append('<ul>')
                in_list = True
            result.append(f'<li>{line[2:]}</li>')
        elif NUMBERED_LIST_PATTERN.match(line):
            if not in_list:
                result.append('<ol>')
                in_list = True
            # Remove the number prefix
            clean_line = NUMBERED_LIST_PATTERN.sub('', line)
            result.append(f'<li>{clean_line}</li>')
        else:
            if in_list:
                # Close list
                if result and ('<ul>' in result[-1] or any('<ul>' in x for x in result[-3:])):
                    result.append('</ul>')
                else:
                    result.append('</ol>')
                in_list = False
            result.append(line)
    if in_list:
        result.append('</ul>')
    text = '\n'.join(result)
    
    # Paragraphs - split by double newline
    paragraphs = text.split('\n\n')
    html_paragraphs = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        # Don't wrap already block elements
        if re.match(r'^<(h[1-6]|ul|ol|li|blockquote|hr|pre)', p):
            html_paragraphs.append(p)
        else:
            # Convert single newlines to <br>
            p = p.replace('\n', '<br>')
            html_paragraphs.append(f'<p>{p}</p>')
    
    return ''.join(html_paragraphs)

def load_template():
    """Load the blog template HTML."""
    with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
        return f.read()

def load_posts():
    """Load blog posts metadata."""
    if POSTS_FILE.exists():
        with open(POSTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_posts(posts):
    """Save blog posts metadata."""
    with open(POSTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)

def render_post(template, post):
    """Render a single blog post HTML from template."""
    html = template
    
    # Basic replacements
    replacements = {
        '{{TITLE}}': post.get('title', ''),
        '{{DESCRIPTION}}': post.get('description', ''),
        '{{CANONICAL_URL}}': f"{MAIN_DOMAIN}/blog-{post['slug']}.html",
        '{{OG_URL}}': f"{MAIN_DOMAIN}/blog-{post['slug']}.html",
        '{{OG_TITLE}}': post.get('title', ''),
        '{{OG_DESCRIPTION}}': post.get('description', ''),
        '{{OG_IMAGE}}': f"{MAIN_DOMAIN}/{post.get('image', 'img_new/logo.jpg')}",
        '{{PUBLISHED_DATE}}': post.get('date', datetime.now().strftime('%Y-%m-%d')),
        '{{MODIFIED_DATE}}': post.get('date', datetime.now().strftime('%Y-%m-%d')),
        '{{AUTHOR_NAME}}': 'Ілля Поліщук',
        '{{ARTICLE_CONTENT}}': parse_markdown(post.get('content', '')),
        '{{CATEGORY}}': post.get('category', 'general'),
        '{{TAGS}}': ', '.join(post.get('tags', [])),
        '{{READING_TIME}}': estimate_reading_time(post.get('content', '')),
    }
    
    for placeholder, value in replacements.items():
        html = html.replace(placeholder, value)
    
    return html

def estimate_reading_time(text):
    """Estimate reading time in minutes."""
    words = len(text.split())
    minutes = max(1, round(words / 200))
    return f"{minutes} хв читання"

def generate_sitemap(posts):
    """Generate sitemap.xml."""
    urls = [
        {"loc": MAIN_DOMAIN, "changefreq": "weekly", "priority": "1.0"},
    ]
    
    for post in posts:
        urls.append({
            "loc": f"{MAIN_DOMAIN}/blog-{post['slug']}.html",
            "lastmod": post.get('date', datetime.now().strftime('%Y-%m-%d')),
            "changefreq": "monthly",
            "priority": "0.8"
        })
    
    xml_lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml_lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for url in urls:
        xml_lines.append('  <url>')
        xml_lines.append(f'    <loc>{url["loc"]}</loc>')
        if 'lastmod' in url:
            xml_lines.append(f'    <lastmod>{url["lastmod"]}</lastmod>')
        xml_lines.append(f'    <changefreq>{url["changefreq"]}</changefreq>')
        xml_lines.append(f'    <priority>{url["priority"]}</priority>')
        xml_lines.append('  </url>')
    xml_lines.append('</urlset>')
    
    return '\n'.join(xml_lines)

def main():
    print("Generating blog pages...")
    
    # Load template
    if not TEMPLATE_FILE.exists():
        print(f"ERROR: Template not found: {TEMPLATE_FILE}")
        return
    
    template = load_template()
    posts = load_posts()
    
    if not posts:
        print("No posts found in blog_posts.json")
        # Still generate sitemap with just main page
        sitemap = generate_sitemap([])
        with open(SITEMAP_FILE, 'w', encoding='utf-8') as f:
            f.write(sitemap)
        print(f"Generated {SITEMAP_FILE}")
        return
    
    generated = 0
    for post in posts:
        # Ensure slug exists
        if 'slug' not in post:
            post['slug'] = slugify(post['title'])
        
        # Ensure date exists
        if 'date' not in post:
            post['date'] = datetime.now().strftime('%Y-%m-%d')
        
        # Render and save
        html = render_post(template, post)
        output_file = BASE_DIR / f"blog-{post['slug']}.html"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"  Generated: {output_file.name}")
        generated += 1
    
    # Save updated posts (with slugs/dates added)
    save_posts(posts)
    
    # Generate sitemap
    sitemap = generate_sitemap(posts)
    with open(SITEMAP_FILE, 'w', encoding='utf-8') as f:
        f.write(sitemap)
    print(f"Generated: {SITEMAP_FILE}")
    
    print(f"\nDone! Generated {generated} blog pages.")

if __name__ == "__main__":
    main()