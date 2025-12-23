#!/usr/bin/env python3
"""
Experiment: Observe TIX.id token refresh mechanism.

Opens a browser, logs in, waits for token to age, then triggers
network activity to observe refresh calls.
"""
import asyncio
import json
from datetime import datetime
from playwright.async_api import async_playwright

async def main():
    print("🔬 Token Refresh Experiment")
    print("=" * 50)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Visible for observation
        context = await browser.new_context()
        page = await context.new_page()
        
        # Capture all network requests
        requests_log = []
        
        async def log_request(request):
            if 'api' in request.url or 'auth' in request.url.lower() or 'token' in request.url.lower():
                requests_log.append({
                    'time': datetime.now().isoformat(),
                    'method': request.method,
                    'url': request.url,
                    'headers': dict(request.headers),
                })
                print(f"\n🌐 [{request.method}] {request.url}")
                
        async def log_response(response):
            if 'auth' in response.url.lower() or 'token' in response.url.lower() or 'refresh' in response.url.lower():
                print(f"   📩 Response: {response.status}")
                try:
                    body = await response.text()
                    print(f"   📄 Body: {body[:200]}...")
                except:
                    pass
        
        page.on("request", log_request)
        page.on("response", log_response)
        
        print("\n1️⃣ Navigating to TIX.id...")
        await page.goto('https://app.tix.id/login')
        await page.wait_for_timeout(5000)
        
        print("\n2️⃣ Please log in manually in the browser window.")
        print("   (Or press Enter if already logged in)")
        
        # Wait for user to login
        input("\n   Press Enter after logging in...")
        
        # Navigate to home
        await page.goto('https://app.tix.id/home')
        await page.wait_for_timeout(3000)
        
        # Get initial token
        token = await page.evaluate("localStorage.getItem('authentication_token')")
        refresh_token = await page.evaluate("localStorage.getItem('authentication_refresh_token')")
        
        print(f"\n3️⃣ Initial tokens captured:")
        print(f"   Access token: {token[:50] if token else 'None'}...")
        print(f"   Refresh token: {refresh_token[:50] if refresh_token else 'None'}...")
        
        print("\n4️⃣ Now waiting... Token should expire in ~30 min.")
        print("   I'll check every 5 minutes and trigger activity.")
        print("   Watch for any /refresh or /token API calls.\n")
        
        for i in range(7):  # Check 7 times over 35 minutes
            mins_waited = i * 5
            print(f"\n⏱️  {mins_waited} minutes elapsed...")
            
            # Trigger some activity to make the app refresh
            await page.goto('https://app.tix.id/movies')
            await page.wait_for_timeout(3000)
            
            # Check if token changed
            new_token = await page.evaluate("localStorage.getItem('authentication_token')")
            if new_token != token:
                print(f"\n🎉 TOKEN CHANGED!")
                print(f"   Old: {token[:30]}...")
                print(f"   New: {new_token[:30]}...")
                print("\n   Check the logged requests above for the refresh endpoint!")
                token = new_token
            
            if i < 6:
                print(f"   Waiting 5 more minutes...")
                await page.wait_for_timeout(5 * 60 * 1000)  # 5 minutes
        
        # Save request log
        with open('data/token_refresh_experiment.json', 'w') as f:
            json.dump(requests_log, f, indent=2)
        
        print("\n📊 Experiment complete!")
        print(f"   Logged {len(requests_log)} API requests")
        print("   Saved to data/token_refresh_experiment.json")
        
        input("\nPress Enter to close browser...")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
