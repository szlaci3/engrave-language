import { getCurrentRoute } from './routes';
import { FileListPage } from '../features/files/FileListPage';
import { FileViewPage } from '../features/files/FileViewPage';
import { FlashcardsPage } from '../features/files/FlashcardsPage';
import { NewFilePage } from '../features/files/NewFilePage';
import { FolderFilesPage } from '../features/folders/FolderFilesPage';
import { DataPage } from '../features/data/DataPage';
import { SettingsPage } from '../features/settings/SettingsPage';

function App() {
  const currentRoute = getCurrentRoute(window.location.pathname);

  if (currentRoute.name === 'newFile') {
    return <NewFilePage />;
  }

  if (currentRoute.name === 'file') {
    return <FileViewPage fileId={currentRoute.fileId} />;
  }

  if (currentRoute.name === 'flashcards') {
    return <FlashcardsPage fileId={currentRoute.fileId} />;
  }

  if (currentRoute.name === 'folder') {
    return <FolderFilesPage folderId={currentRoute.folderId} />;
  }

  if (currentRoute.name === 'data') {
    return <DataPage />;
  }

  if (currentRoute.name === 'settings') {
    return <SettingsPage />;
  }

  return <FileListPage />;
}

export default App;
