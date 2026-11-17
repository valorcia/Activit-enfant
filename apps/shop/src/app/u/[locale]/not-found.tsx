import Link from "next/link";

/** Page introuvable de la vitrine UNWRITTEN (textes bilingues : la langue n'est pas connue ici). */
export default function UnwrittenNotFound() {
  return (
    <section className="uw-section">
      <div className="uw-narrow text-center">
        <span className="uw-rule mx-auto" />
        <h1 className="uw-h2 mt-10">This page hasn&apos;t been written yet.</h1>
        <p className="uw-serif uw-italic mt-4 text-xl text-[var(--uw-muted)]">Cette page n&apos;a pas encore été écrite.</p>
        <div className="mt-10 flex justify-center gap-6">
          <Link href="/en" className="uw-textlink">Home</Link>
          <Link href="/fr" className="uw-textlink">Accueil</Link>
        </div>
      </div>
    </section>
  );
}
