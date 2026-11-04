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
                             "--no-first-run", "--disable-gpu", "--allow-file-access-from-files", url],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(100):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
                ws_url = next((t["webSocketDebuggerUrl"] for t in tabs if t.get("type") == "page"), None)
                if ws_url:
                    break
            except Exception:
                pass
            time.sleep(0.2)
        if not ws_url:
            raise SystemExit("Edge did not start")
        async with websockets.connect(ws_url, max_size=None) as ws:
            n = 0

            async def call(method, params):
                nonlocal n
                n += 1
                await ws.send(json.dumps({"id": n, "method": method, "params": params}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("id") == n:
                        return msg
            # wait for the page's scripts
            for _ in range(100):
                r = await call("Runtime.evaluate", {"expression": "document.readyState", "returnByValue": True})
                if r.get("result", {}).get("result", {}).get("value") == "complete":
                    break
                await asyncio.sleep(0.2)
            r = await asyncio.wait_for(call("Runtime.evaluate", {
                "expression": f"(async () => {{ return ({expr}); }})()",
                "awaitPromise": True, "returnByValue": True}), timeout)
            res = r.get("result", {})
            if "exceptionDetails" in res:
                ex = res["exceptionDetails"]
                print("ERROR:", ex.get("exception", {}).get("description") or ex.get("text"))
                return 1
            v = res.get("result", {}).get("value")
            print(v if isinstance(v, str) else json.dumps(v, indent=1))
            return 0
    finally:
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
