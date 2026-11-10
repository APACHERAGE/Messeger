"""Build the checked-in 100-item catalogue from the pinned MIT Pixelarticons package."""
from pathlib import Path
import json, subprocess, xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
source=root/'node_modules/pixelarticons/svg'
preferred='server terminal code cloud-server database cpu debug bug docker linux github gitlab git-branch git-commit git-merge git-pull-request cloud cloud-moon cloud-sun robot robot-face robot-face-happy robot-face-sad android shield lock unlock wifi globe zap monitor laptop keyboard mouse headphone coffee folder folder-plus file file-text files notebook book-open inbox mailbox box blocks battery battery-full battery-low battery-medium chart chart-bar-big chart-line gamepad fish flag heart moon sun sunglasses tree tree-pine trophy ship building building-community lightbulb radio clock alarm-clock camera image video music bluetooth download upload search settings user users rocket telescope star compass map mountain leaf flower watch pen paperclip link disk save play pause stop repeat shuffle volume'.split()
available={p.stem:p for p in source.glob('*.svg') if not any(p.stem.endswith('-'+style) for style in ['sharp','solid','glyph'])}
names=[]
for name in preferred+sorted(available):
 if name in available and name not in names: names.append(name)
 if len(names)==100: break
assert len(names)==100
catalog=[]
for index,name in enumerate(names):
 svg=ET.parse(available[name]).getroot()
 paths=[item.attrib['d'] for item in svg if item.tag.endswith('path')]
 assert paths and all(item.tag.endswith('path') for item in svg), name
 pixels=subprocess.run(['magick','-background','none',str(available[name]),'-resize','24x24!','-depth','8','rgba:-'],capture_output=True,check=True).stdout
 assert len(pixels)==24*24*4,(name,len(pixels))
 rows=[''.join('#' if pixels[(y*24+x)*4+3]>90 else ' ' for x in range(24)).rstrip() for y in range(24)]
 while rows and not rows[0]: rows.pop(0)
 while rows and not rows[-1]: rows.pop()
 catalog.append({'id':name,'name':name.replace('-',' ').title(),'category':'Dev & Ops' if index<33 else 'Desk & devices' if index<57 else 'Off duty','paths':paths,'ascii':'\n'.join(rows)})
(root/'src/data/pixelArt.json').write_text(json.dumps(catalog,separators=(',',':'))+'\n')
(root/'src/data/PIXELARTICONS-LICENSE.txt').write_text((root/'node_modules/pixelarticons/LICENSE').read_text())
(root/'src/data/pixelArtLicense.json').write_text(json.dumps({'text':(root/'node_modules/pixelarticons/LICENSE').read_text(),'source':'https://github.com/halfmage/pixelarticons','version':json.loads((root/'node_modules/pixelarticons/package.json').read_text())['version']})+'\n')
print(f'Prepared {len(catalog)} MIT-licensed pixel/ASCII artworks.')
