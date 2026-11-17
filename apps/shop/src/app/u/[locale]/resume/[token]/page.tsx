import type { Metadata } from "next";
import { consumeResumeAction } from "@/app/actions/unwritten";
import { brandFromParams } from "@/lib/unwritten/brand";
import { getDictionary } from "@/lib/unwritten/i18n";
import { PRIVATE_ROBOTS } from "@/lib/unwritten/seo";
import { fromUrlToken, verifyResumeToken } from "@/lib/unwritten/tokens";

type Props = { params: Promise<{ locale: string; token: string }>; searchParams: Promise<{ e?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await brandFromParams(params);
  return { title: getDictionary(locale).resume.title, robots: PRIVATE_ROBOTS, referrer: "no-referrer" };
}

/** Reprise par lien magique : le jeton n'est consommé qu'au clic (pas à l'ouverture du lien). */
export default async function ResumePage({ params, searchParams }: Props) {
  const { locale } = await brandFromParams(params);
  const { token } = await params;
  const { e } = await searchParams;
  const dict = getDictionary(locale).resume;
  const valid = !e && !!verifyResumeToken(fromUrlToken(token));
  return (
    <section className="uw-section">
      <div className="uw-narrow text-center">
        <span className="uw-rule mx-auto" />
        <h1 className="uw-h1 mt-10">{dict.title}</h1>
        {valid ? (
          <>
            <p className="uw-lead mx-auto mt-6">{dict.lead}</p>
            <form action={consumeResumeAction} className="mt-10 flex justify-center">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="token" value={fromUrlToken(token)} />
              <button type="submit" className="uw-btn">{dict.cta} <span aria-hidden className="uw-arrow">→</span></button>
            </form>
          </>
        ) : (
          <p role="alert" className="uw-lead mx-auto mt-6">{e === "used" ? dict.used : dict.invalid}</p>
        )}
      </div>
    </section>
  );
}
