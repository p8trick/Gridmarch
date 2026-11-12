#!/usr/bin/env python3
"""把仓库根目录里的升级包 / 完整包 zip 应用到仓库（GitHub Actions 里跑，也可以本地在仓库根目录跑）。

识别（只看文件名，其他 zip 一律不碰）：
  升级包_*.zip / upgrade*.zip → 升级包：覆盖里面的文件；根目录的 _delete.txt（每行一个路径）列出要删的文件
  Gridmarch_v*.zip            → 完整包：覆盖，并且删掉仓库里"包里没有"的文件（让仓库和包完全一致）
处理完删掉 zip。包里的 升级说明.md、_delete.txt 是控制文件，不进仓库。

安全：拒绝 .. / 绝对路径 / .git；完整包必须带 index.html（防止传错包把仓库清空）；
.github/workflows/ 下的文件不碰（机器人没有权限改工作流文件，要改请手动上传）；本脚本自己永远不删。
"""
import os, re, sys, glob, zipfile, tempfile, posixpath

ROOT = os.getcwd()
CONTROL = {'升级说明.md', '_delete.txt'}
NEVER_TOUCH = ('.github/workflows/',)
NEVER_DELETE = {'tools/apply-package.py'}


def mode_of(name):
    low = name.lower()
    if name.startswith('升级包') or low.startswith('upgrade'): return 'upgrade'
    if low.startswith('gridmarch_v'): return 'full'
    return None


def safe(p):
    if not p or p.startswith('/') or '\\' in p: return False
    parts = p.split('/')
    return all(x not in ('', '.', '..') for x in parts) and parts[0] != '.git'


def entries(z):
    out = []
    for i in z.infolist():
        n = i.filename
        if not (i.flag_bits & 0x800):   # 没有 UTF-8 标记的中文文件名，Python 按 cp437 读出来了，还原
            try: n = n.encode('cp437').decode('utf-8')
            except Exception: pass
        if n.endswith('/') or n.startswith('__MACOSX/') or posixpath.basename(n) == '.DS_Store': continue
        out.append((i, n))
    return out


def prune(path):
    d = os.path.dirname(path)
    while d and os.path.abspath(d) != ROOT and os.path.isdir(d) and not os.listdir(d):
        os.rmdir(d); d = os.path.dirname(d)


def apply(zpath, mode, log):
    z = zipfile.ZipFile(zpath)
    items = entries(z)
    tops = {n.split('/')[0] for _, n in items}
    if items and all('/' in n for _, n in items) and len(tops) == 1 and re.match(r'^[^/]+-(main|master)$', next(iter(tops))):
        pre = next(iter(tops)) + '/'; items = [(i, n[len(pre):]) for i, n in items]   # 去掉 GitHub 下载包的外层文件夹
    files, delete = {}, []
    for i, n in items:
        if n == '_delete.txt': delete = [l.strip() for l in z.read(i).decode('utf-8').splitlines() if l.strip()]; continue
        if n in CONTROL: continue
        if not safe(n): raise SystemExit('拒绝：不安全的路径 %r（%s）' % (n, os.path.basename(zpath)))
        files[n] = i
    if mode == 'full' and 'index.html' not in files:
        raise SystemExit('拒绝：%s 里没有 index.html，不像完整包（防止清空仓库）' % os.path.basename(zpath))
    for p in delete:
        if not safe(p): raise SystemExit('拒绝：_delete.txt 里有不安全的路径 %r' % p)
    added, updated, removed, skipped = [], [], [], []
    for n, i in sorted(files.items()):
        data = z.read(i); dest = os.path.join(ROOT, n)
        if n.startswith(NEVER_TOUCH):
            if not (os.path.isfile(dest) and open(dest, 'rb').read() == data): skipped.append(n)   # 内容一样就不用提醒
            continue
        if os.path.isfile(dest):
            if open(dest, 'rb').read() == data: continue
            updated.append(n)
        else: added.append(n)
        os.makedirs(os.path.dirname(dest) or ROOT, exist_ok=True)
        open(dest, 'wb').write(data)
    if mode == 'upgrade':
        gone = delete
    else:   # 完整包：仓库里有、包里没有的文件都删（根目录其他 zip、工作流、.git、本脚本除外）
        gone = []
        for d, dirs, fs in os.walk(ROOT):
            dirs[:] = [x for x in dirs if x != '.git']
            for f in fs:
                rel = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/')
                if rel in files or rel in NEVER_DELETE or rel.startswith(NEVER_TOUCH) or ('/' not in rel and rel.endswith('.zip')): continue
                gone.append(rel)
    for p in gone:
        if p.startswith(NEVER_TOUCH) or p in NEVER_DELETE: skipped.append(p + '（删除被跳过）'); continue
        dest = os.path.join(ROOT, p)
        if os.path.isfile(dest): os.remove(dest); removed.append(p); prune(dest)
    os.remove(zpath)
    name = os.path.basename(zpath)
    log.append((name, mode, added, updated, removed, skipped))


def main():
    zips = sorted(f for f in glob.glob(os.path.join(ROOT, '*.zip')) if mode_of(os.path.basename(f)))
    log = []
    for f in zips: apply(f, mode_of(os.path.basename(f)), log)
    lines = []
    if not log: lines.append('根目录里没有可识别的升级包 / 完整包，什么也没做。')
    for name, mode, a, u, r, s in log:
        lines.append('应用 %s（%s）：新增 %d，修改 %d，删除 %d' % (name, '完整包' if mode == 'full' else '升级包', len(a), len(u), len(r)))
        for tag, lst in (('新增', a), ('修改', u), ('删除', r), ('跳过', s)):
            for p in lst[:80]: lines.append('  %s %s' % (tag, p))
            if len(lst) > 80: lines.append('  …%s 还有 %d 个' % (tag, len(lst) - 80))
        if s: lines.append('  注意：.github/workflows/ 下的文件机器人没有权限改，请手动上传。')
    text = '\n'.join(lines) + '\n'
    print(text)
    base = os.environ.get('RUNNER_TEMP') or tempfile.gettempdir()
    open(os.path.join(base, 'apply-message.txt'), 'w', encoding='utf-8').write(text)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8').write('```\n' + text + '```\n')


if __name__ == '__main__': main()
