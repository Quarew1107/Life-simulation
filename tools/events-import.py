"""Import ChatGPT's life moments for Play a Life: the redesign of the 320 moments (with 40 callbacks) and the new
moments (Idea/Event redesign/...).

Usage:  python -E -P tools/events-import.py "<redesign folder>" "<new moments folder>" <events.json> ["<translations folder>"]

The redesign folder has redesign-*.txt and summary.txt; the new moments folder has new-*.txt. events.json is the
game's own list of the original 320 moments (LES.Player.EVENTS dumped from tests.html before this import), used to
map each choice letter to the game's choice id and to check requests, names and situations. Writes:
  js/sim/player-moments-data.js        effects of every choice, the callbacks and the new moments (data;
                                       js/sim/player-moments.js applies them)
  js/i18n/<lang>-moments.js            titles, situations, labels and results, and the words for what changed
                                       (en, zh-Hans, ja, ko, es; loaded after each language's own file)
and prints every problem it finds; nothing is written if there is one.
"""
import json, re, sys, os

red, new, evjson = sys.argv[1], sys.argv[2], sys.argv[3]
trans = sys.argv[4] if len(sys.argv) > 4 else None  # optional: a folder with moments-<lang>.txt (key TAB text) for ja, ko, es
raw = open(evjson, encoding='utf-8').read()
EV = {e['id']: e for e in json.loads(raw[raw.index('{'):raw.rindex('}') + 1])['ev']}
LANGS = ['en', 'zh-Hans', 'ja', 'ko', 'es']
TR = {'ZH': 'zh-Hans', 'JA': 'ja', 'KO': 'ko', 'ES': 'es'}
problems = []

def blocks(path):
    text = open(path, encoding='utf-8').read().replace('\r\n', '\n')
    for b in re.split(r'\n\s*\n(?=ID: )', text.strip()):
        if b.startswith('ID: '): yield b

ABIL = {'intelligence': 'INT', 'charisma': 'CHA', 'agility': 'AGI', 'strength': 'STR', 'perception': 'PER'}
TRAITS = {'kind', 'brave', 'studious', 'sociable', 'careful', 'ambitious'}
MOOD = {'happiness': 'happy', 'stress': 'stress', 'energy': 'energy'}

def effects(text, names, where):
    e = {}
    for tok in [t.strip() for t in text.split(';') if t.strip()]:
        m = re.fullmatch(r'MOOD (happiness|stress|energy) ([+-]\d+)', tok)
        if m:
            k = MOOD[m.group(1)]; v = int(m.group(2))
            if abs(v) > (10 if k == 'energy' else 6): problems.append(f'{where}: {tok} too big')
            e[k] = e.get(k, 0) + v; continue
        m = re.fullmatch(r'THEIR MOOD \{(\w+)\} (happiness|stress) ([+-]\d+)', tok)
        if m:
            if m.group(1) not in names: problems.append(f'{where}: THEIR MOOD {{{m.group(1)}}} not an available name')
            e.setdefault('their', []).append([m.group(1), MOOD[m.group(2)], int(m.group(3))]); continue
        m = re.fullmatch(r'GROW (\w+)', tok)
        if m and m.group(1) in ABIL: e['grow'] = ABIL[m.group(1)]; continue
        m = re.fullmatch(r'TRAIT (\w+) \+1', tok)
        if m and m.group(1) in TRAITS: e.setdefault('trait', []).append(m.group(1)); continue
        m = re.fullmatch(r'BOND \{(\w+)\} ([+-]\d+)', tok)
        if m:
            if m.group(1) not in names: problems.append(f'{where}: BOND {{{m.group(1)}}} not an available name')
            e.setdefault('bond', []).append([m.group(1), int(m.group(2))]); continue
        m = re.fullmatch(r'REPUTATION ([+-]\d+)', tok)
        if m: e['rep'] = int(m.group(1)); continue
        m = re.fullmatch(r'SUSPICION ([+-]\d+)', tok)
        if m: e['susp'] = int(m.group(1)); continue
        m = re.fullmatch(r'MEMORY (\w+)', tok)
        if m: e['mem'] = m.group(1); continue
        m = re.fullmatch(r'TIME (\d+(?:\.\d+)?)', tok)
        if m: e['time'] = float(m.group(1)); continue
        m = re.fullmatch(r'COST (\d*\.?\d+) pay', tok)
        if m: e['cost'] = float(m.group(1)); continue
        if re.fullmatch(r'REQUEST \w+', tok): e['req'] = tok.split()[1]; continue
        problems.append(f'{where}: unknown effect "{tok}"')
    return e

def parse(b):
    L, ch = {}, []
    for line in b.split('\n'):
        m = re.match(r'^([A-D])\. Label: (.*?) \| Result: (.*?) \| Effects: (.*)$', line)
        if m: ch.append(m.groups()); continue
        m = re.match(r'^(\w[\w ]*?): (.*)$', line)
        if m: L[m.group(1)] = m.group(2)
    return L, ch

texts = {l: {} for l in LANGS}
def add_texts(eid, L, ch, ids, names, langs):
    en = [L['Title'], L['Situation']] + [x for c in ch for x in (c[1], c[2])]
    keys = [f'ev.{eid}.title', f'ev.{eid}.body'] + [k for cid in ids for k in (f'ev.{eid}.{cid}', f'ev.{eid}.{cid}.res')]
    for k, t in zip(keys, en):
        ph = set(re.findall(r'\{(\w+)\}', t))
        if not ph <= names: problems.append(f'{k}: uses {ph - names} not available')
        texts['en'][k] = t
    for tag in langs:
        parts = [x.strip() for x in L.get(tag, '').split(' / ')]
        if len(parts) != len(keys): problems.append(f'{eid}: {tag} has {len(parts)} parts, wanted {len(keys)}'); continue
        for k, t, z in zip(keys, en, parts):
            if set(re.findall(r'\{(\w+)\}', t)) != set(re.findall(r'\{(\w+)\}', z)): problems.append(f'{k}: {tag} placeholders differ')
            texts[TR[tag]][k] = z

# ---- 1. The redesign of the 320 moments and its 40 callbacks ----
moments, callbacks = {}, []
summary = open(os.path.join(red, 'summary.txt'), encoding='utf-8').read()
TRIG = {m.group(1): m.group(2) for m in re.finditer(r'^(\w+): SET \w{2}-\d+\.[A-D]; USED \w{2}-\d+; ages [^;]*; current trigger (\w{2}-\d+)', summary, re.M)}
for f in ['redesign-baby.txt', 'redesign-child.txt', 'redesign-teen.txt', 'redesign-adult.txt', 'redesign-senior.txt', 'redesign-callbacks.txt']:
    for b in blocks(os.path.join(red, f)):
        L, ch = parse(b)
        eid = L['ID']; names = set(re.findall(r'\{(\w+)\}', L.get('Names available', '')))
        if 'NEEDS MEMORY' in L.get('When', ''):
            mem = re.search(r'NEEDS MEMORY (\w+)', L['When']).group(1); trig = TRIG.get(mem)
            if not trig or trig not in EV: problems.append(f'{eid}: no trigger moment for memory {mem}'); continue
            ids = ['a', 'b', 'c', 'd'][:len(ch)]
            ages = re.match(r'(\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)', L['Ages'])
            callbacks.append({'id': eid, 'from': trig, 'mem': mem, 'minAge': float(ages.group(1)), 'maxAge': float(ages.group(2)), 'fx': [effects(c[3], names, f'{eid}.{c[0]}') for c in ch]})
        else:
            if eid not in EV: problems.append(f'{eid}: not in the game'); continue
            ids = [c['id'] for c in EV[eid]['choices']]
            if len(ids) != len(ch): problems.append(f'{eid}: {len(ch)} choices, the game has {len(ids)}'); continue
            fx = [effects(c[3], names, f'{eid}.{c[0]}') for c in ch]
            for c, e in zip(EV[eid]['choices'], fx):
                if (c.get('cmd') or None) != (e.get('req') or None): problems.append(f'{eid}.{c["id"]}: request {e.get("req")} but the game has {c.get("cmd")}')
            moments[eid] = fx
        add_texts(eid, L, ch, ids, names, ['ZH'])
missing = sorted(set(EV) - set(moments))
if missing: problems.append(f'moments missing from the redesign: {missing}')

# ---- 2. The new moments ----
# A request in a new moment uses the same target as that request in the moment whose situation it borrows,
# else the usual one for that request.
DEFAULT_TARGET = {'AFFAIR': 'personInCard', 'END_AFFAIR': 'endAffair', 'CONFESS': 'confess', 'COUNSEL': 'partnerInCard', 'SEPARATE': 'partnerInCard', 'ASK_CARE': 'care',
                  'CARE_CHILD': 'personInCard', 'COUNSELLING': 'counselling', 'DONATE': 'donateSmall', 'ENROLL': 'bestCourse', 'GIFT': 'personGift', 'MAKE_FRIEND': 'friendInCard',
                  'VISIT': 'personVisit', 'VOLUNTEER': 'volunteer', 'WELCOME': 'newcomerInCard', 'APPLY_JOB': 'typicalPay',
                  # home buying (Nov 2026, js/sim/player-home.js)
                  'BUY_HOME': 'homeBuy', 'BUY_SMALLER': 'homeSmaller', 'SELL_HOME': 'homeSell', 'PAY_EXTRA': 'homeExtra', 'ASK_DEPOSIT': 'homeDeposit',
                  'BUY_LET': 'homeLet', 'SELL_LET': 'homeSellLet', 'MOVE_HOME': 'homeMoveDown', 'DATE_NIGHT': 'dateNight'}
AFFAIR_WHEN = {'affairChance': ('affairChance', {'other', 'partner'}), 'affairOn': ('affair', {'lover', 'partner'}), 'affairLong': ('affair', {'lover', 'partner'}),
               'affairSuspect': ('affair', {'lover', 'partner'}), 'affairFound': ('affair', {'lover', 'partner'}), 'affairOver': ('affair', {'lover', 'partner'})}
# Home moments (new-home.txt, IDs HM-xxx): the situations of js/sim/player-home.js and the names each offers.
HOME_WHEN = {'homeRenting': {'partner'}, 'homeNearDeposit': {'partner'}, 'homeParentsCould': {'parent', 'partner'}, 'homeNewOwner': {'partner'}, 'homeOwner': {'partner', 'neighbour'},
             'homeBehind': {'partner'}, 'homeRateUp': {'partner'}, 'homeBoom': {'partner'}, 'homeSlump': {'partner'}, 'homeLandlord': {'tenant'}, 'homeTenant': {'landlord'},
             'homeInherited': {'late', 'partner'}, 'homeOwnerSenior': {'child', 'partner'}}
PH = {}  # names each original moment offers: from its texts
for k, v in texts['en'].items():
    m = re.match(r'ev\.(\w{2}-\d+)\.', k)
    if m and m.group(1) in EV: PH.setdefault(m.group(1), set()).update(re.findall(r'\{(\w+)\}', v))
STAGE = {'BA': 'baby', 'CH': 'child', 'TE': 'teen', 'AD': 'adult', 'SE': 'senior', 'AF': 'adult'}
fresh, mems_new_set, mems_new_used = [], set(), set()
for f in ['new-baby.txt', 'new-child.txt', 'new-teen.txt', 'new-adult.txt', 'new-senior.txt', 'new-affair.txt', 'new-home.txt']:
    if not os.path.exists(os.path.join(new, f)) and f == 'new-home.txt': continue  # (the home moments come later)
    for b in blocks(os.path.join(new, f)):
        L, ch = parse(b)
        eid = L['ID']; when = L.get('When', '')
        if eid in EV or eid in moments: problems.append(f'{eid}: the ID is already used'); continue
        needs = (re.search(r'NEEDS MEMORY (\w+)', when) or [None, None])[1]
        m = re.match(r'same as (\w{2}-\d+)', when)
        if m:
            src = m.group(1)
            if src not in EV: problems.append(f'{eid}: borrows {src}, which is not in the game'); continue
            entry = {'from': src}; names = set(PH.get(src, set()))
            src_cmds = {c.get('cmd'): c.get('target') for c in EV[src]['choices'] if c.get('cmd')}
        elif when.split(';')[0].strip() in AFFAIR_WHEN:
            w0 = when.split(';')[0].strip(); entry = {'when': w0, 'params': AFFAIR_WHEN[w0][0]}; names = AFFAIR_WHEN[w0][1]; src_cmds = {}
        elif when.split(';')[0].strip() in HOME_WHEN:
            w0 = when.split(';')[0].strip(); entry = {'when': w0, 'params': w0}; names = HOME_WHEN[w0]; src_cmds = {}
        else: problems.append(f'{eid}: unknown When "{when}"'); continue
        ages = re.match(r'(\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)', L['Ages'])
        fx = [effects(c[3], names, f'{eid}.{c[0]}') for c in ch]
        targets = []
        for e in fx:
            r = e.get('req')
            if r and r not in src_cmds and r not in DEFAULT_TARGET: problems.append(f'{eid}: no target for request {r}')
            targets.append(src_cmds.get(r) or DEFAULT_TARGET.get(r) if r else None)
        for e in fx:
            if 'mem' in e: mems_new_set.add(e['mem'])
        if needs: mems_new_used.add(needs)
        stage = STAGE.get(eid[:2]) or ('senior' if float(ages.group(1)) >= 65 else 'adult')  # HM: by age
        entry.update({'id': eid, 'stage': stage, 'minAge': float(ages.group(1)), 'maxAge': float(ages.group(2)), 'mature': L.get('Mature', '').lower() == 'yes', 'needs': needs, 'fx': fx, 'targets': targets})
        fresh.append(entry)
        add_texts(eid, L, ch, ['a', 'b', 'c', 'd'][:len(ch)], names, ['ZH', 'JA', 'KO', 'ES'])

# ---- 3. Translations of the redesign for the other languages (key TAB text, same keys as moments-en.txt) ----
if trans:
    for l in ('ja', 'ko', 'es'):
        f = os.path.join(trans, f'moments-{l}.txt')
        if not os.path.exists(f): continue
        for line in open(f, encoding='utf-8-sig'):
            line = line.rstrip(chr(13) + chr(10))
            if chr(9) not in line: continue
            k, t = line.split(chr(9), 1)
            if k not in texts['en'] or k in texts[l]: continue  # the new moments already have their own translations
            if set(re.findall(r'\{(\w+)\}', t)) != set(re.findall(r'\{(\w+)\}', texts['en'][k])): problems.append(f'{l} {k}: placeholders differ'); continue
            texts[l][k] = t

mems_set = {e['mem'] for fx in list(moments.values()) + [c['fx'] for c in callbacks] for e in fx if 'mem' in e} | mems_new_set
mems_used = {c['mem'] for c in callbacks} | mems_new_used
if mems_used - mems_set: problems.append(f'memories used but never set: {mems_used - mems_set}')
print(f'{len(moments)} moments, {len(callbacks)} callbacks, {len(fresh)} new moments, {len(texts["en"])} English texts, {len(problems)} problems')
for p in problems[:60]: print('  -', p)
if problems: sys.exit(1)

# ---- The words for what changed (journal, pop-up and profile), in every language ----
FXW = {
 'en': {'evt.choseRes': '{result}{fx}', 'fx.list0': '', 'fx.happy': 'happiness {n}', 'fx.stress': 'stress {n}', 'fx.energy': 'energy {n}', 'fx.rep': 'reputation {n}', 'fx.susp': 'suspicion {n}',
        'fx.their.happy': '{name} happiness {n}', 'fx.their.stress': '{name} stress {n}', 'fx.grow': '{ability} grows', 'fx.trait': '{trait} +1', 'fx.traitUp': '{trait} levels up!', 'fx.bond': 'closeness with {name} {n}', 'fx.time': '{count} h', 'fx.cost': 'spent {amt}',
        'fx.ab.INT': 'intelligence', 'fx.ab.CHA': 'charisma', 'fx.ab.AGI': 'agility', 'fx.ab.STR': 'strength', 'fx.ab.PER': 'perception',
        'trait.kind': 'Kind', 'trait.brave': 'Brave', 'trait.studious': 'Studious', 'trait.sociable': 'Sociable', 'trait.careful': 'Careful', 'trait.ambitious': 'Ambitious',
        'life.noTraits': 'Your choices will shape your character.', 'life.traitPts': '{count} choices so far', 'life.rep': 'Standing in town {n}', 'life.closest': 'closest: {names}', 'life.susp': 'suspicion {n}',
        'act.CONFESS': 'Tell {other} about the affair', 'cmd.CONFESS.stayed': 'You told {other} about the affair. They stayed, but trust will take time.', 'cmd.CONFESS.left': 'You told {other} about the affair, and they left you.',
        'cmd.CONFESS.no_affair': 'There is nothing to confess.', 'cmd.CONFESS.no_partner': 'You have no partner.', 'cmd.CONFESS.mature_off': 'Mature stories are switched off.'},
 'zh-Hans': {'evt.choseRes': '{result}{fx}', 'fx.list0': '', 'fx.happy': '幸福感 {n}', 'fx.stress': '压力 {n}', 'fx.energy': '精力 {n}', 'fx.rep': '声望 {n}', 'fx.susp': '怀疑 {n}',
        'fx.their.happy': '{name}的幸福感 {n}', 'fx.their.stress': '{name}的压力 {n}', 'fx.grow': '{ability}提升', 'fx.trait': '{trait} +1', 'fx.traitUp': '{trait}升级！', 'fx.bond': '与{name}的亲密度 {n}', 'fx.time': '{count} 小时', 'fx.cost': '花费 {amt}',
        'fx.ab.INT': '智力', 'fx.ab.CHA': '魅力', 'fx.ab.AGI': '敏捷', 'fx.ab.STR': '力量', 'fx.ab.PER': '观察力',
        'trait.kind': '善良', 'trait.brave': '勇敢', 'trait.studious': '好学', 'trait.sociable': '合群', 'trait.careful': '谨慎', 'trait.ambitious': '进取',
        'life.noTraits': '你的选择将塑造你的性格。', 'life.traitPts': '至今 {count} 次选择', 'life.rep': '在镇上的声望 {n}', 'life.closest': '最亲近：{names}', 'life.susp': '怀疑 {n}',
        'act.CONFESS': '向{other}坦白婚外情', 'cmd.CONFESS.stayed': '你向{other}坦白了婚外情。对方留了下来，但信任需要时间重建。', 'cmd.CONFESS.left': '你向{other}坦白了婚外情，对方离开了你。',
        'cmd.CONFESS.no_affair': '没有需要坦白的事。', 'cmd.CONFESS.no_partner': '你没有伴侣。', 'cmd.CONFESS.mature_off': '成人内容已关闭。'},
 'ja': {'evt.choseRes': '{result}{fx}', 'fx.list0': '', 'fx.happy': '幸福度 {n}', 'fx.stress': 'ストレス {n}', 'fx.energy': '元気 {n}', 'fx.rep': '評判 {n}', 'fx.susp': '疑い {n}',
        'fx.their.happy': '{name}の幸福度 {n}', 'fx.their.stress': '{name}のストレス {n}', 'fx.grow': '{ability}が伸びた', 'fx.trait': '{trait} +1', 'fx.traitUp': '{trait}がレベルアップ！', 'fx.bond': '{name}との親しさ {n}', 'fx.time': '{count}時間', 'fx.cost': '{amt}を使った',
        'fx.ab.INT': '知力', 'fx.ab.CHA': '魅力', 'fx.ab.AGI': '敏捷さ', 'fx.ab.STR': '体力', 'fx.ab.PER': '観察力',
        'trait.kind': '優しい', 'trait.brave': '勇敢', 'trait.studious': '勉強熱心', 'trait.sociable': '社交的', 'trait.careful': '慎重', 'trait.ambitious': '野心的',
        'life.noTraits': '選択が性格を形作ります。', 'life.traitPts': 'これまで{count}回の選択', 'life.rep': '町での評判 {n}', 'life.closest': '親しい人：{names}', 'life.susp': '疑い {n}',
        'act.CONFESS': '{other}に浮気を打ち明ける', 'cmd.CONFESS.stayed': '{other}に浮気を打ち明けた。相手は残ったが、信頼の回復には時間がかかる。', 'cmd.CONFESS.left': '{other}に浮気を打ち明け、相手は去っていった。',
        'cmd.CONFESS.no_affair': '打ち明けることはありません。', 'cmd.CONFESS.no_partner': 'パートナーがいません。', 'cmd.CONFESS.mature_off': '大人向けのストーリーは無効になっています。'},
 'ko': {'evt.choseRes': '{result}{fx}', 'fx.list0': '', 'fx.happy': '행복 {n}', 'fx.stress': '스트레스 {n}', 'fx.energy': '기운 {n}', 'fx.rep': '평판 {n}', 'fx.susp': '의심 {n}',
        'fx.their.happy': '{name}의 행복 {n}', 'fx.their.stress': '{name}의 스트레스 {n}', 'fx.grow': '{ability} 성장', 'fx.trait': '{trait} +1', 'fx.traitUp': '{trait} 레벨 업!', 'fx.bond': '{name}와의 친밀도 {n}', 'fx.time': '{count}시간', 'fx.cost': '{amt} 지출',
        'fx.ab.INT': '지능', 'fx.ab.CHA': '매력', 'fx.ab.AGI': '민첩', 'fx.ab.STR': '힘', 'fx.ab.PER': '관찰력',
        'trait.kind': '다정함', 'trait.brave': '용감함', 'trait.studious': '성실함', 'trait.sociable': '사교적', 'trait.careful': '신중함', 'trait.ambitious': '야심',
        'life.noTraits': '선택이 성격을 만들어 갑니다.', 'life.traitPts': '지금까지 {count}번의 선택', 'life.rep': '마을 평판 {n}', 'life.closest': '가까운 사람: {names}', 'life.susp': '의심 {n}',
        'act.CONFESS': '{other}에게 외도를 털어놓기', 'cmd.CONFESS.stayed': '{other}에게 외도를 털어놓았다. 상대는 남았지만 신뢰를 되찾는 데는 시간이 걸린다.', 'cmd.CONFESS.left': '{other}에게 외도를 털어놓았고, 상대는 떠났다.',
        'cmd.CONFESS.no_affair': '털어놓을 일이 없습니다.', 'cmd.CONFESS.no_partner': '파트너가 없습니다.', 'cmd.CONFESS.mature_off': '성인용 이야기가 꺼져 있습니다.'},
 'es': {'evt.choseRes': '{result}{fx}', 'fx.list0': '', 'fx.happy': 'felicidad {n}', 'fx.stress': 'estrés {n}', 'fx.energy': 'energía {n}', 'fx.rep': 'reputación {n}', 'fx.susp': 'sospecha {n}',
        'fx.their.happy': 'felicidad de {name} {n}', 'fx.their.stress': 'estrés de {name} {n}', 'fx.grow': 'crece tu {ability}', 'fx.trait': '{trait} +1', 'fx.traitUp': '¡{trait} sube de nivel!', 'fx.bond': 'cercanía con {name} {n}', 'fx.time': '{count} h', 'fx.cost': 'gastaste {amt}',
        'fx.ab.INT': 'inteligencia', 'fx.ab.CHA': 'carisma', 'fx.ab.AGI': 'agilidad', 'fx.ab.STR': 'fuerza', 'fx.ab.PER': 'percepción',
        'trait.kind': 'Amable', 'trait.brave': 'Valiente', 'trait.studious': 'Estudioso', 'trait.sociable': 'Sociable', 'trait.careful': 'Prudente', 'trait.ambitious': 'Ambicioso',
        'life.noTraits': 'Tus decisiones irán formando tu carácter.', 'life.traitPts': '{count} decisiones hasta ahora', 'life.rep': 'Reputación en el pueblo {n}', 'life.closest': 'más cercanos: {names}', 'life.susp': 'sospecha {n}',
        'act.CONFESS': 'Contarle a {other} la aventura', 'cmd.CONFESS.stayed': 'Le contaste a {other} la aventura. Se quedó, pero recuperar la confianza llevará tiempo.', 'cmd.CONFESS.left': 'Le contaste a {other} la aventura y te dejó.',
        'cmd.CONFESS.no_affair': 'No hay nada que confesar.', 'cmd.CONFESS.no_partner': 'No tienes pareja.', 'cmd.CONFESS.mature_off': 'Las historias para adultos están desactivadas.'},
}
SEP = {'en': (' (', ', ', ')'), 'zh-Hans': ('（', '，', '）'), 'ja': ('（', '、', '）'), 'ko': (' (', ', ', ')'), 'es': (' (', ', ', ')')}
for l, (o, s_, c) in SEP.items():
    for n in range(1, 9): FXW[l][f'fx.list{n}'] = o + s_.join('{' + 'abcdefgh'[i] + '}' for i in range(n)) + c

def js(o): return json.dumps(o, ensure_ascii=False, separators=(',', ':'))
HEAD = '// Made by tools/events-import.py from ChatGPT\'s life moments (Nov 2026). Do not edit by hand.\n'
open('js/sim/player-moments-data.js', 'w', encoding='utf-8', newline='\n').write(
    HEAD + '(function (LES) {\n  const Pl = LES.Player;\n'
    f'  Pl.MOMENT_FX = {js(moments)};\n  Pl.CALLBACKS = {js(callbacks)};\n  Pl.NEW_MOMENTS = {js(fresh)};\n'
    '})(globalThis.LES = globalThis.LES || {});\n')
for l in LANGS:
    d = dict(texts[l]); d.update(FXW[l])
    body = ',\n'.join(f'  {js(k)}: {js(v)}' for k, v in d.items())
    open(f'js/i18n/{l}-moments.js', 'w', encoding='utf-8', newline='\n').write(HEAD + f"LES.I18n.add('{l}', {{\n{body},\n}});\n")
print('written:', {l: len(texts[l]) for l in LANGS})
