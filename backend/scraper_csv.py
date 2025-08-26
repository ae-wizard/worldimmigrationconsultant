#!/usr/bin/env python3
"""
Simple CSV-based scraper for immigration sources
"""

import pandas as pd
import requests
import json
import time
from typing import List, Dict
from datetime import datetime
from bs4 import BeautifulSoup
import re

def extract_readable_content(html_content: str) -> str:
    """Extract readable text content from HTML, removing scripts, styles, and metadata"""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "noscript"]):
            script.decompose()
        
        # Remove navigation, header, footer, and sidebar elements
        for element in soup.find_all(['nav', 'header', 'footer', 'aside']):
            element.decompose()
            
        # Remove elements with common non-content classes/ids
        selectors_to_remove = [
            '.navigation', '.nav', '.menu', '.sidebar', '.ads', '.advertisement',
            '.social-media', '.breadcrumb', '.pagination', '.related-links',
            '#navigation', '#nav', '#menu', '#sidebar', '#ads', '#header', '#footer'
        ]
        
        for selector in selectors_to_remove:
            for element in soup.select(selector):
                element.decompose()
        
        # Try to find main content area first
        main_content = None
        content_selectors = [
            'main', '.main-content', '.content', '.page-content', 
            '#main-content', '#content', '.post-content', '.entry-content',
            'article', '.article-content'
        ]
        
        for selector in content_selectors:
            elements = soup.select(selector)
            if elements and elements[0].get_text(strip=True):
                main_content = elements[0]
                break
        
        # If no main content area found, use body but remove more elements
        if main_content is None:
            main_content = soup.find('body') or soup
            # Remove more non-content elements when using full body
            for element in main_content.find_all(['form', 'input', 'button']):
                element.decompose()
        
        # Extract text and clean it up
        text = main_content.get_text(separator=' ', strip=True)
        
        # Clean up the text
        text = re.sub(r'\s+', ' ', text)  # Multiple whitespace to single space
        text = re.sub(r'\n\s*\n', '\n\n', text)  # Multiple newlines to double newline
        text = text.strip()
        
        # Remove very short text (likely not real content)
        if len(text) < 100:
            return ""
            
        return text
        
    except Exception as e:
        print(f"⚠️ Error extracting content: {e}")
        return ""

def scrape_from_csv(csv_file: str) -> List[Dict]:
    """
    Scrape content from URLs in CSV file
    Returns list of scraped content with proper text extraction
    """
    try:
        print(f"🔄 Starting scrape from {csv_file}")
        df = pd.read_csv(csv_file)
        
        scraped_content = []
        
        # Process each row in the CSV
        for index, row in df.iterrows():  # Process all URLs, no demo limit
            url = row.get('url', '')
            title = row.get('title', '')
            country = row.get('country_name', '')
            category = row.get('category_name', '')
            
            print(f"📄 Scraping: {title}")
            
            # Proper content scraping with text extraction
            try:
                # Get the page content
                response = requests.get(url, timeout=15, headers={
                    'User-Agent': 'Mozilla/5.0 (compatible; Immigration Content Bot; +https://immigration-helper.com)'
                })
                
                if response.status_code == 200:
                    # Extract readable content from HTML
                    readable_content = extract_readable_content(response.text)
                    
                    if readable_content:
                        content = {
                            'url': url,
                            'title': title,
                            'country': country,
                            'category': category,
                            'content': readable_content,  # Clean, readable text
                            'scraped_at': datetime.now().isoformat(),
                            'status': 'success',
                            'content_length': len(readable_content),
                            'source_url': url  # Add for compatibility
                        }
                        print(f"  ✅ Extracted {len(readable_content)} characters of readable content")
                    else:
                        content = {
                            'url': url,
                            'title': title,
                            'country': country,
                            'category': category,
                            'content': f"No readable content found on page",
                            'scraped_at': datetime.now().isoformat(),
                            'status': 'no_content',
                            'source_url': url
                        }
                        print(f"  ⚠️ No readable content found")
                else:
                    content = {
                        'url': url,
                        'title': title,
                        'country': country,
                        'category': category,
                        'content': f"Failed to scrape: HTTP {response.status_code}",
                        'scraped_at': datetime.now().isoformat(),
                        'status': 'error',
                        'source_url': url
                    }
                    print(f"  ❌ HTTP {response.status_code}")
                    
            except Exception as e:
                content = {
                    'url': url,
                    'title': title,
                    'country': country,
                    'category': category,
                    'content': f"Error: {str(e)}",
                    'scraped_at': datetime.now().isoformat(),
                    'status': 'error',
                    'source_url': url
                }
                print(f"  ❌ Error: {str(e)}")
            
            scraped_content.append(content)
            time.sleep(2)  # Be respectful to servers
            
        print(f"✅ Scraped {len(scraped_content)} items")
        return scraped_content
        
    except Exception as e:
        print(f"❌ Scraping failed: {e}")
        return []

def save_scraped_content(content: List[Dict], filename: str) -> bool:
    """
    Save scraped content to JSON file
    """
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(content, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved content to {filename}")
        return True
    except Exception as e:
        print(f"❌ Failed to save content: {e}")
        return False

def load_scraped_content(filename: str) -> List[Dict]:
    """
    Load scraped content from JSON file
    """
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = json.load(f)
        print(f"📂 Loaded content from {filename}")
        return content
    except Exception as e:
        print(f"❌ Failed to load content: {e}")
        return []

if __name__ == "__main__":
    # Test the scraper
    content = scrape_from_csv("immigration_sources.csv")
    if content:
        save_scraped_content(content, "scraped_content_test.json") 