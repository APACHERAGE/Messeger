import assert from 'node:assert/strict'
import { build } from 'rolldown'
import { createRequire, Module } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), require=createRequire(resolve(root,'package.json'))
const React=require('react'), {renderToStaticMarkup}=require('react-dom/server'), saved=new Map()
let quota=false
Object.assign(globalThis,{localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>{if(quota)throw Error('QuotaExceededError');saved.set(k,v)}},FileReader:class{readAsDataURL(file){file.arrayBuffer().then(bytes=>{this.result=`data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`;this.onload?.()}).catch(()=>this.onerror?.())}}})
async function load(){
 const result=await build({input:'entry',cwd:root,external:['react','react/jsx-runtime','lucide-react'],transform:{define:{'import.meta.env.MODE':JSON.stringify('demo-preview')}},plugins:[{name:'entry',resolveId(id){if(id==='entry')return '\0entry';if(id.endsWith('.css'))return '\0css'},load(id){if(id==='\0css')return '';if(id==='\0entry')return `export * from ${JSON.stringify(resolve(root,'src/api/channelsApi.ts'))};export {default as Post} from ${JSON.stringify(resolve(root,'src/ChannelPostItem.tsx'))};export {default as Comments} from ${JSON.stringify(resolve(root,'src/ChannelComments.tsx'))};export {default as Studio} from ${JSON.stringify(resolve(root,'src/ChannelOwnerPanel.tsx'))};`}}],output:{format:'cjs'}})
 const mod=new Module(resolve(root,'channels-check.cjs'));mod.filename=resolve(root,'channels-check.cjs');mod.paths=Module._nodeModulePaths(root);mod._compile(result.output.find(x=>x.type==='chunk').code,mod.filename);return mod.exports
}
const api=await load(),user={id:'alice',name:'Alice',username:'alice'}
const channel=await api.createChannel('Test channel','Description','alice')
assert.equal(channel.commentsEnabled,true)
await assert.rejects(api.unfollowChannel(channel.id,'alice'),/Transfer ownership/)
assert.equal((await api.listChannels('alice'))[0].subscribed,true)
assert.deepEqual(await api.listChannels('bob'),[])
const post=await api.publishChannelPost(channel.id,'Owner post','alice')
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props))
const ownerHtml=render(api.Post,{channel,post,user,onUpdate(){},onDelete(){}})
const viewerHtml=render(api.Post,{channel,post,user:{id:'bob',name:'Bob',username:'bob'},onUpdate(){},onDelete(){}})
assert.match(ownerHtml,/aria-label="Edit post"/);assert.match(ownerHtml,/aria-label="Pin post"/)
assert.doesNotMatch(viewerHtml,/aria-label="Edit post"|aria-label="Pin post"|aria-label="Delete post"/)
assert.match(viewerHtml,/aria-controls="comments-/)
const commentsHtml=render(api.Comments,{channelId:channel.id,postId:post.id,user,open:true,enabled:true,onCount(){}})
assert.match(commentsHtml,/Add a comment/);assert.match(commentsHtml,/image\/png,image\/jpeg,image\/gif,image\/webp/)
assert.doesNotMatch(render(api.Comments,{channelId:channel.id,postId:post.id,user,open:true,enabled:false,onCount(){}}),/Join the discussion/)
const comment=await api.addChannelComment(channel.id,post.id,user,'Hello 😀',null)
const reply=await api.addChannelComment(channel.id,post.id,user,'A reply',comment.id)
assert.equal(reply.parentId,comment.id);assert.equal(reply.parentBody,'Hello 😀')
await assert.rejects(api.addChannelComment(channel.id,post.id,user,'',null),/Write a comment/)
await assert.rejects(api.addChannelComment(channel.id,post.id,user,'wrong target','missing'),/Reply target/)
const png=new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')],'photo.png',{type:'image/png'})
const photo=await api.addChannelComment(channel.id,post.id,user,'',null,png)
assert.match(photo.photoUrl,/^data:image\/png;base64,/)
await assert.rejects(api.addChannelComment(channel.id,post.id,user,'',null,new File(['<svg/>'],'x.svg',{type:'image/svg+xml'})),/Choose/)
assert.equal((await api.reactChannelComment(channel.id,post.id,comment.id,'alice','🔥')).reactions[0].count,1)
assert.deepEqual((await api.reactChannelComment(channel.id,post.id,comment.id,'alice','🔥')).reactions,[])
await assert.rejects(api.reactChannelComment(channel.id,post.id,comment.id,'alice','invalid'),/Unsupported/)
await api.updateChannelPost(channel.id,post.id,'alice',{body:'Edited',pinned:true,commentsEnabled:false})
await assert.rejects(api.addChannelComment(channel.id,post.id,user,'Closed',null),/closed/)
await api.updateChannelPost(channel.id,post.id,'alice',{commentsEnabled:true})
await api.updateChannel(channel.id,'alice',{title:'Renamed',description:'Updated',commentsEnabled:false})
await assert.rejects(api.addChannelComment(channel.id,post.id,user,'Closed globally',null),/closed/)
await api.updateChannel(channel.id,'alice',{title:'Renamed',description:'Updated',commentsEnabled:true})
await api.deleteChannelComment(channel.id,post.id,comment.id,'alice')
let comments=await api.listChannelComments(channel.id,post.id,'alice')
assert.equal(comments.total,2);assert.equal(comments.items[0].removed,true);assert.equal(comments.items[1].parentBody,'Comment removed')
quota=true;await assert.rejects(api.addChannelComment(channel.id,post.id,user,'No storage',null),/Quota/);quota=false
assert.equal((await api.listChannelComments(channel.id,post.id,'alice')).total,2)
const reload=await load();assert.equal((await reload.getChannel(channel.id,'alice')).posts[0].body,'Edited');assert.equal((await reload.listChannelComments(channel.id,post.id,'alice')).total,2)
await assert.rejects(api.transferChannel(channel.id,'alice','alice'),/another subscriber/)
await assert.rejects(api.transferChannel(channel.id,'alice','bob'),/shared API/)
await assert.rejects(api.deleteChannel(channel.id,'alice','incorrect'),/confirm/)
await api.deleteChannelPost(channel.id,post.id,'alice');await assert.rejects(api.listChannelComments(channel.id,post.id,'alice'),/Post not found/)
await api.deleteChannel(channel.id,'alice','Renamed');assert.deepEqual(await api.listChannels('alice'),[])
// Read legacy browser records without the new properties.
saved.set('nightfall-public-demo-channels-v1-legacy',JSON.stringify({channels:[{id:'old',ownerId:'legacy',title:'Old'}],posts:{old:[{id:'old-post',body:'Legacy',createdAt:'2020-01-01'}]}}))
const legacy=await api.getChannel('old','legacy');assert.equal(legacy.channel.commentsEnabled,true);assert.equal(legacy.posts[0].commentsEnabled,true);assert.equal(legacy.posts[0].pinned,false)
console.log('Channel checks passed: local persistence/isolation/migration, owner exit guard, per-post discussions, replies, photos, reactions, closure controls, deletion cleanup, storage failure and owner/viewer UI controls. Multi-account permissions and ownership transfer are checked against the live API.')
