export type AppCommandActions = {
  navigate: (view: 'home' | 'discussions' | 'channels' | 'chats' | 'contacts') => void
  openProfile: () => void
  createThread: () => void
  createChannel: () => void
  searchThreads: (query: string) => void
  sortThreads: (sort: 'active' | 'new') => void
  status: () => string
  logout: () => void
}

export type CommandDefinition = {
  usage: string
  description: string
  example: string
  group: string
}

export const commandDefinitions: CommandDefinition[] = [
  { usage: '/help', description: 'Open the command reference.', example: '/help', group: 'Help' },
  { usage: '/home', description: 'Open your profile and personal wall.', example: '/home', group: 'Navigation' },
  { usage: '/threads', description: 'Open the Threads feed.', example: '/threads', group: 'Navigation' },
  { usage: '/forum', description: 'Legacy alias for /threads.', example: '/forum', group: 'Navigation' },
  { usage: '/channels', description: 'Open technical channels.', example: '/channels', group: 'Navigation' },
  { usage: '/chats', description: 'Open direct messages and group chats.', example: '/chats', group: 'Navigation' },
  { usage: '/people', description: 'Open the people directory.', example: '/people', group: 'Navigation' },
  { usage: '/profile', description: 'Open your home, profile, and personal wall.', example: '/profile', group: 'Navigation' },
  { usage: '/new-thread', description: 'Open the new thread composer.', example: '/new-thread', group: 'Create' },
  { usage: '/new-channel', description: 'Open the new channel form.', example: '/new-channel', group: 'Create' },
  { usage: '/search <query>', description: 'Find threads by title, content, or author.', example: '/search docker deploy', group: 'Threads' },
  { usage: '/sort active|new', description: 'Sort threads by activity or creation date.', example: '/sort active', group: 'Threads' },
  { usage: '/status', description: 'Show the application connection status.', example: '/status', group: 'System' },
  { usage: '/logout', description: 'Sign out of your account.', example: '/logout', group: 'Account' },
]

export function executeAppCommand(raw: string, actions: AppCommandActions): string | null {
  const [command = '', ...argumentsList] = raw.trim().split(/\s+/)
  const name = command.replace(/^\/+/, '').toLowerCase()
  const argument = argumentsList.join(' ')

  switch (name) {
    case 'help':
    case '?':
      return 'help'
    case 'home':
      actions.navigate('home')
      return null
    case 'forum':
    case 'discussions':
    case 'threads':
      actions.navigate('discussions')
      return null
    case 'channels':
      actions.navigate('channels')
      return null
    case 'chats':
      actions.navigate('chats')
      return null
    case 'people':
      actions.navigate('contacts')
      return null
    case 'profile':
      actions.openProfile()
      return null
    case 'new-thread':
      actions.createThread()
      return null
    case 'new-channel':
      actions.createChannel()
      return null
    case 'search':
      actions.searchThreads(argument)
      return null
    case 'sort':
      if (argument === 'active' || argument === 'new') {
        actions.sortThreads(argument)
        return null
      }
      return 'Usage: /sort active or /sort new'
    case 'status':
      return actions.status()
    case 'logout':
      actions.logout()
      return null
    default:
      return `Unknown command: ${command || '(empty)'}. Enter /help to view the command reference.`
  }
}
