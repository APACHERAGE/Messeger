import type { Preferences, Profile, ProfileVisibility } from './api/profileApi'
export const visibilityLabels: Record<keyof ProfileVisibility, string> = {
  pronouns: 'Pronouns', company: 'Company / team', timezone: 'Time zone', interests: 'Interests', lookingFor: 'Open to', githubUsername: 'GitHub username',
  avatar: 'Profile photo', firstName: 'First name', lastName: 'Last name', headline: 'Role / headline',
  bio: 'About me', skills: 'Skills & technologies', location: 'Location', website: 'Website',
  githubProjects: 'GitHub projects', status: 'Current status',
}
export const categories = ['Profile visibility', 'Privacy', 'Notifications', 'Chats', 'Appearance', 'Accessibility', 'Data & Storage', 'Account'] as const
export type Category = typeof categories[number]
type Base = { section: Category; label: string; description: string }
export type Setting = Base & ({ scope: 'profile'; key: keyof Pick<Profile, 'notifications' | 'showOnline' | 'compactMode' | 'showMessagePreview' | 'autoMarkRead' | 'sendOnEnter' | 'reduceMotion' | 'pixelGrid'>; options?: undefined }
  | { scope: 'preferences'; key: keyof Preferences; options?: { value: string; label: string }[]; type?: 'time' })
const choices = (...values: string[]) => values.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))
export const settings: Setting[] = [
  { section: 'Privacy', scope: 'profile', key: 'showOnline', label: 'Show current status', description: 'Allow your status text to appear on your public card.' },
  { section: 'Privacy', scope: 'profile', key: 'showMessagePreview', label: 'Conversation previews', description: 'Show the latest message in the conversation list on this device.' },
  { section: 'Privacy', scope: 'profile', key: 'autoMarkRead', label: 'Mark opened chats as read', description: 'Clear unread counts when viewing a conversation.' },
  { section: 'Notifications', scope: 'profile', key: 'notifications', label: 'Unread badge', description: 'Show the unread counter on the navigation bell.' },
  { section: 'Notifications', scope: 'preferences', key: 'desktopNotifications', label: 'Desktop notifications', description: 'Notify while this tab is in the background; browser permission is required.' },
  { section: 'Notifications', scope: 'preferences', key: 'inAppNotifications', label: 'In-app message alerts', description: 'Show a banner for new messages while using Nightfall.' },
  { section: 'Notifications', scope: 'preferences', key: 'notificationPreview', label: 'Notification content', description: 'Include sender and message text in alerts. Turn off for discreet notifications.' },
  { section: 'Notifications', scope: 'preferences', key: 'notifyDirect', label: 'Direct messages', description: 'Receive alerts for personal conversations.' },
  { section: 'Notifications', scope: 'preferences', key: 'notifyGroups', label: 'Community messages', description: 'Receive alerts for group conversations.' },
  { section: 'Notifications', scope: 'preferences', key: 'notifyChannels', label: 'Channel messages', description: 'Receive alerts for channel conversations.' },
  { section: 'Notifications', scope: 'preferences', key: 'mentionsOnly', label: 'Only mentions', description: 'Only alert when a message includes your @username.' },
  { section: 'Notifications', scope: 'preferences', key: 'quietHours', label: 'Quiet hours', description: 'Pause message alerts daily using this device’s local time.' },
  { section: 'Notifications', scope: 'preferences', key: 'quietStart', label: 'Quiet hours start', description: 'Start of the daily quiet period.', type: 'time' },
  { section: 'Notifications', scope: 'preferences', key: 'quietEnd', label: 'Quiet hours end', description: 'End of the daily quiet period; equal times mute the whole day.', type: 'time' },
  { section: 'Chats', scope: 'profile', key: 'sendOnEnter', label: 'Send with Enter', description: 'When off, Enter adds a line; Ctrl/⌘ + Enter sends.' },
  { section: 'Chats', scope: 'preferences', key: 'spellCheck', label: 'Spell check', description: 'Use your browser’s spelling suggestions in the message composer.' },
  { section: 'Chats', scope: 'preferences', key: 'confirmDelete', label: 'Confirm message deletion', description: 'Ask before permanently deleting one of your messages.' },
  { section: 'Chats', scope: 'preferences', key: 'autoScroll', label: 'Follow new messages', description: 'Scroll to the latest message when new messages arrive.' },
  { section: 'Chats', scope: 'preferences', key: 'sortChats', label: 'Conversation order', description: 'Reorder the conversation list; pinned chats always stay first.', options: choices('recent', 'name', 'unread') },
  { section: 'Chats', scope: 'preferences', key: 'showComposerHints', label: 'Keyboard hints', description: 'Display the sending shortcut below the message composer.' },
  { section: 'Appearance', scope: 'preferences', key: 'fontSize', label: 'Message text size', description: 'Adjust text size in message bubbles.', options: choices('small', 'medium', 'large') },
  { section: 'Appearance', scope: 'preferences', key: 'chatBackground', label: 'Chat background', description: 'Choose the pattern behind messages.', options: choices('grid', 'plain', 'dots') },
  { section: 'Appearance', scope: 'preferences', key: 'bubbleStyle', label: 'Message corners', description: 'Choose rounded or square message bubbles.', options: choices('rounded', 'square') },
  { section: 'Appearance', scope: 'profile', key: 'compactMode', label: 'Compact conversation list', description: 'Fit more conversations in the sidebar.' },
  { section: 'Appearance', scope: 'profile', key: 'pixelGrid', label: 'Interface grid', description: 'Show the subtle pixel grid across the workspace.' },
  { section: 'Appearance', scope: 'preferences', key: 'showAvatars', label: 'Message avatars', description: 'Show avatars beside messages in conversations.' },
  { section: 'Appearance', scope: 'preferences', key: 'showTimestamps', label: 'Message timestamps', description: 'Show the sending time beside each message.' },
  { section: 'Appearance', scope: 'preferences', key: 'showReactions', label: 'Message reactions', description: 'Display reaction chips below messages.' },
  { section: 'Appearance', scope: 'preferences', key: 'showChatTimes', label: 'Conversation times', description: 'Show the latest activity time in the sidebar.' },
  { section: 'Appearance', scope: 'preferences', key: 'showOnlineIndicators', label: 'Online indicators', description: 'Show other people’s online indicators on this device.' },
  { section: 'Accessibility', scope: 'profile', key: 'reduceMotion', label: 'Reduce motion', description: 'Disable decorative animation and smooth message scrolling.' },
  { section: 'Accessibility', scope: 'preferences', key: 'highContrast', label: 'Higher contrast', description: 'Increase text and border contrast in profile, settings, and messages.' },
  { section: 'Accessibility', scope: 'preferences', key: 'largeControls', label: 'Larger controls', description: 'Increase tap targets in settings and the message composer.' },
]
