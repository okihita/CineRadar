#!/usr/bin/env python3
"""
Capture the exact request format for POST /v1/auth token refresh.
"""
import asyncio
import json
from datetime import datetime
from playwright.async_api import async_playwright

async def main():
    print("🔬 Capturing /v1/auth request details...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        auth_requests = []
        
        async def capture_request(request):
            if '/v1/auth' in request.url and 'auth' in request.url:
                req_data = {
                    'url': request.url,
                    'method': request.method,
                    'headers': dict(request.headers),
                    'post_data': request.post_data,
                }
                auth_requests.append(req_data)
                print(f"\n📥 Captured /v1/auth request:")
                print(f"   URL: {request.url}")
                print(f"   Method: {request.method}")
                print(f"   Headers: {json.dumps(dict(request.headers), indent=4)}")
                print(f"   Body: {request.post_data}")
        
        page.on("request", capture_request)
        
        print("\n1️⃣ Navigating to TIX.id home...")
        await page.goto('https://app.tix.id/home')
        await page.wait_for_timeout(5000)
        
        print("\n2️⃣ Navigating to movies page to trigger /v1/auth...")
        await page.goto('https://app.tix.id/movies')
        await page.wait_for_timeout(5000)
        
        print("\n3️⃣ Navigating back to home...")
        await page.goto('https://app.tix.id/home')
        await page.wait_for_timeout(3000)
        
        # Save captured requests
        with open('data/auth_request_details.json', 'w') as f:
            json.dump(auth_requests, f, indent=2)
        
        print(f"\n✅ Captured {len(auth_requests)} /v1/auth requests")
        print("   Saved to data/auth_request_details.json")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
