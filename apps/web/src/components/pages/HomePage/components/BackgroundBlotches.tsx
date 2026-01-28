/**
 * Decorative background blotches for the homepage.
 * Only visible in light mode.
 */
export function BackgroundBlotches() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* Base background */}
      <div className="absolute inset-0 bg-background" />
      {/* Blotches - only visible in light mode */}
      <div className="dark:hidden">
        {/* Green blotch - top left */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_800px_600px_at_5%_10%,_rgba(16,185,129,0.15),_transparent_50%)]" />
        {/* Teal blotch - top right */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_500px_at_90%_5%,_rgba(20,184,166,0.12),_transparent_50%)]" />
        {/* Blue blotch - center right */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_700px_550px_at_85%_45%,_rgba(59,130,246,0.12),_transparent_50%)]" />
        {/* Purple blotch - bottom left */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_650px_600px_at_10%_75%,_rgba(139,92,246,0.12),_transparent_50%)]" />
        {/* Green blotch - bottom right */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_550px_500px_at_80%_90%,_rgba(16,185,129,0.1),_transparent_50%)]" />
        {/* Teal blotch - center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_500px_500px_at_50%_35%,_rgba(6,182,212,0.08),_transparent_50%)]" />
      </div>
    </div>
  );
}
