"""Run JavaScript in a project page inside headless Edge (no Node needed). Developer tool.

  python tools/edge.py PAGE "JS expression" [timeout_seconds]

PAGE is relative to the project root, e.g. "tests.html" or "tools/hash.html?x=1".
The expression may use await; its value is printed (strings as-is, others as JSON).
Example (one test group):  python tools/edge.py tests.html "await LES_TESTS.foundationTests(), document.getElementById('out').textContent"
Whole suite:               python tools/edge.py tests.html "await LES_TESTS.runAll(), document.getElementById('out').textContent" 600
Needs: Microsoft Edge and the Python 'websockets' package.
"""
import asyncio, json, os, pathlib, shutil, subprocess, sys, tempfile, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
EDGE = next((p for p in [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    shutil.which("msedge") or "",
] if p and os.path.exists(p)), None)


async def run(page, expr, timeout):
    import websockets
    port = 9300 + os.getpid() % 500
    prof = tempfile.mkdtemp(prefix="les-edge-")
    path, _, query = page.partition("?")
    url = (ROOT / path).as_uri() + ("?" + query if query else "")
    proc = subprocess.Popen([EDGE, "--headless=new", f"--remote-debugging-port={port}", f"--user-data-dir={prof}",
                             "--no-first-run", "--disable-gpu", "--allow-file-access-from-files",
                             # a hidden window must not have its timers slowed down (tests pause with setTimeout)
                             "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
                             "--disable-backgrounding-occluded-windows", "--disable-features=IntensiveWakeUpThrottling", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(100):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
                pages = [t for t in tabs if t.get("type") == "page"]
                ws_url = next((t["webSocketDebuggerUrl"] for t in pages if t.get("url", "") == "about:blank"), None)
                if not ws_url and _ > 25 and pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]  # navigated below anyway
                if ws_url:
                    break
            except Exception:
                pass
            time.sleep(0.2)
        if not ws_url:
            raise SystemExit("Edge did not start")
        async with websockets.connect(ws_url, max_size=None) as ws:
            n = 0

            errors, console = [], []

            async def call(method, params):
                nonlocal n
                n += 1
                my = n
                await ws.send(json.dumps({"id": my, "method": method, "params": params}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("id") == my:
                        return msg
                    m = msg.get("method")
                    if m == "Page.javascriptDialogOpening":  # never let alert/confirm block the page
                        errors.append("dialog: " + msg["params"].get("message", ""))
                        n += 1
                        await ws.send(json.dumps({"id": n, "method": "Page.handleJavaScriptDialog", "params": {"accept": True}}))
                    elif m == "Runtime.consoleAPICalled":
                        args = msg["params"].get("args", [])
                        console.append(" ".join(str(a.get("value", a.get("description", ""))) for a in args)[:300])
                        del console[:-20]
                    elif m == "Runtime.exceptionThrown":
                        ex = msg["params"]["exceptionDetails"]
                        errors.append("page error: " + (ex.get("exception", {}).get("description") or ex.get("text", ""))[:500])
            await call("Page.enable", {})
            await call("Runtime.enable", {})
            await call("Debugger.enable", {})  # so a stuck page can be paused and its stack shown
            await call("Page.navigate", {"url": url})  # with the handlers on, so load-time errors are seen
            for _ in range(150):  # wait for the page's scripts
                r = await call("Runtime.evaluate", {"expression": "location.href + '|' + document.readyState", "returnByValue": True})
                v = r.get("result", {}).get("result", {}).get("value") or ""
                if v.startswith("file:") and v.endswith("|complete"):
                    break
                await asyncio.sleep(0.2)
            try:
                r = await asyncio.wait_for(call("Runtime.evaluate", {
                    "expression": f"(async () => {{ return ({expr}); }})()",
                    "awaitPromise": True, "returnByValue": True}), timeout)
            except asyncio.TimeoutError:
                # Still running: pause the page and show where it is (an endless loop shows up here).
                print(f"TIMEOUT after {timeout:.0f}s; page stack:")
                n += 1
                await ws.send(json.dumps({"id": n, "method": "Debugger.pause", "params": {}}))
                try:
                    while True:
                        msg = json.loads(await asyncio.wait_for(ws.recv(), 20))
                        if msg.get("method") == "Debugger.paused":
                            for f in msg["params"]["callFrames"][:15]:
                                loc = f["location"]
                                print(f"  {f['functionName'] or '(anonymous)'}  {f['url'].split('/')[-1]}:{loc['lineNumber'] + 1}")
                            break
                except asyncio.TimeoutError:
                    print("  (the page is idle: it is waiting, not looping)")
                if console:
                    print("last console lines:")
                    for line in console:
                        print("  " + line)
                for e in errors:
                    print(e)
                return 3
            for e in errors:
                print(e)
            res = r.get("result", {})
            if "exceptionDetails" in res:
                ex = res["exceptionDetails"]
                print("ERROR:", ex.get("exception", {}).get("description") or ex.get("text"))
                return 1
            v = res.get("result", {}).get("value")
            print(v if isinstance(v, str) else json.dumps(v, indent=1))
            return 0
    finally:
        try:  # close the whole browser (all its child processes), not just the launcher
            ver = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=3))
            async with websockets.connect(ver["webSocketDebuggerUrl"], max_size=None) as bws:
                await bws.send(json.dumps({"id": 1, "method": "Browser.close"}))
                await asyncio.wait_for(bws.recv(), 5)
        except Exception:
            pass
        try:
            proc.wait(10)
        except Exception:
            pass
        proc.terminate()
        try:
            proc.wait(5)
        except Exception:
            proc.kill()
        shutil.rmtree(prof, ignore_errors=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 3 or not EDGE:
        print(__doc__)
        sys.exit(2)
    sys.exit(asyncio.run(run(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 300)))
