export const routes = {
  home: '/',
  newFile: '/files/new',
  data: '/data',
  settings: '/settings',
  file: (fileId: string) => `/files/${fileId}`,
  flashcards: (fileId: string) => `/files/${fileId}/flashcards`,
  folder: (folderId: string) => `/folders/${folderId}`,
} as const;

export type AppRoute =
  | { name: 'home' }
  | { name: 'newFile' }
  | { name: 'data' }
  | { name: 'settings' }
  | { name: 'file'; fileId: string }
  | { name: 'flashcards'; fileId: string }
  | { name: 'folder'; folderId: string };

export function getCurrentRoute(pathname: string): AppRoute {
  if (pathname === routes.newFile) {
    return { name: 'newFile' };
  }

  if (pathname === routes.data) {
    return { name: 'data' };
  }

  if (pathname === routes.settings) {
    return { name: 'settings' };
  }

  if (pathname.startsWith('/files/') && pathname.endsWith('/flashcards')) {
    const fileId = pathname
      .slice('/files/'.length)
      .replace(/\/flashcards$/, '');

    if (fileId) {
      return { name: 'flashcards', fileId };
    }
  }

  if (pathname.startsWith('/files/')) {
    const fileId = pathname.slice('/files/'.length);

    if (fileId) {
      return { name: 'file', fileId };
    }
  }

  if (pathname.startsWith('/folders/')) {
    const folderId = pathname.slice('/folders/'.length);

    if (folderId) {
      return { name: 'folder', folderId };
    }
  }

  return { name: 'home' };
}
