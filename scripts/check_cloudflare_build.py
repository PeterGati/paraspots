#!/usr/bin/env python3
"""Verify the proposed dashboard command in isolated checkouts before saving it."""
from pathlib import Path
import subprocess, tempfile, os, hashlib, sys
ROOT=Path(__file__).resolve().parents[1]
command=(ROOT/(sys.argv[1] if len(sys.argv)>1 else 'docs/cloudflare-build-command.txt')).read_text().strip()
for branch,ref in [('main','fa66fe91575e084a58551af63df6b539a906eb57'),('feat/platform-marketing-demo','HEAD')]:
    with tempfile.TemporaryDirectory(prefix='paraspots-cf-check-') as folder:
        subprocess.run(['git','clone','--quiet','--shared','--no-checkout',str(ROOT),folder],check=True)
        subprocess.run(['git','checkout','--quiet','--detach',ref],cwd=folder,check=True)
        # The archive filename is local to this verification, not a production setting.
        local_command=command.replace('/tmp/paraspots-legacy-build.tar',str(Path(folder)/'legacy-build.tar'))
        subprocess.run(['/bin/sh','-c',local_command],cwd=folder,env={**os.environ,'CF_PAGES_BRANCH':branch},check=True)
        output=Path(folder)/'cf-output'
        if branch=='main':
            paths=subprocess.check_output(['git','-c','core.quotepath=false','ls-tree','-r','--name-only','HEAD'],cwd=folder,text=True).splitlines()
            for p in paths:assert (output/p).read_bytes()==(Path(folder)/p).read_bytes(),p
            assert len(list(p for p in output.rglob('*') if p.is_file()))==len(paths)
            print(f'PASS main: {len(paths)} original files identical in output; no new marketing page.')
        else:
            assert (output/'hu/index.html').exists()
            assert (output/'demo/admin.js').exists()
            assert not (output/'data').exists()
            assert not (output/'startplatz.html').exists()
            print('PASS feature: multilingual marketing + admin demo only; old data/search excluded from artifact.')
