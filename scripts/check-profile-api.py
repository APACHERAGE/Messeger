import json, os, pathlib, re, subprocess, tempfile, time, urllib.request, urllib.error, http.cookiejar, shutil, argparse
root = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='Run account/profile API checks against an isolated in-memory test server. Compile backend first.')
parser.add_argument('--java', default=str(pathlib.Path(os.environ['JAVA_HOME'])/'bin/java') if os.environ.get('JAVA_HOME') else shutil.which('java'))
parser.add_argument('--legacy-channels', action='store_true', help='Also verify schema migration from channels created before discussion/owner tools.')
args = parser.parse_args()
java = args.java
if not java: raise SystemExit('Java is required. Set JAVA_HOME or pass --java.')
jars = [str(p) for p in (pathlib.Path.home()/'.m2/repository').rglob('*.jar') if not any(part in str(p) for part in ['/org/apache/maven/', '/org/codehaus/', '/org/sonatype/', '/slf4j-api/1.'])]
base = ''
test_dir = tempfile.TemporaryDirectory(prefix='nightfall-profile-qa-')
log_path = pathlib.Path(test_dir.name)/'api.log'
log = log_path.open('w')
command = [java, '-Xmx512m', '-Dnet.bytebuddy.experimental=true', '-cp', os.pathsep.join([str(root/'backend/target/classes'), *jars]), 'com.nightfall.messenger.MessengerApplication', '--server.port=0', '--spring.datasource.url=jdbc:h2:mem:profile_settings_qa;DB_CLOSE_DELAY=-1', '--spring.jpa.hibernate.ddl-auto=create-drop', '--app.mail.mode=console']
if args.legacy_channels:
    database='jdbc:h2:file:'+str(pathlib.Path(test_dir.name)/'legacy-channels')
    sql="""create table channels (id varchar(36) primary key,title varchar(72) not null,handle varchar(48) not null,description varchar(240) not null,owner_id varchar(36) not null,created_at timestamp with time zone not null);
    create table channel_posts (id varchar(36) primary key,channel_id varchar(36) not null,author_id varchar(36) not null,body varchar(2000) not null,link varchar(2048),attachment_name varchar(255),attachment_type varchar(120),attachment_data clob,created_at timestamp with time zone not null);
    insert into channels values ('legacy-channel','Legacy channel','legacy-qa','Before owner tools','legacy-owner',current_timestamp);
    insert into channel_posts (id,channel_id,author_id,body,created_at) values ('legacy-post','legacy-channel','legacy-owner','A historical post',current_timestamp);"""
    subprocess.run([java,'-cp',os.pathsep.join(jars),'org.h2.tools.Shell','-url',database,'-user','sa','-password','','-sql',sql],check=True,stdout=log,stderr=subprocess.STDOUT,cwd=test_dir.name)
    command=[part if not part.startswith('--spring.datasource.url=') else '--spring.datasource.url='+database for part in command]
    command=[part if not part.startswith('--spring.jpa.hibernate.ddl-auto=') else '--spring.jpa.hibernate.ddl-auto=update' for part in command]
    command+=['--spring.datasource.username=sa','--spring.datasource.password=']
process = subprocess.Popen(command, cwd=test_dir.name, stdout=log, stderr=subprocess.STDOUT)
def client():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def req(opener, path, body=None, method=None):
    headers = {'Content-Type':'application/json'}
    if body is not None or method in ('DELETE', 'PUT', 'PATCH'):
        csrf = req(opener, '/api/auth/csrf')
        headers[csrf['headerName']] = csrf['token']
    request = urllib.request.Request(base+path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method or ('GET' if body is None else 'POST'))
    with opener.open(request, timeout=4) as r:
        content = r.read()
        return json.loads(content) if content else None
try:
    for _ in range(50):
        if process.poll() is not None: raise RuntimeError('Test API exited early: '+log_path.read_text()[-5000:])
        matches = re.findall(r'Tomcat started on port (\d+)', log_path.read_text())
        if matches: base = 'http://127.0.0.1:' + matches[-1]
        try:
            if not base: time.sleep(.5); continue
            req(client(), '/api/health'); break
        except (urllib.error.URLError, TimeoutError): time.sleep(.5)
    else: raise RuntimeError('Test API did not become healthy: '+log_path.read_text()[-4000:])
    def account(username):
        opener = client()
        req(opener, '/api/auth/register', {'username': username,'firstName':'SecretFirst','lastName':'SecretLast','email': username+'@example.test','password':'OnlyForLocalQA123!','confirmPassword':'OnlyForLocalQA123!'})
        for _ in range(20):
            text = log_path.read_text()
            matches = re.findall(r'verification link for '+username+r'@example.test: .*?verify=([a-zA-Z0-9_-]+)', text)
            if matches: break
            time.sleep(.1)
        assert matches, 'No console verification token'
        req(opener, '/api/auth/verify', {'token': matches[-1], 'password':'OnlyForLocalQA123!'})
        req(opener, '/api/auth/login', {'identifier':username,'password':'OnlyForLocalQA123!'})
        return opener
    alice, bob, charlie = account('qa_alice'), account('qa_bob'), account('qa_charlie')
    if args.legacy_channels:
        legacy=req(alice,'/api/channels/legacy-channel')
        assert legacy['channel']['commentsEnabled'] is True
        assert legacy['posts'][0]['commentsEnabled'] is True and legacy['posts'][0]['pinned'] is False
        assert legacy['posts'][0]['commentCount']==0 and legacy['posts'][0]['body']=='A historical post'
        print('Legacy channel database migration passed: historical posts retained, comments enabled, pin/count defaults restored.')
    profile = req(alice, '/api/profile')
    profile.update(displayName='PublicAlias', firstName='HiddenFirst', lastName='HiddenLast', bio='HiddenBiography', location='HiddenLocation', website='https://hidden.example.test', skills='HiddenSkills', headline='HiddenHeadline', status='HiddenStatus', githubProjects=[{'name':'HiddenRepo','url':'https://github.com/example/hidden','description':'Hidden project'}])
    profile['visibility'] = {key:False for key in ['avatar','firstName','lastName','headline','bio','skills','location','website','githubProjects','status','pronouns','company','timezone','interests','lookingFor','githubUsername']}
    profile.update(pronouns='they/them',company='HiddenCompany',timezone='Europe/Berlin',interests='HiddenInterests',lookingFor='HiddenCollaboration',githubUsername='hidden-dev')
    profile['avatarDataUrl'] = 'data:image/png;base64,iVBORw0KGgo='
    profile['preferences'].update(accent='blue', fontSize='large', mentionsOnly=True, quietHours=True, quietStart='23:00', quietEnd='07:00')
    saved = req(alice, '/api/profile', profile, 'PUT')
    restored = req(alice, '/api/profile')
    assert restored['visibility']['bio'] is False and restored['preferences']['accent']=='blue'
    assert restored['preferences']['quietStart']=='23:00'
    assert restored['bio']=='HiddenBiography', 'Hiding must not delete private data'
    people = req(bob, '/api/people?query=qa_alice')
    assert len(people)==1
    person=people[0]
    for key in ['headline','skills','firstName','lastName','bio','location','website','status','avatarDataUrl','pronouns','company','timezone','interests','lookingFor','githubUsername']:
        assert person[key]=='', (key,person[key])
    assert person['githubProjects']==[]
    assert person['displayName']=='PublicAlias'
    assert len(req(bob, '/api/people?query=PublicAlias')) == 1, 'Public display name must be searchable'
    assert req(bob, '/api/people?query=HiddenFirst')==[], 'Hidden legal name must not be searchable'
    profile['visibility']={key:True for key in profile['visibility']}
    req(alice, '/api/profile', profile, 'PUT')
    person=req(bob, '/api/people?query=qa_alice')[0]
    assert person['bio']=='HiddenBiography' and person['skills']=='HiddenSkills' and len(person['githubProjects'])==1
    assert req(bob, '/api/profile')['username']=='qa_bob', 'Profiles must be account scoped'
    invalid=json.loads(json.dumps(profile)); invalid['preferences']['quietStart']='25:99'
    try: req(alice, '/api/profile', invalid, 'PUT'); raise AssertionError('Invalid time accepted')
    except urllib.error.HTTPError as e: assert e.code==400, e.code
    invalid=json.loads(json.dumps(profile)); invalid['preferences']['accent']='unexpected'
    try: req(alice, '/api/profile', invalid, 'PUT'); raise AssertionError('Invalid accent accepted')
    except urllib.error.HTTPError as e: assert e.code==400, e.code
    # Friend-feed media uses the same visibility policy as the parent post.
    import base64
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
    gif = base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
    video = (root/'scripts/fixtures/post-sample.mp4').read_bytes()
    def multipart(opener, body, files, **fields):
        boundary = 'NightfallMediaTestBoundary9'
        chunks = [f'--{boundary}\r\nContent-Disposition: form-data; name="body"\r\n\r\n{body}\r\n'.encode()]
        for key,value in fields.items(): chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
        for name, kind, data in files:
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="{name}"\r\nContent-Type: {kind}\r\n\r\n'.encode() + data + b'\r\n')
        chunks.append(f'--{boundary}--\r\n'.encode())
        csrf = req(opener, '/api/auth/csrf')
        request = urllib.request.Request(base+'/api/hub/posts', data=b''.join(chunks), headers={'Content-Type': 'multipart/form-data; boundary='+boundary, csrf['headerName']:csrf['token']}, method='POST')
        with opener.open(request, timeout=6) as response: return json.loads(response.read())
    post = multipart(alice, 'A post for friends', [('photo.png','image/png',png), ('moment.gif','image/gif',gif), ('clip.mp4','video/mp4',video)])
    assert len(post['attachments'])==3 and post['body']=='A post for friends'
    assert [item['type'] for item in post['attachments']]==['image/png','image/gif','video/mp4']
    assert all('data' not in item for item in post['attachments']), 'Feed responses must contain metadata, not file bytes'
    post_id=post['id']
    video_path='/api/hub/posts/'+post_id+'/media/'+post['attachments'][2]['id']
    with alice.open(base+video_path, timeout=4) as response:
        assert response.read()==video
        assert response.headers['Content-Type']=='video/mp4'
        assert response.headers['Cache-Control']=='no-store'
        assert response.headers['X-Content-Type-Options']=='nosniff'
    try: bob.open(base+video_path); raise AssertionError('Non-follower read a media attachment')
    except urllib.error.HTTPError as e: assert e.code==404, e.code
    alice_id=req(alice, '/api/auth/session')['user']['id']
    bob_id=req(bob, '/api/auth/session')['user']['id']
    profile['profileAudience']='friends'; profile['messageAudience']='friends'
    req(alice,'/api/profile',profile,'PUT')
    req(bob, '/api/contacts/'+alice_id, {})
    req(alice, '/api/contacts/'+bob_id, {})
    def expect_error(code, action, label):
        try: action(); raise AssertionError(label)
        except urllib.error.HTTPError as error: assert error.code==code, (label,error.code)
    card=req(bob,'/api/people/'+alice_id)
    assert card['canViewProfile'] is False and card['canMessage'] is False and card['canViewWall'] is False
    assert card['bio']=='' and card['skills']=='' and card['githubProjects']==[], 'Private profile details leaked to a contact'
    assert not any(item['id']==post_id for item in req(bob,'/api/hub/posts')), 'Contacts must not grant wall access'
    expect_error(404, lambda: req(bob,'/api/hub/posts?authorId='+alice_id),'Contact read the owner wall')
    expect_error(403, lambda: req(bob,'/api/chats',{'name':'Alice','kind':'dm','peerId':alice_id}),'Contact bypassed message privacy')
    state=req(bob,'/api/friends/requests/'+alice_id,{})
    assert len(state['outgoing'])==1 and state['friends']==[]
    expect_error(409, lambda: req(bob,'/api/friends/requests/'+alice_id+'/accept',{}),'Requester accepted own friend request')
    req(alice,'/api/friends/requests/'+bob_id,{})
    assert req(bob,'/api/friends')['friends']==[], 'Reciprocal requests must not auto-accept'
    expect_error(404, lambda: bob.open(base+video_path),'Pending request opened attachment access')
    req(alice,'/api/friends/requests/'+bob_id+'/accept',{})
    assert len(req(bob,'/api/friends')['friends'])==1 and len(req(alice,'/api/friends')['friends'])==1
    card=req(bob,'/api/people/'+alice_id)
    assert card['relationship']=='friends' and card['canViewProfile'] and card['canMessage'] and card['canViewWall']
    assert card['bio']=='HiddenBiography'
    assert all(item['authorId']==alice_id for item in req(bob,'/api/hub/posts?authorId='+alice_id))
    assert any(item['id']==post_id and len(item['attachments'])==3 for item in req(bob,'/api/hub/posts'))
    chat=req(bob,'/api/chats',{'name':'Alice','kind':'dm','peerId':alice_id})
    req(bob,'/api/chats/'+chat['id']+'/messages',{'text':'Hello, friend'})
    profile['messageAudience']='nobody'; profile['profileAudience']='nobody'
    req(alice,'/api/profile',profile,'PUT')
    card=req(bob,'/api/people/'+alice_id)
    assert not card['canViewProfile'] and not card['canMessage'] and card['bio']==''
    expect_error(403, lambda: req(bob,'/api/chats/'+chat['id']+'/messages',{'text':'Existing chat bypass'}),'Existing conversation bypassed privacy')
    profile['messageAudience']='friends'; profile['profileAudience']='friends'
    req(alice,'/api/profile',profile,'PUT')
    # Personal walls contain the wall's records, including explicit posts by friends.
    guest=req(bob,'/api/hub/posts',{'body':'A note on Alice’s wall','wallOwnerId':alice_id,'audience':'friends'})
    assert guest['authorId']==bob_id and guest['wallOwnerId']==alice_id
    assert any(item['id']==guest['id'] for item in req(alice,'/api/hub/posts?authorId='+alice_id))
    assert not any(item['id']==guest['id'] for item in req(bob,'/api/hub/posts?authorId='+bob_id)), 'Guest post leaked into the author’s personal wall'
    expect_error(403,lambda:req(bob,'/api/hub/posts',{'body':'Expose another wall','wallOwnerId':alice_id,'audience':'public'}),'Visitor made another person’s wall public')
    profile['wallPostingAudience']='nobody';req(alice,'/api/profile',profile,'PUT')
    assert not req(bob,'/api/people/'+alice_id)['canPostToWall']
    expect_error(403,lambda:req(bob,'/api/hub/posts',{'body':'Bypass wall setting','wallOwnerId':alice_id}),'Wall posting privacy was bypassed')
    profile['wallPostingAudience']='friends';req(alice,'/api/profile',profile,'PUT')
    assert req(bob,'/api/people/'+alice_id)['canPostToWall']
    req(alice,'/api/hub/posts/'+guest['id'],None,'DELETE')
    assert not any(item['id']==guest['id'] for item in req(alice,'/api/hub/posts?authorId='+alice_id)), 'Wall owner could not moderate guest post'
    # Recommendations never turn a private post into a public one.
    public=req(alice,'/api/hub/posts',{'body':'A public thought','audience':'public'})
    public_media=multipart(alice,'Public GIF',[('public.gif','image/gif',gif)],audience='public')
    public_path='/api/hub/posts/'+public_media['id']+'/media/'+public_media['attachments'][0]['id']
    with charlie.open(base+public_path) as response: assert response.read()==gif
    expect_error(404,lambda:charlie.open(base+video_path),'Recommendation leaked friends-only attachment')
    feed=req(charlie,'/api/hub/feed?tab=for-you')
    assert any(item['post'] and item['post']['id']==public['id'] and item['reason']=='recommended' for item in feed)
    assert not any(item['post'] and item['post']['id']==post_id for item in feed), 'Private post leaked through recommendations'
    req(charlie,'/api/people/'+alice_id+'/follow',{})
    assert any(person['id']==alice_id for person in req(charlie,'/api/following'))
    assert not req(charlie,'/api/people/'+alice_id)['canViewWall'], 'Following granted private wall access'
    following=req(charlie,'/api/hub/feed?tab=following')
    assert any(item['post'] and item['post']['id']==public['id'] for item in following)
    assert not any(item['post'] and item['post']['id']==post_id for item in following)
    channel=req(alice,'/api/channels',{'title':'QA engineering','description':'An isolated test channel'})
    req(alice,'/api/channels/'+channel['id']+'/posts',{'body':'A channel update'})
    req(charlie,'/api/channels/'+channel['id']+'/follow',{})
    assert any(item['kind']=='channel' and item['channel']['id']==channel['id'] for item in req(charlie,'/api/hub/feed?tab=following'))
    req(charlie,'/api/people/'+alice_id+'/follow',None,'DELETE')
    assert not any(item['post'] and item['post']['id']==public['id'] for item in req(charlie,'/api/hub/feed?tab=following'))
    charlie_id=req(charlie,'/api/auth/session')['user']['id']
    req(alice,'/api/people/'+charlie_id+'/block',{})
    assert not any(item['post'] and item['post']['authorId']==alice_id for item in req(charlie,'/api/hub/feed?tab=for-you')), 'Blocked author appeared in recommendations'
    req(alice,'/api/people/'+charlie_id+'/block',None,'DELETE')
    # Channel discussion and ownership form a separate domain from personal walls.
    studio=req(alice,'/api/channels',{'title':'QA channel studio','description':'Owner tools'})
    studio_id=studio['id']; cp='/api/channels/'+studio_id
    update=req(alice,cp+'/posts',{'body':'An owner announcement'})
    pp=cp+'/posts/'+update['id']; discussion=pp+'/comments'
    assert studio['commentsEnabled'] and update['commentsEnabled'] and update['commentCount']==0
    expect_error(403,lambda:req(bob,cp+'/posts',{'body':'Viewer tried publishing'}),'Non-owner published a channel post')
    expect_error(409,lambda:req(alice,cp+'/follow',None,'DELETE'),'Owner left channel without transfer')
    expect_error(403,lambda:req(bob,cp,{'title':'Hijacked','description':'','commentsEnabled':True},'PUT'),'Viewer changed channel settings')
    expect_error(403,lambda:req(bob,cp+'/subscribers'),'Viewer accessed subscriber directory')
    expect_error(403,lambda:req(bob,pp,{'pinned':True},'PATCH'),'Viewer pinned a post')
    expect_error(403,lambda:req(bob,pp,None,'DELETE'),'Viewer deleted a post')
    comment=req(bob,discussion,{'body':'Viewer can comment 😀'})
    reply=req(charlie,discussion,{'body':'A reply to the viewer','parentId':comment['id']})
    assert reply['parentId']==comment['id'] and reply['parentBody']=='Viewer can comment 😀'
    photo_data='data:image/png;base64,'+base64.b64encode(png).decode()
    image_comment=req(bob,discussion,{'body':'','photoData':photo_data})
    assert image_comment['photoUrl'] and 'photoData' not in image_comment and 'photo' not in image_comment
    with charlie.open(base+image_comment['photoUrl']) as response:
        assert response.read()==png and response.headers['Content-Type']=='image/png' and response.headers['X-Content-Type-Options']=='nosniff'
    expect_error(403,lambda:client().open(base+image_comment['photoUrl']),'Anonymous photo access')
    expect_error(400,lambda:req(bob,discussion,{'body':'','photoData':'data:image/png;base64,'+base64.b64encode(b'not png').decode()}),'Forged photo accepted')
    expect_error(400,lambda:req(bob,discussion,{'body':'','photoData':'data:image/svg+xml;base64,PHN2Zy8+'}),'SVG photo accepted')
    expect_error(400,lambda:req(bob,discussion,{'body':' '}),'Empty comment accepted')
    another=req(alice,cp+'/posts',{'body':'Second announcement'})
    expect_error(404,lambda:req(bob,cp+'/posts/'+another['id']+'/comments',{'body':'Cross-post reply','parentId':comment['id']}),'Cross-post reply accepted')
    changed=req(charlie,discussion+'/'+comment['id']+'/reactions',{'emoji':'🔥'})
    assert changed['reactions']==[{'emoji':'🔥','count':1,'mine':True}]
    assert req(bob,discussion)['items'][0]['reactions'][0]['mine'] is False
    assert req(charlie,discussion+'/'+comment['id']+'/reactions',{'emoji':'🔥'})['reactions']==[]
    expect_error(400,lambda:req(bob,discussion+'/'+comment['id']+'/reactions',{'emoji':'unsupported'}),'Unsupported reaction accepted')
    expect_error(403,lambda:req(charlie,discussion+'/'+comment['id'],None,'DELETE'),'Viewer deleted someone else comment')
    req(alice,pp,{'body':'Edited announcement','pinned':True,'commentsEnabled':False},'PATCH')
    detail=req(bob,cp); edited=next(p for p in detail['posts'] if p['id']==update['id'])
    assert edited['body']=='Edited announcement' and edited['pinned'] and edited['editedAt'] and edited['commentCount']==3
    expect_error(403,lambda:req(bob,discussion,{'body':'Bypassed post closure'}),'Post closure bypassed')
    req(alice,pp,{'commentsEnabled':True},'PATCH')
    req(alice,cp,{'title':'QA studio renamed','description':'Updated description','commentsEnabled':False},'PUT')
    expect_error(403,lambda:req(bob,discussion,{'body':'Bypassed channel closure'}),'Channel closure bypassed')
    assert req(bob,discussion)['total']==3, 'Closing comments removed prior discussion'
    req(alice,cp,{'title':'QA studio renamed','description':'Updated description','commentsEnabled':True},'PUT')
    req(alice,discussion+'/'+image_comment['id'],None,'DELETE')
    expect_error(404,lambda:bob.open(base+image_comment['photoUrl']),'Removed photo still readable')
    req(bob,discussion+'/'+comment['id'],None,'DELETE')
    remaining=req(charlie,discussion)
    assert remaining['total']==1
    tombstone=next(c for c in remaining['items'] if c['id']==comment['id'])
    assert tombstone['removed'] and tombstone['body']=='' and tombstone['reactions']==[]
    assert next(c for c in remaining['items'] if c['id']==reply['id'])['parentBody']=='Comment removed'
    expect_error(400,lambda:req(bob,discussion,{'body':'Reply to tombstone','parentId':comment['id']}),'Reply to removed comment accepted')
    # Pagination must not silently truncate busy discussions.
    for n in range(51): req(bob,cp+'/posts/'+another['id']+'/comments',{'body':'Comment '+str(n)})
    first=req(bob,cp+'/posts/'+another['id']+'/comments'); second=req(bob,cp+'/posts/'+another['id']+'/comments?page='+str(first['nextPage']))
    assert len(first['items'])==50 and first['hasMore'] and len(second['items'])==1 and not second['hasMore']
    expect_error(400,lambda:req(alice,cp+'/transfer',{'newOwnerId':bob_id}),'Ownership transferred to a non-subscriber')
    req(bob,cp+'/follow',{})
    assert any(u['id']==bob_id for u in req(alice,cp+'/subscribers'))
    expect_error(403,lambda:req(charlie,cp+'/transfer',{'newOwnerId':bob_id}),'Viewer transferred channel')
    expect_error(400,lambda:req(alice,cp+'/transfer',{'newOwnerId':alice_id}),'Self-transfer accepted')
    req(alice,cp+'/transfer',{'newOwnerId':bob_id})
    moved=req(alice,cp)['channel']
    assert moved['ownerId']==bob_id and not moved['subscribed'] and moved['followers']==1
    assert req(bob,cp)['channel']['subscribed']
    expect_error(403,lambda:req(alice,cp+'/posts',{'body':'Former owner'}),'Former owner still published')
    expect_error(403,lambda:req(alice,pp,{'body':'Former owner edit'},'PATCH'),'Former owner edited posts')
    expect_error(403,lambda:req(alice,cp+'/subscribers'),'Former owner accessed directory')
    expect_error(409,lambda:req(bob,cp+'/follow',None,'DELETE'),'New owner left without transfer')
    req(bob,pp,{'body':'New owner can manage historical posts'},'PATCH')
    req(bob,cp+'/posts',{'body':'New owner publication'})
    req(bob,discussion+'/'+reply['id'],None,'DELETE')
    req(bob,cp+'/posts/'+another['id'],None,'DELETE')
    expect_error(404,lambda:req(charlie,cp+'/posts/'+another['id']+'/comments'),'Deleted post discussion remained available')
    expect_error(403,lambda:req(alice,cp,{'confirmation':'QA studio renamed'},'DELETE'),'Former owner deleted channel')
    expect_error(400,lambda:req(bob,cp,{'confirmation':'wrong name'},'DELETE'),'Unconfirmed channel deletion')
    req(bob,cp,{'confirmation':'QA studio renamed'},'DELETE')
    expect_error(404,lambda:req(alice,cp),'Deleted channel remained available')
    expect_error(404,lambda:req(charlie,discussion),'Deleted channel discussion remained available')
    assert not any(c['id']==studio_id for c in req(charlie,'/api/channels'))
    # Appearance choices survive the API, including all forty preset palettes.
    palette_ids=re.findall(r"\['([a-z]+)','[^']+','#[0-9a-f]{6}','#[0-9a-f]{6}'\]",(root/'src/appearance.ts').read_text())
    assert len(palette_ids)==40
    for palette in palette_ids:
        profile['preferences']['accent']=palette
        saved=req(alice,'/api/profile',profile,'PUT')
        assert saved['preferences']['accent']==palette
    profile['preferences'].update(theme='light',accent='custom',customAccent='#e46fa7',coverStyle='orbit',artMode='ascii',artId='docker')
    req(alice,'/api/profile',profile,'PUT')
    restored=req(alice,'/api/profile')
    assert restored['preferences']['theme']=='light' and restored['preferences']['customAccent']=='#e46fa7' and restored['company']=='HiddenCompany'
    card=req(bob,'/api/people/'+alice_id)
    assert card['appearance']['coverStyle']=='orbit' and card['appearance']['artMode']=='ascii'
    assert 'desktopNotifications' not in card['appearance'], 'Private preferences leaked through public profile'
    with bob.open(base+video_path, timeout=4) as response: assert response.read()==video
    range_request=urllib.request.Request(base+video_path, headers={'Range':'bytes=0-7'})
    with bob.open(range_request, timeout=4) as response:
        assert response.status==206, response.status
        assert response.read()==video[:8], 'Video range request returned wrong bytes'
    try: req(bob, '/api/hub/posts/'+post_id, {'body':'edited by another user'}, 'PUT'); raise AssertionError('Non-owner edited post')
    except urllib.error.HTTPError as e: assert e.code==403, e.code
    assert req(alice, '/api/hub/posts/'+post_id, {'body':''}, 'PUT')['attachments'][2]['size']==len(video)
    media_only=multipart(alice, '', [('moment.gif','image/gif',gif)])
    assert media_only['body']=='' and len(media_only['attachments'])==1
    text_only=req(alice, '/api/hub/posts', {'body':'Text posts still work'})
    assert text_only['attachments']==[]
    invalid_uploads=[
        ('', []),
        ('Bad file', [('fake.gif','image/gif',b'not a gif')]),
        ('Unsupported', [('image.svg','image/svg+xml',b'<svg/>')]),
        ('Too many', [('photo.png','image/png',png)]*5),
        ('x'*501, [('photo.png','image/png',png)]),
        ('Too large', [('large.png','image/png',png+b'0'*(5*1024*1024))]),
    ]
    count=len(req(alice, '/api/hub/posts'))
    for caption, files in invalid_uploads:
        try: multipart(alice, caption, files); raise AssertionError('Invalid upload accepted')
        except urllib.error.HTTPError as e: assert e.code==400, e.code
    assert len(req(alice, '/api/hub/posts'))==count, 'Rejected upload left a partial post'
    req(bob, '/api/contacts/'+alice_id, None, 'DELETE')
    with bob.open(base+video_path) as response: assert response.read()==video, 'Removing a contact must not remove friendship'
    req(bob,'/api/contacts/'+alice_id,{})
    req(bob,'/api/friends/'+alice_id,None,'DELETE')
    assert req(alice,'/api/friends')['friends']==[]
    assert any(person['id']==alice_id for person in req(bob,'/api/contacts')), 'Removing a friend must keep saved contacts'
    expect_error(404,lambda: bob.open(base+video_path),'Removed friend retained media access')
    expect_error(404,lambda: req(bob,'/api/hub/posts/'+post_id+'/comments'),'Removed friend retained comment access')
    assert not req(bob,'/api/people/'+alice_id)['canViewProfile']
    req(bob,'/api/friends/requests/'+alice_id,{})
    req(alice,'/api/friends/requests/'+bob_id,None,'DELETE')
    assert req(bob,'/api/friends')['outgoing']==[]
    req(bob,'/api/friends/requests/'+alice_id,{})
    req(bob,'/api/friends/requests/'+alice_id,None,'DELETE')
    assert req(alice,'/api/friends')['incoming']==[]
    req(bob,'/api/friends/requests/'+alice_id,{})
    req(alice,'/api/friends/requests/'+bob_id+'/accept',{})
    req(alice,'/api/people/'+bob_id+'/block',{})
    assert req(bob,'/api/friends')['friends']==[]
    expect_error(404,lambda: bob.open(base+video_path),'Blocked friend retained wall access')
    expect_error(404,lambda: req(bob,'/api/friends/requests/'+alice_id,{}),'Blocked user sent a friend request')
    req(alice,'/api/people/'+bob_id+'/block',None,'DELETE')
    assert req(bob,'/api/friends')['friends']==[], 'Unblocking must not restore friendship'
    invalid=json.loads(json.dumps(profile)); invalid['profileAudience']='public-by-accident'
    expect_error(400,lambda: req(alice,'/api/profile',invalid,'PUT'),'Invalid profile audience accepted')
    req(alice, '/api/hub/posts/'+post_id, None, 'DELETE')
    try: alice.open(base+video_path); raise AssertionError('Deleted post media remained readable')
    except urllib.error.HTTPError as e: assert e.code==404, e.code
    print('Live API checks passed: channel owner-only publishing; threaded/photo/emoji comments; pagination and moderation; owner exit lock; transfer-and-leave with revoked old-owner rights; channel/post deletion; profile visibility and audience validation; contacts versus mutual friendship; request/accept/cancel/decline/remove/block; existing-chat privacy; guest wall posts and owner moderation; public-only recommendations; people/channel subscriptions; 40 palettes and appearance persistence; photo/GIF/video multipart posts; mutual-friends-only walls/media; byte ranges; media-only and text posts; caption editing; invalid upload rollback; delete cleanup.')
except Exception:
    failure_log=log_path.read_text()
    print('\n'.join(line for line in failure_log.splitlines() if 'Caused by:' in line or 'SQLState' in line or 'Error executing DDL' in line)[:2000])
    print(failure_log[-4500:])
    raise
finally:
    process.terminate()
    try: process.wait(timeout=8)
    except subprocess.TimeoutExpired: process.kill(); process.wait()
    log.close()
    test_dir.cleanup()
