import React, { useEffect, useMemo, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native'
import { getApiUrl, setApiUrl, login, session, logout, listFeed, toggleLike, listComments, addComment, listChats, listMessages, sendMessage, type AuthUser, type Chat, type HubComment, type HubPost, type Message } from './src/api'

const C = { bg: '#080C14', surface: '#111927', elevated: '#19253A', border: '#283A58', text: '#F4F7FB', muted: '#8FA1BA', cyan: '#67E8F9', violet: '#A78BFA', pink: '#F0ABFC', green: '#34D399', danger: '#FB7185' }

function Button({ title, onPress, tone = C.cyan, disabled = false }: { title: string; onPress: () => void; tone?: string; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, { borderColor: tone }, disabled && styles.disabled]}><Text style={[styles.buttonText, { color: tone }]}>{title}</Text></Pressable>
}

function Field({ value, onChangeText, placeholder, secureTextEntry = false, keyboardType = 'default' }: { value: string; onChangeText: (value: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: 'default' | 'url' }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize="none" style={styles.input} />
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (user: AuthUser) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [apiUrl, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { getApiUrl().then(setUrl) }, [])
  async function submit() {
    if (!identifier.trim() || !password) return Alert.alert('Нужны данные', 'Введи email или username и пароль.')
    setBusy(true)
    try { await setApiUrl(apiUrl); const result = await login(identifier, password); if (result.user) onLoggedIn(result.user) }
    catch (error) { Alert.alert('Не удалось войти', error instanceof Error ? error.message : 'Проверь адрес сервера и соединение.') }
    finally { setBusy(false) }
  }
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" /><ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
    <Text style={styles.kicker}>NIGHTFALL / MOBILE</Text><Text style={styles.hero}>Messenger</Text><Text style={styles.subtitle}>Настоящий iPhone-клиент для твоего Nightfall.</Text>
    <View style={styles.card}><Text style={styles.cardTitle}>Вход</Text><Field value={identifier} onChangeText={setIdentifier} placeholder="Email или username" /><Field value={password} onChangeText={setPassword} placeholder="Пароль" secureTextEntry /><Button title={busy ? 'Входим…' : 'Войти'} onPress={submit} disabled={busy} /></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Адрес сервера</Text><Text style={styles.muted}>На iPhone нельзя использовать localhost. Введи HTTPS-адрес сайта или LAN-адрес компьютера.</Text><Field value={apiUrl} onChangeText={setUrl} placeholder="https://messenger.example.com" keyboardType="url" /></View>
  </ScrollView></SafeAreaView>
}

function FeedScreen() {
  const [posts, setPosts] = useState<HubPost[]>([])
  const [openPost, setOpenPost] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, HubComment[]>>({})
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  async function load() { try { setPosts(await listFeed()) } catch (error) { Alert.alert('Лента недоступна', error instanceof Error ? error.message : 'Попробуй позже.') } }
  useEffect(() => { load() }, [])
  async function react(post: HubPost) { try { const updated = await toggleLike(post.id); setPosts(current => current.map(item => item.id === post.id ? updated : item)) } catch (error) { Alert.alert('Лайк не применён', error instanceof Error ? error.message : 'Попробуй ещё раз.') } }
  async function showComments(post: HubPost) { setOpenPost(post.id); if (!comments[post.id]) { try { const loaded = await listComments(post.id); setComments(current => ({ ...current, [post.id]: loaded })) } catch (error) { Alert.alert('Комментарии недоступны', error instanceof Error ? error.message : 'Попробуй ещё раз.') } } }
  async function comment(post: HubPost) { if (!draft.trim() || busy) return; setBusy(true); try { const created = await addComment(post.id, draft.trim()); setComments(current => ({ ...current, [post.id]: [...(current[post.id] ?? []), created] })); setPosts(current => current.map(item => item.id === post.id ? { ...item, comments: item.comments + 1 } : item)); setDraft('') } catch (error) { Alert.alert('Комментарий не отправлен', error instanceof Error ? error.message : 'Попробуй ещё раз.') } finally { setBusy(false) } }
  return <ScrollView contentContainerStyle={styles.content}><View style={styles.row}><View><Text style={styles.kicker}>NIGHTFALL / FEED</Text><Text style={styles.title}>Лента</Text></View><Pressable onPress={load}><Text style={styles.refresh}>↻</Text></Pressable></View>{posts.length === 0 ? <Text style={styles.empty}>Пока нет доступных публикаций.</Text> : posts.map(post => <View style={styles.card} key={post.id}><Text style={styles.author}>{post.author} <Text style={styles.handle}>@{post.username}</Text></Text><Text style={styles.postBody}>{post.body}</Text><View style={styles.actions}><Pressable onPress={() => react(post)}><Text style={[styles.action, post.liked && { color: C.pink }]}>{post.liked ? '♥' : '♡'} {post.likes}</Text></Pressable><Pressable onPress={() => showComments(post)}><Text style={[styles.action, openPost === post.id && { color: C.cyan }]}>▢ {post.comments}</Text></Pressable></View>{openPost === post.id && <View style={styles.comments}>{(comments[post.id] ?? []).map(item => <View key={item.id} style={styles.comment}><Text style={styles.commentAuthor}>{item.author}</Text><Text style={styles.commentBody}>{item.body}</Text></View>)}<TextInput value={draft} onChangeText={setDraft} placeholder="Написать комментарий…" placeholderTextColor={C.muted} style={styles.commentInput} onSubmitEditing={() => comment(post)} returnKeyType="send"/><Button title={busy ? 'Отправляем…' : 'Отправить комментарий'} onPress={() => comment(post)} disabled={busy || !draft.trim()} /></View>}</View>)}</ScrollView>
}

function ChatsScreen() {
  const [chats, setChats] = useState<Chat[]>([])
  const [selected, setSelected] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  async function loadChats() { try { setChats(await listChats()) } catch (error) { Alert.alert('Чаты недоступны', error instanceof Error ? error.message : 'Попробуй позже.') } }
  useEffect(() => { loadChats() }, [])
  async function open(chat: Chat) { setSelected(chat); try { setMessages(await listMessages(chat.id)) } catch (error) { Alert.alert('Сообщения недоступны', error instanceof Error ? error.message : 'Попробуй ещё раз.') } }
  async function send() { if (!selected || !draft.trim() || busy) return; setBusy(true); try { const created = await sendMessage(selected.id, draft.trim()); setMessages(current => [...current, created]); setDraft('') } catch (error) { Alert.alert('Сообщение не отправлено', error instanceof Error ? error.message : 'Попробуй ещё раз.') } finally { setBusy(false) } }
  if (selected) return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><SafeAreaView style={styles.safe}><View style={styles.chatHeader}><Pressable onPress={() => setSelected(null)}><Text style={styles.back}>‹</Text></Pressable><View><Text style={styles.titleSmall}>{selected.name}</Text><Text style={styles.muted}>@{selected.handle ?? 'chat'}</Text></View></View><ScrollView contentContainerStyle={styles.messageList}>{messages.map(message => <View key={message.id} style={[styles.bubble, message.own ? styles.ownBubble : styles.theirBubble]}><Text style={styles.bubbleAuthor}>{message.author}</Text><Text style={styles.bubbleText}>{message.text}</Text><Text style={styles.bubbleTime}>{message.time}</Text></View>)}</ScrollView><View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="Сообщение…" placeholderTextColor={C.muted} style={[styles.input, styles.messageInput]} onSubmitEditing={send} returnKeyType="send"/><Pressable onPress={send} disabled={busy || !draft.trim()}><Text style={[styles.send, (!draft.trim() || busy) && styles.disabledText]}>➤</Text></Pressable></View></SafeAreaView></KeyboardAvoidingView>
  return <ScrollView contentContainerStyle={styles.content}><View style={styles.row}><View><Text style={styles.kicker}>NIGHTFALL / MESSAGES</Text><Text style={styles.title}>Чаты</Text></View><Pressable onPress={loadChats}><Text style={styles.refresh}>↻</Text></Pressable></View>{chats.length === 0 ? <Text style={styles.empty}>Чатов пока нет.</Text> : chats.map(chat => <Pressable key={chat.id} onPress={() => open(chat)} style={styles.chatRow}><View style={styles.avatar}><Text style={styles.avatarText}>{chat.avatar ?? chat.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.chatCopy}><Text style={styles.chatName}>{chat.name}</Text><Text style={styles.muted} numberOfLines={1}>{chat.lastMessage || 'Открыть чат'}</Text></View>{chat.unread > 0 && <Text style={styles.unread}>{chat.unread}</Text>}</Pressable>)}</ScrollView>
}

function AppShell({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [tab, setTab] = useState<'feed' | 'chats' | 'profile'>('feed')
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" />{tab === 'feed' ? <FeedScreen /> : tab === 'chats' ? <ChatsScreen /> : <ScrollView contentContainerStyle={styles.content}><Text style={styles.kicker}>NIGHTFALL / ACCOUNT</Text><Text style={styles.title}>{user.firstName} {user.lastName}</Text><Text style={styles.subtitle}>@{user.username}</Text><View style={styles.card}><Text style={styles.cardTitle}>Подключено</Text><Text style={styles.muted}>{user.email}</Text><Button title="Выйти" onPress={onLogout} tone={C.danger} /></View></ScrollView>}<View style={styles.nav}><Pressable onPress={() => setTab('feed')}><Text style={[styles.navText, tab === 'feed' && styles.active]}>Лента</Text></Pressable><Pressable onPress={() => setTab('chats')}><Text style={[styles.navText, tab === 'chats' && styles.active]}>Чаты</Text></Pressable><Pressable onPress={() => setTab('profile')}><Text style={[styles.navText, tab === 'profile' && styles.active]}>Профиль</Text></Pressable></View></SafeAreaView>
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { session().then(result => setUser(result.user)).catch(() => {}).finally(() => setLoading(false)) }, [])
  if (loading) return <SafeAreaView style={styles.safe}><Text style={styles.loading}>NIGHTFALL / CONNECTING…</Text></SafeAreaView>
  if (!user) return <LoginScreen onLoggedIn={setUser} />
  return <AppShell user={user} onLogout={() => { logout().catch(() => {}); setUser(null) }} />
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 }, loginContent: { flexGrow: 1, justifyContent: 'center', padding: 24 }, content: { padding: 20, paddingBottom: 110 }, kicker: { color: C.cyan, letterSpacing: 1.5, fontSize: 11, fontWeight: '800' }, hero: { color: C.text, fontSize: 42, fontWeight: '900', marginTop: 8 }, title: { color: C.text, fontSize: 29, fontWeight: '900', marginTop: 4 }, titleSmall: { color: C.text, fontSize: 18, fontWeight: '800' }, subtitle: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 }, card: { backgroundColor: C.surface, borderRadius: 18, padding: 17, marginTop: 14, borderWidth: 1, borderColor: C.border }, cardTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 10 }, input: { backgroundColor: C.elevated, color: C.text, borderRadius: 12, padding: 14, marginVertical: 6, borderWidth: 1, borderColor: C.border }, button: { borderWidth: 1, borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 10 }, buttonText: { fontSize: 14, fontWeight: '800' }, disabled: { opacity: 0.45 }, disabledText: { opacity: 0.35 }, muted: { color: C.muted, fontSize: 13, lineHeight: 19 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }, refresh: { color: C.cyan, fontSize: 28 }, empty: { color: C.muted, textAlign: 'center', paddingVertical: 40 }, author: { color: C.text, fontSize: 16, fontWeight: '800' }, handle: { color: C.muted, fontWeight: '500' }, postBody: { color: C.text, fontSize: 16, lineHeight: 24, marginTop: 12 }, actions: { flexDirection: 'row', gap: 24, borderTopWidth: 1, borderTopColor: C.border, marginTop: 16, paddingTop: 12 }, action: { color: C.muted, fontSize: 15, fontWeight: '700' }, comments: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 15, paddingTop: 10 }, comment: { backgroundColor: C.elevated, borderRadius: 10, padding: 10, marginTop: 7 }, commentAuthor: { color: C.cyan, fontSize: 12, fontWeight: '800' }, commentBody: { color: C.text, marginTop: 4, lineHeight: 20 }, commentInput: { backgroundColor: C.elevated, color: C.text, borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: C.border }, chatRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, padding: 13, marginTop: 10, borderWidth: 1, borderColor: C.border }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.violet, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: C.bg, fontSize: 18, fontWeight: '900' }, chatCopy: { flex: 1, marginLeft: 12 }, chatName: { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 3 }, unread: { color: C.bg, backgroundColor: C.cyan, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, fontWeight: '900' }, chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }, back: { color: C.cyan, fontSize: 36, lineHeight: 36 }, messageList: { padding: 16, paddingBottom: 28 }, bubble: { maxWidth: '82%', borderRadius: 16, padding: 11, marginBottom: 9 }, ownBubble: { alignSelf: 'flex-end', backgroundColor: '#164452' }, theirBubble: { alignSelf: 'flex-start', backgroundColor: C.surface }, bubbleAuthor: { color: C.cyan, fontSize: 11, fontWeight: '800', marginBottom: 4 }, bubbleText: { color: C.text, fontSize: 15, lineHeight: 21 }, bubbleTime: { color: C.muted, fontSize: 10, marginTop: 5, textAlign: 'right' }, composer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: C.border }, messageInput: { flex: 1, marginVertical: 0 }, send: { color: C.cyan, fontSize: 26, paddingHorizontal: 12 }, nav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 74, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }, navText: { color: C.muted, fontSize: 14, fontWeight: '800' }, active: { color: C.cyan }, loading: { color: C.cyan, margin: 24, fontWeight: '800' }
})
