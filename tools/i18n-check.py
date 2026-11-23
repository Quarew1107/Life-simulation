"""Translation checks for a language (developer tool; headless Edge, no Node needed).

  python tools/i18n-check.py scan  [--lang zh-Hans] [--countries my,uk,us,cn] [--years 10] [--stage adult] [--out FILE]
  python tools/i18n-check.py audit [--lang zh-Hans] [--out FILE]

scan   starts a world in the language for each country, opens every tab, a spread of people, every kind of
       building and every dialog (tools/i18n-scan.js), and lists text on screen that is still English:
       country, count, where it was seen, the text. A summary of the most common English phrases follows.
       --stage picks the Play a Life stage (baby, child, teen, adult, senior); run it for several stages.
audit  lists data names (jobs, courses, festivals, laws, offices, statistics sources...) with no translation
       (tools/i18n-audit.js).

Works for any language in LES.I18n.LANGS. For a new language, first add js/i18n/<code>.js (and
<code>-sentences.js), then run audit and scan until only names are left. See docs/TRANSLATING.md.
Needs: Microsoft Edge and the Python 'websockets' package (as tools/edge.py). One headless browser at a time.
"""
import argparse, asyncio, collections, contextlib, io, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import edge  # noqa: E402


def run(page, setup, script, timeout):
    js = (HERE / script).read_text(encoding='utf-8')
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = asyncio.run(edge.run(page, f"({setup}, 0), {js}", timeout))
    return rc, buf.getvalue().rstrip('\n')


def summary(lines):
    """The English phrases behind the report, with numbers folded, most common first."""
    runs, where = collections.Counter(), {}
    for line in lines:
        p = line.split('\t')
        if len(p) < 4:
            continue
        c, n, w, t = p
        for r in re.findall(r"[A-Za-z][A-Za-z0-9'’&.,:;()/\-+% ]*[A-Za-z0-9)%.]", t):
            r = re.sub(r'\d[\d,.]*', '#', r).strip()
            runs[r] += int(n)
            where.setdefault(r, set()).add(f"{c}:{w.split(',')[0]}")
    return [f"{n:5}  {r}   [{' '.join(sorted(where[r])[:3])}]" for r, n in runs.most_common(80)]


def main():
    ap = argparse.ArgumentParser(description='Translation checks (scan the screens, audit the data names).')
    ap.add_argument('what', choices=['scan', 'audit'])
    ap.add_argument('--lang', default='zh-Hans')
    ap.add_argument('--countries', default='my,uk,us,cn')
    ap.add_argument('--years', type=int, default=10)
    ap.add_argument('--stage', default='adult')
    ap.add_argument('--missed', action='store_true', help='also list Latin-letter text the scan did not report (to check the detector)')
    ap.add_argument('--out')
    a = ap.parse_args()
    if a.what == 'scan':
        cfg = {'lang': a.lang, 'countries': a.countries.split(','), 'years': a.years, 'stage': a.stage, 'missed': a.missed}
        rc, text = run('index.html', f"window.SCAN = {json.dumps(cfg)}", 'i18n-scan.js', 1500)
        lines = [l for l in text.split('\n') if l.count('\t') >= 3 and not l.startswith('missed\t')]
        missed = [l for l in text.split('\n') if l.startswith('missed\t')]
        other = [l for l in text.split('\n') if l.count('\t') < 3 and l.strip()]
        report = other + lines + ['', f'{len(lines)} lines with English left. Most common phrases:'] + summary(lines) + ([f'', f'{len(missed)} texts with Latin letters not reported (names, numbers or a detector gap):'] + missed if a.missed else [])
    else:
        rc, text = run('tests.html', f"window.AUDIT = {json.dumps({'lang': a.lang})}", 'i18n-audit.js', 600)
        report = text.split('\n')
    out = '\n'.join(report) + '\n'
    if a.out:
        pathlib.Path(a.out).write_text(out, encoding='utf-8', errors='replace')
        print(f"Written to {a.out} ({len(report)} lines)")
    else:
        sys.stdout.reconfigure(encoding='utf-8')
        print(out, end='')
    return rc


if __name__ == '__main__':
    sys.exit(main())
