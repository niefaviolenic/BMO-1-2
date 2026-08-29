export type PluginItemData = {
  id: string;
  title: string;
  description: string;
  iconBgColor: string;
  fallbackText: string;
  actionType: 'add' | 'more' | 'chevron';
  isInstalled?: boolean;
  category: 'featured' | 'productivity';
};

export const INSTALLED_PLUGINS_LIST: Array<{ id: string; name: string }> = [];

export const FEATURED_PLUGINS: PluginItemData[] = [
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    description: 'Messaging, voice notes, and media',
    iconBgColor: '#25D366',
    fallbackText: 'WA',
    actionType: 'add',
    category: 'featured',
  },
  {
    id: 'spotify',
    title: 'Spotify',
    description: 'Play music and control playback',
    iconBgColor: '#1DB954',
    fallbackText: 'Sp',
    actionType: 'add',
    category: 'featured',
  },
];

export const PRODUCTIVITY_PLUGINS: PluginItemData[] = [];
