/** Transient host message (e.g. "Controller connected"), announced politely. */
export function Toast({ message }: { message: string | null }) {
  return (
    <div className="toast-region" aria-live="polite" role="status">
      {message !== null && <p className="toast">{message}</p>}
    </div>
  );
}
