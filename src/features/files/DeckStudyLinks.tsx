import { routes } from '../../app/routes';

export function DeckStudyLinks({ fileId }: { fileId: string }) {
  return <div className="deck-study-links">
    <a className="file-list-study-link" href={routes.flatFlashcards(fileId)}>2D</a>
    <a className="file-list-study-link" href={routes.flashcards(fileId)}>3D</a>
  </div>;
}
