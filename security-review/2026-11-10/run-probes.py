#!/usr/bin/env python3
"""Compile actual backend sources with cached jars; run isolated in-memory probes."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

here = Path(__file__).resolve().parent
project = here.parent.parent
sources = sorted((project / 'backend/src/main/java').rglob('*.java'))
jars = sorted((Path.home() / '.m2/repository').rglob('*.jar'))
classpath = os.pathsep.join(map(str, jars))
manifest = {str(p.relative_to(project)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
for folder in ['src']:
    for p in sorted((project / folder).rglob('*')):
        if p.is_file():
            manifest[str(p.relative_to(project))] = hashlib.sha256(p.read_bytes()).hexdigest()
for name in ['package.json', 'package-lock.json', 'backend/pom.xml', 'backend/src/main/resources/application.properties', 'vite.config.ts']:
    p = project / name
    manifest[name] = hashlib.sha256(p.read_bytes()).hexdigest()
(here / 'source-sha256.json').write_text(json.dumps(manifest, indent=2) + '\n')
with tempfile.TemporaryDirectory(prefix='nightfall-security-probes-') as scratch:
    classes = Path(scratch) / 'classes'
    classes.mkdir()
    subprocess.run([shutil.which('javac'), '--release', '21', '-cp', classpath, '-d', str(classes), *map(str,sources), str(here / 'SecurityProbe.java')], check=True, timeout=90)
    result = subprocess.run([shutil.which('java'), '-cp', str(classes) + os.pathsep + classpath, 'com.nightfall.messenger.auth.SecurityProbe'], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60)
    print(result.stdout, end='')
    (here / 'probe-results.txt').write_text(result.stdout)
    raise SystemExit(result.returncode)
