from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    c=b.new_context(viewport={'width':1440,'height':900}); p=c.new_page(); cdp=c.new_cdp_session(p)
    cdp.send('Network.enable'); cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
    cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':150,'downloadThroughput':200000,'uploadThroughput':93750})
    p.goto('http://127.0.0.1:8791/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?backend=webgl',wait_until='commit')
    for t in (60,95,130):
        p.wait_for_timeout((t-(60 if t>60 else 0))*1000 if t==60 else (35000))
        print(t,'s | ready=',p.evaluate('!!window.__livViewer?.ready'),'|',p.evaluate('document.body.innerText').replace('\n',' / ')[:300],flush=True)
    p.screenshot(path='slow4g-130s.png'); b.close()
