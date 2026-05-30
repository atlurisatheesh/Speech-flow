import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        print("Launching headless Chromium...")
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("Navigating to http://localhost:3000...")
        
        # Let React compile and start
        try:
            await page.goto("http://localhost:3000", timeout=60000)
        except Exception as e:
            print("Failed to reach frontend:", e)
            return

        # Give it a second to render
        await page.wait_for_timeout(3000)
        
        title = await page.title()
        print(f"Page title: {title}")
        
        # Dump the text content of the page
        text = await page.evaluate("document.body.innerText")
        print("--- PAGE CONTENT PREVIEW ---")
        print(text[:800])
        print("----------------------------")
        
        if "React" in text or "Speech" in text or "Upload" in text:
            print("✅ AUTOMATED TEST PASSED: DOM loaded successfully!")
        else:
            print("⚠️ DOM loaded, but couldn't verify the exact text.")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
