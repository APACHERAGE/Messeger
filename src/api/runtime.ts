/** Public previews never probe or write to a server. Local application behavior is unchanged. */
export const isPublicPreview = import.meta.env.MODE === 'demo-preview'

export function browserStorageKey(feature: 'messenger' | 'profile' | 'contacts' | 'hub' | 'channels' | 'discussions' | 'mail') {
  return isPublicPreview ? `nightfall-public-demo-${feature}-v1` : `nightfall-${feature}-v1`
}
