import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireCreatorWithContract } from "@/lib/creators/session";
import { maskIban } from "@/lib/creators/iban";
import { ProfileForm } from "@/components/creator/profile-form";
import { Alert } from "@/components/ui/misc";

export const metadata = { title: "Mon profil" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const [creator, sp] = await Promise.all([requireCreatorWithContract(), searchParams]);
  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-3xl font-bold">Mon profil</h1>
      {sp.bienvenue && <Alert variant="success" title="Bienvenue !" className="mt-4">Merci d&apos;avoir accepté le contrat. Choisissez votre pseudo, puis proposez votre première idée.</Alert>}
      {creator.slug && creator.status === "ACTIVE" && <p className="mt-2 text-sm"><Link href={`/createurs/${creator.slug}`} target="_blank" className="inline-flex items-center gap-1 font-bold text-coral-dark hover:underline">Voir ma page créatrice <ExternalLink className="size-3.5" /></Link></p>}
      <div className="mt-6">
        <ProfileForm initial={{ publicName: creator.publicName ?? "", bio: creator.bio ?? "", photoUrl: creator.photoUrl, ibanMasked: creator.ibanLast4 ? maskIban(creator.ibanLast4) : null, ibanHolder: creator.ibanHolder ?? "" }} />
      </div>
    </div>
  );
}
