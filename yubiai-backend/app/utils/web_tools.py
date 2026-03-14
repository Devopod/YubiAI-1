"""Web tools: URL scraping, Wikipedia search, YouTube transcript extraction."""
import re
import logging
import httpx
from bs4 import BeautifulSoup
from typing import Optional

logger = logging.getLogger(__name__)


def extract_urls(text: str) -> list[str]:
    """Extract URLs from text, handling parentheses in URLs like Wikipedia."""
    url_pattern = r'https?://[^\s<>"\'](?:[^\s<>"\']*[^\s<>"\'.,:;!?\)\]\}])'
    raw_urls = re.findall(url_pattern, text)
    # Fix balanced parentheses (e.g. Wikipedia URLs)
    fixed = []
    for url in raw_urls:
        # Check if the text after the URL match has a closing paren that belongs to the URL
        idx = text.find(url)
        if idx >= 0:
            end = idx + len(url)
            # If URL has unbalanced open parens, grab closing parens from text
            while end < len(text) and url.count('(') > url.count(')'):
                if text[end] == ')':
                    url += ')'
                    end += 1
                else:
                    break
        fixed.append(url)
    return fixed


def is_youtube_url(url: str) -> bool:
    """Check if a URL is a YouTube video URL."""
    youtube_patterns = [
        r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=',
        r'(?:https?://)?youtu\.be/',
        r'(?:https?://)?(?:www\.)?youtube\.com/embed/',
        r'(?:https?://)?(?:www\.)?youtube\.com/shorts/',
    ]
    return any(re.search(p, url) for p in youtube_patterns)


def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extract video ID from YouTube URL."""
    patterns = [
        r'(?:v=|youtu\.be/|embed/|shorts/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def is_github_repo_url(url: str) -> bool:
    """Check if a URL is a GitHub repository URL (not a file or issue)."""
    pattern = r'https?://github\.com/[\w.-]+/[\w.-]+/?$'
    return bool(re.match(pattern, url.rstrip('/') + '/'))


def is_github_org_url(url: str) -> bool:
    """Check if a URL is a GitHub organization/user profile URL (not a repo)."""
    cleaned = url.rstrip('/')
    # Match github.com/username but NOT github.com/username/repo
    pattern = r'https?://github\.com/[\w.-]+$'
    return bool(re.match(pattern, cleaned))


def parse_github_org(url: str) -> str:
    """Extract organization/user name from GitHub URL."""
    match = re.match(r'https?://github\.com/([\w.-]+)', url.rstrip('/'))
    if match:
        return match.group(1)
    return ""


def parse_github_repo(url: str) -> tuple[str, str]:
    """Extract owner and repo name from GitHub URL."""
    match = re.match(r'https?://github\.com/([\w.-]+)/([\w.-]+)', url)
    if match:
        return match.group(1), match.group(2)
    return "", ""


async def scrape_github_org(url: str) -> str:
    """Scrape a GitHub organization/user profile to list all repositories with their directory structures."""
    org = parse_github_org(url)
    if not org:
        return await scrape_url(url)

    try:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "YubiAI/1.0",
        }
        async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
            # 1. Get org/user info
            org_resp = await client.get(f"https://api.github.com/users/{org}")
            org_info = org_resp.json() if org_resp.status_code == 200 else {}
            org_name = org_info.get("name", org)
            org_bio = org_info.get("bio") or org_info.get("description") or "No description"
            org_type = org_info.get("type", "User")  # "Organization" or "User"

            result_parts = [
                f"# GitHub {org_type}: {org_name} ({org})",
                f"Bio: {org_bio}",
                f"URL: {url}",
                "",
            ]

            # 2. Get all public repos
            all_repos = []
            page = 1
            while page <= 3:  # Max 3 pages (90 repos)
                repos_resp = await client.get(
                    f"https://api.github.com/users/{org}/repos",
                    params={"per_page": 30, "page": page, "sort": "updated", "direction": "desc"},
                )
                if repos_resp.status_code != 200:
                    break
                repos = repos_resp.json()
                if not repos:
                    break
                all_repos.extend(repos)
                page += 1

            result_parts.append(f"## Repositories ({len(all_repos)} found):\n")

            # 3. For each repo, get directory structure
            for repo_data in all_repos:
                repo_name = repo_data.get("name", "")
                repo_desc = repo_data.get("description") or "No description"
                repo_lang = repo_data.get("language") or "Unknown"
                repo_stars = repo_data.get("stargazers_count", 0)
                default_branch = repo_data.get("default_branch", "main")

                result_parts.append(f"### {org}/{repo_name}")
                result_parts.append(f"Description: {repo_desc}")
                result_parts.append(f"Language: {repo_lang} | Stars: {repo_stars}")
                result_parts.append(f"URL: https://github.com/{org}/{repo_name}")

                # Get file tree for this repo
                tree_resp = await client.get(
                    f"https://api.github.com/repos/{org}/{repo_name}/git/trees/{default_branch}",
                    params={"recursive": "1"},
                )
                if tree_resp.status_code == 200:
                    tree_data = tree_resp.json()
                    tree_items = tree_data.get("tree", [])
                    file_list = []
                    for item in tree_items:
                        path = item.get("path", "")
                        item_type = item.get("type", "")
                        if item_type == "blob":
                            file_list.append(f"    {path}")
                        elif item_type == "tree":
                            file_list.append(f"    {path}/")

                    result_parts.append("Directory Structure:")
                    if len(file_list) > 50:
                        result_parts.extend(file_list[:50])
                        result_parts.append(f"    ... and {len(file_list) - 50} more files")
                    else:
                        result_parts.extend(file_list)
                else:
                    result_parts.append("Directory Structure: (empty or private)")

                result_parts.append("")  # blank line between repos

            full_result = "\n".join(result_parts)
            # Limit total context size
            if len(full_result) > 15000:
                full_result = full_result[:15000] + "\n...[content truncated — too many repos]"
            return full_result

    except Exception as e:
        logger.error(f"Error scraping GitHub org {url}: {e}")
        return await scrape_url(url)


async def scrape_github_repo(url: str) -> str:
    """Scrape a GitHub repository using GitHub API to get file tree and key files."""
    owner, repo = parse_github_repo(url)
    if not owner or not repo:
        return await scrape_url(url)

    try:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "YubiAI/1.0",
        }
        async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
            # 1. Get repo info
            repo_resp = await client.get(f"https://api.github.com/repos/{owner}/{repo}")
            if repo_resp.status_code != 200:
                logger.warning(f"GitHub API repo info failed: {repo_resp.status_code}")
                return await scrape_url(url)

            repo_info = repo_resp.json()
            description = repo_info.get("description", "No description")
            language = repo_info.get("language", "Unknown")
            stars = repo_info.get("stargazers_count", 0)
            forks = repo_info.get("forks_count", 0)
            default_branch = repo_info.get("default_branch", "main")

            result_parts = [
                f"# GitHub Repository: {owner}/{repo}",
                f"Description: {description}",
                f"Language: {language} | Stars: {stars} | Forks: {forks}",
                f"URL: {url}",
                "",
            ]

            # 2. Get file tree (recursive)
            tree_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}",
                params={"recursive": "1"},
            )
            if tree_resp.status_code == 200:
                tree_data = tree_resp.json()
                tree_items = tree_data.get("tree", [])
                # Build file tree display
                file_list = []
                for item in tree_items:
                    path = item.get("path", "")
                    item_type = item.get("type", "")
                    if item_type == "blob":
                        file_list.append(f"  {path}")
                    elif item_type == "tree":
                        file_list.append(f"  {path}/")

                result_parts.append("## File Structure:")
                # Limit file list to 80 entries
                if len(file_list) > 80:
                    result_parts.extend(file_list[:80])
                    result_parts.append(f"  ... and {len(file_list) - 80} more files")
                else:
                    result_parts.extend(file_list)
                result_parts.append("")

            # 3. Get README content
            readme_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/readme",
                headers={"Accept": "application/vnd.github.v3.raw"},
            )
            if readme_resp.status_code == 200:
                readme_text = readme_resp.text
                if len(readme_text) > 3000:
                    readme_text = readme_text[:3000] + "\n...[README truncated]"
                result_parts.append("## README:")
                result_parts.append(readme_text)
                result_parts.append("")

            # 4. Get key source files (up to 5 important files)
            key_files = []
            code_extensions = {".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rs", ".cpp", ".c", ".rb"}
            config_files = {"package.json", "pyproject.toml", "Cargo.toml", "go.mod", "requirements.txt", "Makefile", "Dockerfile"}

            if tree_resp.status_code == 200:
                for item in tree_items:
                    if item.get("type") != "blob":
                        continue
                    path = item.get("path", "")
                    filename = path.split("/")[-1]
                    # Prioritize config files and top-level source files
                    if filename in config_files:
                        key_files.append((path, 0))  # highest priority
                    elif any(path.endswith(ext) for ext in code_extensions) and path.count("/") <= 1:
                        key_files.append((path, 1))  # source files in root or first level

                # Sort by priority and limit
                key_files.sort(key=lambda x: x[1])
                key_files = key_files[:5]

                for file_path, _ in key_files:
                    file_resp = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
                        headers={"Accept": "application/vnd.github.v3.raw"},
                    )
                    if file_resp.status_code == 200:
                        content = file_resp.text
                        if len(content) > 2000:
                            content = content[:2000] + "\n...[file truncated]"
                        result_parts.append(f"## File: {file_path}")
                        result_parts.append(f"```\n{content}\n```")
                        result_parts.append("")

            full_result = "\n".join(result_parts)
            # Limit total context size
            if len(full_result) > 12000:
                full_result = full_result[:12000] + "\n...[content truncated]"
            return full_result

    except Exception as e:
        logger.error(f"Error scraping GitHub repo {url}: {e}")
        return await scrape_url(url)


async def scrape_url(url: str) -> str:
    """Scrape content from a URL and return clean text."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            })
            if response.status_code != 200:
                return f"[Could not access URL: HTTP {response.status_code}]"

            soup = BeautifulSoup(response.text, "html.parser")

            # Remove scripts, styles, nav, footer
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
                tag.decompose()

            # Get title
            title = soup.title.string.strip() if soup.title and soup.title.string else ""

            # Get main text content
            text = soup.get_text(separator="\n", strip=True)

            # Clean up excessive whitespace
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            clean_text = "\n".join(lines)

            # Limit to ~4000 chars to fit in context
            if len(clean_text) > 4000:
                clean_text = clean_text[:4000] + "\n...[content truncated]"

            return f"Title: {title}\n\n{clean_text}" if title else clean_text

    except Exception as e:
        logger.error(f"Error scraping URL {url}: {e}")
        return f"[Could not scrape URL: {str(e)}]"


async def search_wikipedia(query: str) -> str:
    """Search Wikipedia for information using their API. Returns results with URLs."""
    try:
        headers = {
            "User-Agent": "YubiAI/1.0 (https://yubiai.devopods.com; contact@devopods.com)",
            "Accept": "application/json",
        }
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            # Search for pages
            search_resp = await client.get("https://en.wikipedia.org/w/api.php", params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": 3,
                "format": "json",
                "utf8": 1,
            })
            if search_resp.status_code != 200:
                logger.warning(f"Wikipedia search HTTP {search_resp.status_code}")
                return ""

            search_data = search_resp.json()
            results = search_data.get("query", {}).get("search", [])

            if not results:
                return ""

            # Get extracts of top results (more content = better context)
            all_extracts = []
            for result in results[:2]:
                page_title = result["title"]
                page_url = f"https://en.wikipedia.org/wiki/{page_title.replace(' ', '_')}"
                extract_resp = await client.get("https://en.wikipedia.org/w/api.php", params={
                    "action": "query",
                    "titles": page_title,
                    "prop": "extracts",
                    "exintro": False,
                    "explaintext": True,
                    "exsectionformat": "plain",
                    "format": "json",
                    "utf8": 1,
                })
                if extract_resp.status_code != 200:
                    continue

                extract_data = extract_resp.json()
                pages = extract_data.get("query", {}).get("pages", {})

                for page_id, page_info in pages.items():
                    extract = page_info.get("extract", "")
                    if extract:
                        if len(extract) > 3000:
                            extract = extract[:3000] + "..."
                        all_extracts.append(f"Wikipedia ({page_title}) [URL: {page_url}]:\n{extract}")
                        break

            return "\n\n".join(all_extracts) if all_extracts else ""

    except Exception as e:
        logger.error(f"Wikipedia search error: {e}")
        return ""


async def search_web(query: str) -> str:
    """Search the web using DuckDuckGo HTML search for real results with URLs."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        async with httpx.AsyncClient(timeout=10.0, headers=headers, follow_redirects=True) as client:
            # Use DuckDuckGo HTML search for better results
            resp = await client.get("https://html.duckduckgo.com/html/", params={
                "q": query,
            })

            if resp.status_code != 200:
                logger.warning(f"DuckDuckGo HTML search HTTP {resp.status_code}")
                return await _search_web_instant(query)

            soup = BeautifulSoup(resp.text, "html.parser")
            results = []

            # Parse search results with URLs
            result_divs = soup.find_all("div", class_="result")
            if not result_divs:
                # Try alternative parsing
                result_divs = soup.find_all("div", class_="links_main")

            count = 0
            for div in result_divs:
                if count >= 5:
                    break
                link_tag = div.find("a", class_="result__a")
                snippet_tag = div.find("a", class_="result__snippet")
                if not link_tag and not snippet_tag:
                    # Try alternative selectors
                    link_tag = div.find("a")
                    snippet_tag = div.find("td", class_="result__snippet") or div.find("div", class_="result__snippet")

                if link_tag:
                    title = link_tag.get_text(strip=True)
                    href = link_tag.get("href", "")
                    # DuckDuckGo URLs may be redirect URLs, extract actual URL
                    if "uddg=" in href:
                        import urllib.parse
                        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                        actual_url = parsed.get("uddg", [href])[0]
                    else:
                        actual_url = href

                    text = snippet_tag.get_text(strip=True) if snippet_tag else ""
                    if title:
                        count += 1
                        if text:
                            results.append(f"{count}. {title}\n   URL: {actual_url}\n   Summary: {text}")
                        else:
                            results.append(f"{count}. {title}\n   URL: {actual_url}")

            if results:
                return "Web Search Results:\n" + "\n\n".join(results)

            # Fallback: try simple link+snippet parsing
            result_links = soup.find_all("a", class_="result__a")
            result_snippets = soup.find_all("a", class_="result__snippet")
            for i, link in enumerate(result_links[:5]):
                title = link.get_text(strip=True)
                href = link.get("href", "")
                if "uddg=" in href:
                    import urllib.parse
                    parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                    href = parsed.get("uddg", [href])[0]
                snippet_text = result_snippets[i].get_text(strip=True) if i < len(result_snippets) else ""
                if title:
                    if snippet_text:
                        results.append(f"{i+1}. {title}\n   URL: {href}\n   Summary: {snippet_text}")
                    else:
                        results.append(f"{i+1}. {title}\n   URL: {href}")

            if results:
                return "Web Search Results:\n" + "\n\n".join(results)

            return await _search_web_instant(query)

    except Exception as e:
        logger.error(f"Web search error: {e}")
        return await _search_web_instant(query)


async def _search_web_instant(query: str) -> str:
    """Fallback: DuckDuckGo instant answer API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://api.duckduckgo.com/", params={
                "q": query,
                "format": "json",
                "no_redirect": 1,
            })
            data = resp.json()

            results = []

            abstract = data.get("AbstractText", "")
            if abstract:
                source = data.get("AbstractSource", "")
                results.append(f"Source ({source}): {abstract}")

            for topic in data.get("RelatedTopics", [])[:3]:
                if isinstance(topic, dict) and "Text" in topic:
                    results.append(topic["Text"])

            return "\n\n".join(results) if results else ""

    except Exception as e:
        logger.error(f"Web instant search error: {e}")
        return ""


async def get_youtube_transcript(video_id: str) -> str:
    """Get transcript from a YouTube video.
    
    Lightweight approach (no ffmpeg/speech recognition):
    1. Try youtube-transcript-api first (fast, subtitle-based)
    2. Try extracting captions from YouTube page HTML (timedtext API)
    3. Fallback: Enhanced metadata extraction (oEmbed + page scraping + structured data)
    """
    # Strategy 1: Try subtitle-based transcript via library (fast)
    subtitle_result = await _try_subtitle_transcript(video_id)
    if subtitle_result:
        logger.info(f"Got transcript via subtitle API for {video_id}")
        return subtitle_result
    
    # Strategy 2: Try extracting captions from YouTube page HTML
    logger.info(f"Subtitle API failed for {video_id}, trying page caption extraction...")
    page_caption_result = await _try_page_caption_extraction(video_id)
    if page_caption_result:
        logger.info(f"Got transcript via page caption extraction for {video_id}")
        return page_caption_result
    
    # Strategy 3: Enhanced metadata fallback
    logger.info(f"All transcript methods failed for {video_id}, using enhanced metadata...")
    return await get_youtube_metadata_fallback(video_id)


async def _try_subtitle_transcript(video_id: str) -> str:
    """Try to get transcript via youtube-transcript-api (subtitle-based)."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        api = YouTubeTranscriptApi()

        try:
            transcript = api.fetch(video_id)
            snippets = transcript.snippets if hasattr(transcript, 'snippets') else transcript
            full_text = " ".join([s.text for s in snippets])
            if len(full_text) > 6000:
                full_text = full_text[:6000] + "...[transcript truncated]"
            return full_text
        except Exception as e1:
            logger.warning(f"Direct subtitle fetch failed for {video_id}: {e1}")
            try:
                transcript_list = api.list(video_id)
                for t in transcript_list:
                    fetched = t.fetch()
                    snippets = fetched.snippets if hasattr(fetched, 'snippets') else fetched
                    full_text = " ".join([s.text for s in snippets])
                    if len(full_text) > 6000:
                        full_text = full_text[:6000] + "...[transcript truncated]"
                    return full_text
            except Exception as e2:
                logger.warning(f"List transcripts also failed for {video_id}: {e2}")
    except ImportError:
        logger.warning("youtube-transcript-api not installed, skipping subtitle approach")
    return ""


async def _try_page_caption_extraction(video_id: str) -> str:
    """Try to extract captions by parsing YouTube page HTML for caption track URLs.
    
    YouTube embeds caption track URLs in ytInitialPlayerResponse.
    If available, fetches the timedtext XML and extracts text.
    Works even when youtube-transcript-api fails (different request pattern).
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        cookies = {"CONSENT": "YES+cb.20210328-17-p0.en+FX+999"}
        
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(
                f"https://www.youtube.com/watch?v={video_id}",
                headers=headers,
                cookies=cookies,
            )
            if resp.status_code != 200:
                return ""
            
            # Extract ytInitialPlayerResponse from page source
            import json
            match = re.search(r'ytInitialPlayerResponse\s*=\s*({.*?});\s*(?:var|</script>)', resp.text)
            if not match:
                logger.warning(f"No ytInitialPlayerResponse found for {video_id}")
                return ""
            
            try:
                player_data = json.loads(match.group(1))
            except json.JSONDecodeError:
                return ""
            
            # Check if player data is accessible (not LOGIN_REQUIRED)
            status = player_data.get("playabilityStatus", {}).get("status", "")
            if status != "OK":
                logger.warning(f"YouTube player status: {status} for {video_id}")
                return ""
            
            # Extract caption tracks
            captions = player_data.get("captions", {})
            tracks = captions.get("playerCaptionsTracklistRenderer", {}).get("captionTracks", [])
            
            if not tracks:
                logger.info(f"No caption tracks found for {video_id}")
                return ""
            
            # Prefer manual captions over auto-generated
            manual_tracks = [t for t in tracks if t.get("kind") != "asr"]
            auto_tracks = [t for t in tracks if t.get("kind") == "asr"]
            ordered_tracks = manual_tracks + auto_tracks
            
            for track in ordered_tracks:
                base_url = track.get("baseUrl", "")
                if not base_url:
                    continue
                
                lang_code = track.get("languageCode", "unknown")
                is_auto = track.get("kind") == "asr"
                
                # Fetch caption text (request as JSON3 format for easier parsing)
                caption_url = base_url + "&fmt=json3"
                cap_resp = await client.get(caption_url, headers=headers, cookies=cookies)
                
                if cap_resp.status_code == 200:
                    try:
                        cap_data = cap_resp.json()
                        events = cap_data.get("events", [])
                        text_parts = []
                        for event in events:
                            segs = event.get("segs", [])
                            for seg in segs:
                                utf8 = seg.get("utf8", "").strip()
                                if utf8 and utf8 != "\n":
                                    text_parts.append(utf8)
                        
                        if text_parts:
                            full_text = " ".join(text_parts)
                            # Clean up extra whitespace
                            full_text = re.sub(r'\s+', ' ', full_text).strip()
                            lang_label = _get_language_name(lang_code) if lang_code in _get_all_language_codes() else lang_code
                            caption_type = "auto-generated" if is_auto else "manual"
                            
                            if len(full_text) > 8000:
                                full_text = full_text[:8000] + "...[transcript truncated]"
                            
                            return f"[Language: {lang_label} ({caption_type} captions)]\n\n{full_text}"
                    except (json.JSONDecodeError, KeyError):
                        # Try plain text format as fallback
                        cap_resp2 = await client.get(base_url, headers=headers, cookies=cookies)
                        if cap_resp2.status_code == 200:
                            soup = BeautifulSoup(cap_resp2.text, "html.parser")
                            texts = [t.get_text() for t in soup.find_all("text")]
                            if texts:
                                full_text = " ".join(texts)
                                if len(full_text) > 8000:
                                    full_text = full_text[:8000] + "...[transcript truncated]"
                                return f"[Language: {lang_code}]\n\n{full_text}"
            
            return ""
    except Exception as e:
        logger.error(f"Page caption extraction error: {e}")
        return ""


def _get_all_language_codes() -> set:
    """Return all supported language codes for language name lookup."""
    return {
        "en-US", "en", "bn-BD", "bn", "hi-IN", "hi", "ar-SA", "ar",
        "ur-PK", "ur", "es-ES", "es", "fr-FR", "fr", "de-DE", "de",
        "pt-BR", "pt", "ru-RU", "ru", "ja-JP", "ja", "ko-KR", "ko",
        "zh-CN", "zh", "id-ID", "id", "tr-TR", "tr", "th-TH", "th",
        "vi-VN", "vi", "it-IT", "it", "nl-NL", "nl", "pl-PL", "pl",
    }


def _get_language_name(lang_code: str) -> str:
    """Convert language code to human-readable name."""
    lang_names = {
        "en-US": "English", "en": "English",
        "bn-BD": "Bengali (Bangla)", "bn": "Bengali (Bangla)",
        "hi-IN": "Hindi", "hi": "Hindi",
        "ar-SA": "Arabic", "ar": "Arabic",
        "ur-PK": "Urdu", "ur": "Urdu",
        "es-ES": "Spanish", "es": "Spanish",
        "fr-FR": "French", "fr": "French",
        "de-DE": "German", "de": "German",
        "pt-BR": "Portuguese", "pt": "Portuguese",
        "ru-RU": "Russian", "ru": "Russian",
        "ja-JP": "Japanese", "ja": "Japanese",
        "ko-KR": "Korean", "ko": "Korean",
        "zh-CN": "Chinese (Mandarin)", "zh": "Chinese",
        "id-ID": "Indonesian", "id": "Indonesian",
        "tr-TR": "Turkish", "tr": "Turkish",
        "th-TH": "Thai", "th": "Thai",
        "vi-VN": "Vietnamese", "vi": "Vietnamese",
        "it-IT": "Italian", "it": "Italian",
        "nl-NL": "Dutch", "nl": "Dutch",
        "pl-PL": "Polish", "pl": "Polish",
        "ms": "Malay", "ta": "Tamil", "te": "Telugu",
        "ml": "Malayalam", "gu": "Gujarati", "mr": "Marathi",
        "pa": "Punjabi", "sw": "Swahili", "fil": "Filipino",
    }
    return lang_names.get(lang_code, lang_code)


async def get_youtube_metadata_fallback(video_id: str) -> str:
    """Enhanced fallback: extract maximum context from YouTube via oEmbed, meta tags, and structured data.
    
    Even when transcripts and audio are blocked, YouTube page meta tags and oEmbed 
    provide title, description, channel, keywords, and more. This gives the AI enough
    context to provide a meaningful explanation of the video.
    """
    import json as json_mod
    
    metadata_parts = []
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.5",
        }
        cookies = {"CONSENT": "YES+cb.20210328-17-p0.en+FX+999"}
        
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            # 1. Get oEmbed data (always works from cloud IPs)
            try:
                oembed_resp = await client.get(
                    f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                )
                if oembed_resp.status_code == 200:
                    oembed = oembed_resp.json()
                    title = oembed.get("title", "")
                    author = oembed.get("author_name", "")
                    if title:
                        metadata_parts.append(f"Video Title: {title}")
                    if author:
                        metadata_parts.append(f"Channel: {author}")
            except Exception:
                pass
            
            # 2. Scrape YouTube watch page for rich metadata
            try:
                page_resp = await client.get(
                    f"https://www.youtube.com/watch?v={video_id}",
                    headers=headers,
                    cookies=cookies,
                )
                if page_resp.status_code == 200:
                    page_text = page_resp.text
                    soup = BeautifulSoup(page_text, "html.parser")
                    
                    # Extract meta tags
                    desc_tag = soup.find("meta", {"name": "description"})
                    if desc_tag and desc_tag.get("content"):
                        metadata_parts.append(f"Description: {desc_tag['content']}")
                    
                    og_desc = soup.find("meta", {"property": "og:description"})
                    if og_desc and og_desc.get("content"):
                        og_content = og_desc["content"]
                        if not desc_tag or og_content != desc_tag.get("content"):
                            metadata_parts.append(f"Summary: {og_content}")
                    
                    kw_tag = soup.find("meta", {"name": "keywords"})
                    if kw_tag and kw_tag.get("content"):
                        metadata_parts.append(f"Keywords: {kw_tag['content']}")
                    
                    # Extract structured data (JSON-LD) for richer context
                    for script_tag in soup.find_all("script", {"type": "application/ld+json"}):
                        try:
                            ld_data = json_mod.loads(script_tag.string)
                            if isinstance(ld_data, dict):
                                # VideoObject schema
                                if ld_data.get("@type") == "VideoObject":
                                    if ld_data.get("description") and f"Description:" not in "\n".join(metadata_parts):
                                        desc = ld_data["description"]
                                        if len(desc) > 500:
                                            desc = desc[:500] + "..."
                                        metadata_parts.append(f"Full Description: {desc}")
                                    if ld_data.get("duration"):
                                        metadata_parts.append(f"Duration: {ld_data['duration']}")
                                    if ld_data.get("uploadDate"):
                                        metadata_parts.append(f"Upload Date: {ld_data['uploadDate']}")
                                    if ld_data.get("interactionStatistic"):
                                        for stat in ld_data["interactionStatistic"]:
                                            if "Watch" in stat.get("interactionType", {}).get("@type", ""):
                                                metadata_parts.append(f"Views: {stat.get('userInteractionCount', 'N/A')}")
                        except (json_mod.JSONDecodeError, TypeError):
                            continue
                    
                    # Try to extract video description from ytInitialData
                    yt_data_match = re.search(r'ytInitialData\s*=\s*({.*?});\s*(?:window|</script>)', page_text)
                    if yt_data_match:
                        try:
                            yt_data = json_mod.loads(yt_data_match.group(1))
                            # Navigate to video description in ytInitialData
                            contents = yt_data.get("contents", {}).get("twoColumnWatchNextResults", {}).get("results", {}).get("results", {}).get("contents", [])
                            for content in contents:
                                vpm = content.get("videoPrimaryInfoRenderer", {})
                                vsm = content.get("videoSecondaryInfoRenderer", {})
                                
                                # Get view count and date
                                if vpm:
                                    view_count = vpm.get("viewCount", {}).get("videoViewCountRenderer", {}).get("viewCount", {}).get("simpleText", "")
                                    if view_count and "Views:" not in "\n".join(metadata_parts):
                                        metadata_parts.append(f"Views: {view_count}")
                                    date_text = vpm.get("dateText", {}).get("simpleText", "")
                                    if date_text and "Upload Date:" not in "\n".join(metadata_parts):
                                        metadata_parts.append(f"Published: {date_text}")
                                
                                # Get full description
                                if vsm:
                                    desc_obj = vsm.get("attributedDescription", {})
                                    desc_content = desc_obj.get("content", "")
                                    if desc_content and len(desc_content) > 50:
                                        if len(desc_content) > 1000:
                                            desc_content = desc_content[:1000] + "..."
                                        if "Full Description:" not in "\n".join(metadata_parts):
                                            metadata_parts.append(f"Full Description: {desc_content}")
                        except (json_mod.JSONDecodeError, TypeError, KeyError):
                            pass
            except Exception as e:
                logger.warning(f"Page scraping error for {video_id}: {e}")
            
            # 3. Try noembed as additional source
            if not metadata_parts:
                try:
                    noembed_resp = await client.get(
                        f"https://noembed.com/embed?url=https://www.youtube.com/watch?v={video_id}"
                    )
                    if noembed_resp.status_code == 200:
                        noembed = noembed_resp.json()
                        if noembed.get("title"):
                            metadata_parts.append(f"Video Title: {noembed['title']}")
                        if noembed.get("author_name"):
                            metadata_parts.append(f"Channel: {noembed['author_name']}")
                except Exception:
                    pass

        if metadata_parts:
            result = "\n".join(metadata_parts)
            result += "\n\n[Note: Full transcript could not be extracted. The AI will explain based on video metadata, title, description, and keywords. For videos with subtitles/captions, the full transcript will be used automatically.]"
            return result
        else:
            return f"[Could not retrieve transcript or metadata for video {video_id}. YouTube may be blocking requests from this server.]"

    except Exception as e:
        logger.error(f"YouTube metadata fallback error: {e}")
        return f"[Could not retrieve video information: {str(e)}]"


async def verify_youtube_url(video_id: str) -> bool:
    """Verify a YouTube video exists by checking oEmbed."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            )
            return resp.status_code == 200
    except Exception:
        return False


async def search_youtube(query: str) -> str:
    """Search YouTube for videos related to the query and return verified video links."""
    try:
        search_query = f"site:youtube.com {query}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        async with httpx.AsyncClient(timeout=10.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get("https://html.duckduckgo.com/html/", params={
                "q": search_query,
            })

            if resp.status_code != 200:
                return ""

            soup = BeautifulSoup(resp.text, "html.parser")
            results = []
            count = 0

            result_links = soup.find_all("a", class_="result__a")
            for link in result_links:
                if count >= 5:
                    break
                title = link.get_text(strip=True)
                href = link.get("href", "")
                # Extract actual URL from DuckDuckGo redirect
                if "uddg=" in href:
                    import urllib.parse
                    parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                    actual_url = parsed.get("uddg", [href])[0]
                else:
                    actual_url = href

                # Only include YouTube video URLs (not playlist or channel)
                if "youtube.com/watch" in actual_url or "youtu.be/" in actual_url:
                    # Verify video exists
                    vid_id = extract_youtube_video_id(actual_url)
                    if vid_id:
                        is_valid = await verify_youtube_url(vid_id)
                        if is_valid:
                            count += 1
                            results.append(f"{count}. {title}\n   URL: {actual_url}")

            if results:
                return "YouTube Video Results:\n" + "\n\n".join(results)
            return ""

    except Exception as e:
        logger.error(f"YouTube search error: {e}")
        return ""


def _is_youtube_request(message: str) -> bool:
    """Check if the user is asking for YouTube videos."""
    return bool(re.search(
        r'\b(youtube|video|videos|watch|dekhao|dekha|dekhte|gaan|song|music|tutorial|clip|suggest.*video|video.*suggest|video.*daw|video.*dao|video.*den|video.*link)\b',
        message, re.IGNORECASE
    ))


def _is_self_referential(message: str) -> bool:
    """Detect if the message is about the conversation itself or references previous context.
    
    These messages should NEVER trigger web search — the AI should answer from conversation history.
    Examples: 'What was our last conversation?', 'Summarize it', 'What is the main goal of this repo?',
    'What did I ask you?', 'Explain it more'
    """
    msg = message.strip().lower()
    
    # References to "this" thing from conversation (this repo, this project, this code, etc.)
    if re.search(r'\b(this|that|the)\s+(repo|repository|project|code|file|function|script|app|page|topic|issue|problem|solution|answer|response)\b', msg, re.IGNORECASE):
        return True
    
    # Questions about conversation history
    if re.search(r'\b(our|my|the|last|previous|earlier|above|your)\s+(conversation|chat|discussion|message|response|answer|reply|talk)\b', msg, re.IGNORECASE):
        return True
    
    # Summarize/recap requests (any form of summarize/recap + any context word)
    if re.search(r'\b(summar|summarize|summarise|summeriz|summari|summerize|summerrise|recap|review|repeat|remind)\b', msg, re.IGNORECASE):
        # If asking to summarize anything conversation-related OR just "summarize it/this/the/full/all"
        if re.search(r'\b(conversation|chat|discussion|it|this|that|what|everything|full|all|our|the|history|above|previous|last)\b', msg, re.IGNORECASE):
            return True
    if re.search(r'\b(what|how)\b.*\b(we|i|you)\b.*\b(discuss|talk|chat|said|ask|mention|cover)\b', msg, re.IGNORECASE):
        return True
    
    # "What did I/you/we ..." patterns
    if re.search(r'^what\s+(did|was|were|have|has)\s+(i|you|we)\b', msg, re.IGNORECASE):
        return True
    
    # "Why are you not ..." / "Why did you ..." — meta questions about AI behavior
    if re.search(r'^why\s+(are|did|do|don\'t|didn\'t|can\'t|won\'t)\s+you\b', msg, re.IGNORECASE):
        return True
    
    # Bangla/Banglish self-referential
    if re.search(r'\b(amader|amar|tomar|apnar)\s+(conversation|chat|kotha|alochona|last|age|previous)\b', msg, re.IGNORECASE):
        return True
    
    return False


def _is_followup_or_conversational(message: str) -> bool:
    """Detect if a message is a short follow-up or conversational reply that doesn't need web search.
    
    Follow-ups typically use pronouns, are short, or reference previous context without introducing
    a new specific topic that would benefit from a web search.
    
    EXCEPTION: YouTube/video requests are NEVER treated as follow-ups.
    """
    msg = message.strip().lower()
    
    # YouTube/video requests are NEVER follow-ups — always search
    if _is_youtube_request(msg):
        return False
    
    # Self-referential messages about the conversation itself — ALWAYS skip web search
    if _is_self_referential(msg):
        return True
    
    # Very short messages are usually follow-ups (under 30 chars)
    if len(msg) < 30:
        return True
    
    # Messages with pronouns referring to previous context (Bangla + English)
    followup_patterns = [
        # Bangla/Banglish pronouns and follow-up words
        r'\b(tini|tar|tader|onar|uni|she|her|his|him|they|it|eta|ota|sheta)\b',
        # Common follow-up phrases in Bangla/Banglish
        r'\b(aro|ar|ebong|kintu|keno|kivabe|kotodin|kobe|kokhon)\b.*\b(kore|korche|korchen|hoy|hoye|hoyeche|jay|jabe|parbe)\b',
        # Simple conversational responses / acknowledgments
        r'^(ok|okay|hmm|accha|bujhsi|thik|ha|na|ji|haan|nah|thanks|dhonnobad|yes|no|yeah|yep|nope|sure|right|correct|wrong|exactly|absolutely|definitely|of course|great|good|nice|awesome|cool|perfect|wonderful|alright|fine|got it|understood|i see|makes sense)\b',
        # Affirmative/agreement patterns
        r'^(you are|you\'re|that\'s|that is)\s+(right|correct|wrong|good|great|awesome|perfect)\b',
        # Questions about "how long", "when", "how" that reference prior context
        r'^(kotodin|kobe|kokhon|kivabe|keno)\b',
        # "Tell me more", "explain more" type follow-ups
        r'\b(aro|more|bolo|bolun|details|bistarito)\b',
    ]
    
    for pattern in followup_patterns:
        if re.search(pattern, msg, re.IGNORECASE):
            # But if message also has a clear searchable noun/topic (English), still search
            has_clear_topic = bool(re.search(
                r'\b(president|prime minister|PM|CEO|country|city|war|election|company|[A-Z][a-z]+\s[A-Z][a-z]+)\b',
                message
            ))
            if not has_clear_topic:
                return True
    
    return False


def _needs_web_search(message: str) -> bool:
    """Intelligently decide if a message needs web search.
    
    Returns True ONLY when the user is asking about something that requires
    real-time or factual information the AI may not know from training data.
    Returns False for:
    - General knowledge questions the AI can answer from training data
    - Coding/programming questions
    - Math/logic questions
    - Conversational messages
    - Creative writing requests
    - Opinion/advice questions
    """
    msg = message.strip().lower()
    
    # NEVER search for these types of messages
    no_search_patterns = [
        # Coding/programming
        r'\b(write|create|build|generate|make|code|implement|develop|program|fix|debug|refactor)\b.*\b(code|function|class|app|script|program|page|component|api|website|html|css|js|python|java|react|sql)\b',
        # Math/logic
        r'\b(calculate|solve|compute|what is \d|how many|\d+\s*[+\-*/]\s*\d+)\b',
        # Creative writing
        r'\b(write|compose|draft)\b.*\b(poem|story|essay|letter|email|message|song|lyrics)\b',
        # Explanation of concepts (AI knows from training)
        r'^(what is|what are|explain|define|how does|how do|difference between|compare)\b.*\b(algorithm|data structure|design pattern|programming|software|machine learning|AI|database|network|protocol|framework|library|OOP|API|REST|HTTP|TCP|UDP|DNS|encryption|blockchain)\b',
        # Advice/opinion
        r'\b(should i|recommend|suggest|advice|opinion|best way to|how to learn|tips for)\b',
        # Translation
        r'\b(translate|meaning of|what does .+ mean)\b',
    ]
    
    for pattern in no_search_patterns:
        if re.search(pattern, msg, re.IGNORECASE):
            return False
    
    # YES search for these — current events, specific people/places, news
    search_patterns = [
        # Current events / news
        r'\b(latest|recent|current|today|yesterday|this week|this month|this year|2025|2026|news|update)\b',
        # Specific factual lookups that may need fresh data
        r'\b(who is|who was|who are)\b.*\b(president|prime minister|PM|CEO|founder|leader|king|queen|minister)\b',
        # Weather, stocks, live data
        r'\b(weather|stock|price|score|result|election|GDP|population)\b',
        # Explicit search intent
        r'\b(search|look up|find|google|check online)\b',
        # Questions about specific real-world entities that may need fresh data
        r'\b(when did|when was|when will|how old is|where is|where was)\b',
    ]
    
    for pattern in search_patterns:
        if re.search(pattern, msg, re.IGNORECASE):
            return True
    
    # For messages over 15 words with a question mark — likely needs info
    word_count = len(msg.split())
    has_question = '?' in msg
    
    # Short factual questions (under 8 words) — search to be safe
    if has_question and word_count <= 8:
        # But not for coding/math questions
        if not re.search(r'\b(code|function|error|bug|how to|learn)\b', msg, re.IGNORECASE):
            return True
    
    # Default: don't search — let the AI answer from its training
    return False


def _is_greeting_only(message: str) -> bool:
    """Check if the message is just a greeting with no real question."""
    msg = message.strip().lower()
    greeting_patterns = [
        r'^(hi|hello|hey|good morning|good evening|good afternoon|good night|assalamu alaikum|salam|namaskar)\b',
        r'^(whats up|what\'s up|howdy|yo|sup)\b',
    ]
    for pattern in greeting_patterns:
        if re.match(pattern, msg) and len(msg) < 50:
            return True
    return False


def _extract_github_url_from_history(conversation_history: list[dict]) -> str:
    """Extract a GitHub URL from recent conversation history.
    
    When user sends a follow-up like 'Generate the project directory' after sharing
    a GitHub org/repo URL, this function finds that URL from conversation context.
    """
    if not conversation_history:
        return ""
    
    for msg in reversed(conversation_history):
        content = msg.get("content", "")
        if not content:
            continue
        # Look for GitHub URLs in message content
        github_urls = re.findall(r'https?://github\.com/[\w.-]+(?:/[\w.-]+)?', content)
        if github_urls:
            return github_urls[0]
    return ""


def _is_github_followup(message: str) -> bool:
    """Check if a message is a follow-up about a GitHub repo/org from conversation context.
    
    E.g.: 'Generate the project directory', 'scrape it', 'show the files', etc.
    """
    msg = message.strip().lower()
    return bool(re.search(
        r'\b(generate|scrape|show|list|get|fetch|display|create|give|daw|dekhao)\b.*\b(directory|structure|files|tree|project|repo|repository|repos|code|content)\b',
        msg, re.IGNORECASE
    )) or bool(re.search(
        r'\b(directory|structure|files|tree|project|repos)\b.*\b(generate|scrape|show|list|daw|dekhao|banao|koro)\b',
        msg, re.IGNORECASE
    ))


def _extract_topic_from_history(conversation_history: list[dict]) -> str:
    """Extract the main topic from conversation history for context-aware search.
    
    Looks at the last few messages to understand what topic the user is discussing.
    """
    if not conversation_history:
        return ""
    
    # Get last few user and assistant messages (skip system)
    recent = []
    for msg in reversed(conversation_history):
        if msg.get("role") in ("user", "assistant") and len(recent) < 4:
            recent.insert(0, msg)
    
    # Extract key nouns/topics from recent messages
    topics = []
    for msg in recent:
        content = msg.get("content", "")
        # Remove any injected context tags
        content = re.sub(r'\[(?:YOUTUBE|WEB|REFERENCE|SCRAPED)[^\]]*\][\s\S]*?\[END[^\]]*\]', '', content)
        # Take first 200 chars of each message
        topics.append(content[:200].strip())
    
    combined = " ".join(topics)
    # Extract English words that look like topics (capitalized, proper nouns)
    english_topics = re.findall(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*', combined)
    if english_topics:
        return " ".join(english_topics[:5])
    
    # Fallback: use last assistant message content (first 100 chars)
    for msg in reversed(recent):
        if msg.get("role") == "assistant":
            text = msg.get("content", "")[:100]
            # Remove common filler words
            text = re.sub(r'\b(the|is|are|was|were|a|an|of|in|to|for|and|or|but|this|that|it|with)\b', '', text, flags=re.IGNORECASE)
            return text.strip()
    
    return ""


async def gather_context(user_message: str, conversation_history: list[dict] | None = None, force_search: bool | None = None) -> str:
    """Analyze user message and gather external context.

    Searches Wikipedia and web for messages that contain a clear topic/question.
    Skips search for follow-up messages, greetings, and conversational replies
    where the AI should use existing conversation context instead.
    
    For YouTube requests that reference conversation context ("eta niye video daw"),
    uses conversation history to build the search query.
    
    Args:
        force_search: If True, LLM decided search is needed — skip regex checks and search.
                      If False, LLM decided no search needed — skip web search.
                      If None, use existing regex-based logic (backward compatible).
    """
    urls = extract_urls(user_message)
    context_parts = []

    for url in urls:
        if is_youtube_url(url):
            video_id = extract_youtube_video_id(url)
            if video_id:
                transcript = await get_youtube_transcript(video_id)
                context_parts.append(
                    f"\n\n[YOUTUBE VIDEO TRANSCRIPT (Video ID: {video_id})]:\n{transcript}\n[END TRANSCRIPT]"
                )
        elif is_github_org_url(url):
            # Check org BEFORE repo — org URL (github.com/name) must not fall into repo check
            org_content = await scrape_github_org(url)
            context_parts.append(
                f"\n\n[GITHUB ORGANIZATION CONTENT from {url}]:\n{org_content}\n[END GITHUB ORG CONTENT]"
            )
        elif is_github_repo_url(url):
            repo_content = await scrape_github_repo(url)
            context_parts.append(
                f"\n\n[GITHUB REPOSITORY CONTENT from {url}]:\n{repo_content}\n[END GITHUB CONTENT]"
            )
        else:
            scraped = await scrape_url(url)
            context_parts.append(
                f"\n\n[SCRAPED WEB CONTENT from {url}]:\n{scraped}\n[END SCRAPED CONTENT]"
            )

    # Search for messages that contain a real question/topic (not follow-ups or greetings)
    if not urls:
        # Skip search for pure greetings
        if _is_greeting_only(user_message):
            return ""
        
        # Check if this is a GitHub-related follow-up that needs context from history
        if _is_github_followup(user_message) and conversation_history:
            github_url = _extract_github_url_from_history(conversation_history)
            if github_url:
                logger.info(f"GitHub follow-up detected, re-scraping: {github_url}")
                if is_github_org_url(github_url):
                    org_content = await scrape_github_org(github_url)
                    context_parts.append(
                        f"\n\n[GITHUB ORGANIZATION CONTENT from {github_url}]:\n{org_content}\n[END GITHUB ORG CONTENT]"
                    )
                elif is_github_repo_url(github_url):
                    repo_content = await scrape_github_repo(github_url)
                    context_parts.append(
                        f"\n\n[GITHUB REPOSITORY CONTENT from {github_url}]:\n{repo_content}\n[END GITHUB CONTENT]"
                    )
                return "\n".join(context_parts)
        
        # Determine if web search should happen
        # force_search=True  -> LLM said YES, always search
        # force_search=False -> LLM said NO, skip web search
        # force_search=None  -> use legacy regex logic
        should_search = force_search
        if should_search is None:
            # Legacy path: use regex-based decision
            if _is_followup_or_conversational(user_message):
                logger.info(f"Skipping web search for follow-up message: {user_message[:50]}...")
                return ""
            should_search = _needs_web_search(user_message)
        
        # Always check for YouTube requests regardless of search decision
        stripped = re.sub(r'^(hi|hello|hey|good morning|good evening)[,!.\s]*', '', user_message, flags=re.IGNORECASE).strip()
        if _is_youtube_request(stripped) and len(stripped) > 5:
            topic = re.sub(
                r'\b(youtube|video|videos|watch|dekhao|dekha|dekhte|chai|link|url|daw|dao|den|din|show|find|search|give|gaan|song|music|tutorial|clip|suggest|koro|korte|ekti|akti|niye|eta|ota|amake|amar|please|pls)\b',
                '', stripped, flags=re.IGNORECASE
            ).strip()
            topic = re.sub(r'\s+', ' ', topic).strip()
            if len(topic) < 5 and conversation_history:
                topic = _extract_topic_from_history(conversation_history)
            if topic and len(topic) >= 3:
                yt_result = await search_youtube(topic)
                if yt_result:
                    context_parts.append(f"\n\n[YOUTUBE SEARCH RESULTS (LIVE)]:\n{yt_result}\n[END YOUTUBE RESULTS]")
        
        if not should_search:
            logger.info(f"Web search not needed for: {user_message[:50]}...")
            return "".join(context_parts)
        
        # Web search IS needed (LLM said YES or regex matched) — proceed
        logger.info(f"Web search triggered for: {user_message[:50]}...")
        if len(stripped) > 5:
            wiki_result = await search_wikipedia(stripped)
            web_result = await search_web(stripped)

            if wiki_result:
                context_parts.append(f"\n\n[REFERENCE DATA (LIVE)]:\n{wiki_result}\n[END REFERENCE]")
            if web_result:
                context_parts.append(f"\n\n[WEB SEARCH RESULTS (LIVE)]:\n{web_result}\n[END SEARCH RESULTS]")

    return "".join(context_parts)
