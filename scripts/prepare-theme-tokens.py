"""Preserve existing dark colors; supply light and palette-aware equivalents for every UI stylesheet."""
from pathlib import Path
import colorsys,re
root=Path(__file__).resolve().parents[1]
colors={}
files=[p for p in (root/'src').glob('*.css') if p.name!='theme.css']
pattern=re.compile(r'(?<![\w-])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])')
for file in files:
 text=file.read_text()
 # Existing token fallbacks are not rewritten on subsequent runs.
 def replace(match):
  if text[max(0,match.start()-23):match.start()].endswith(', '):
   pass
  raw=match.group(1).lower()
  if len(raw) in [3,4]: raw=''.join(c*2 for c in raw)
  base=raw[:6];alpha=int(raw[6:8],16)/255 if len(raw)==8 else 1
  rgb=[int(base[i:i+2],16)/255 for i in [0,2,4]]
  h,l,s=colorsys.rgb_to_hls(*rgb)
  if base in ['000000','ffffff'] and alpha<1:return match.group(0)
  colors[base]=(h,l,s)
  var=f'var(--nf-{base}, #{base})'
  return var if alpha==1 else f'color-mix(in srgb, {var} {round(alpha*100,2)}%, transparent)'
 # Tokenize color literals only once. A checked-in generated file is sufficient at runtime.
 if '--nf-' not in text:
  text=pattern.sub(replace,text)
  file.write_text(text)
 else:
  for raw in re.findall(r'--nf-([0-9a-f]{6})',text):
   rgb=[int(raw[i:i+2],16)/255 for i in [0,2,4]];colors[raw]=colorsys.rgb_to_hls(*rgb)
def hexcolor(h,l,s):return '#'+''.join(f'{round(value*255):02x}' for value in colorsys.hls_to_rgb(h,l,s))
light=[];palette=[]
for base,(h,l,s) in sorted(colors.items()):
 if l<.20:new=hexcolor(h,.98-l*.27,min(s,.16))
 elif l<.48:new=hexcolor(h,.94-(l-.2)*.86,min(s,.14))
 else:new=hexcolor(h,max(.13,.32-(l-.48)*.38),min(s,.45))
 if s>.22 and l>.48:
  new='var(--ui-accent)' if .12<h<.86 else '#af3f32'
 light.append(f'--nf-{base}:{new};')
 if .17<h<.48 and s>.13:
  pct= min(95,round(l*125)) if l<.48 else 85
  target='var(--ui-bg)' if l<.3 else 'var(--ui-border)' if l<.48 else 'var(--ui-text)'
  palette.append(f'--nf-{base}:color-mix(in srgb,var(--ui-accent) {pct}%,{target});')
css='''/* Generated semantic bridge. Original dark colors remain the fallbacks in component styles. */
.app-shell { --ui-bg:#0c150f;--ui-surface:#131f17;--ui-raised:#1b2a20;--ui-border:#354b36;--ui-text:#dce9db;--ui-muted:#99ad94;--ui-subtle:#758c70;--ui-danger:#e7a38d;color-scheme:dark; }
:root[data-theme=light],.app-shell[data-theme=light] { --ui-bg:#f6f8f2;--ui-surface:#ffffff;--ui-raised:#edf2e7;--ui-border:#c7d2c0;--ui-text:#1d2b20;--ui-muted:#53664e;--ui-subtle:#667b5f;--ui-danger:#9b3a29;color-scheme:light;
'''+''.join(light)+''' }
.app-shell[data-accent]:not([data-accent=green]) {\n'''+''.join(palette)+''' }
.app-shell[data-theme] { background-color:var(--ui-bg);color:var(--ui-text); }
.app-shell[data-theme] :is(.home-profile-page,.people-page,.account-page,.workspace-grid,.rail,.app-footer,.masthead) { background-color:var(--ui-bg); }
.app-shell[data-theme=light] :is(input,textarea,select) { color:var(--ui-text);color-scheme:light; }
.app-shell[data-theme=light] :is(.account-page,.home-profile-page,.people-page,.chat-list-panel,.conversation-view) { color:var(--ui-text); }
.app-shell[data-theme=light] .session-badge { color:var(--ui-muted); }
.app-shell[data-theme=light] :is(.save-profile,.send-button,.modal-submit,.hub-composer-footer>button) { color:var(--ui-on-accent);background:var(--ui-accent); }
.app-shell[data-theme] button:focus-visible,.app-shell[data-theme] a:focus-visible { outline-color:var(--ui-accent); }
.appearance-preview[data-theme=light] { --ui-surface:#f3f6ee;--ui-text:#1d2b20;--ui-muted:#53664e;--ui-border:#c7d2c0; }
:root[data-theme=light] { background:#f6f8f2;color-scheme:light; }
@media(prefers-reduced-motion:reduce){.app-shell *{scroll-behavior:auto!important}}
'''
(root/'src/theme.css').write_text(css)
print(f'Prepared light-theme and palette tokens for {len(colors)} existing colors across {len(files)} stylesheets.')
