"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Lock, Save } from "lucide-react";
import { updateCreatorProfileAction } from "@/app/actions/creator";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { uploadCreatorImage } from "./image-upload";

export interface ProfileView { publicName: string; bio: string; photoUrl: string | null; ibanMasked: string | null; ibanHolder: string }

export function ProfileForm({ initial }: { initial: ProfileView }) {
  const router = useRouter();
  const [publicName, setPublicName] = useState(initial.publicName);
  const [bio, setBio] = useState(initial.bio);
  const [photo, setPhoto] = useState<{ url: string; key: string } | null | undefined>(undefined);
  const [iban, setIban] = useState("");
  const [holder, setHolder] = useState(initial.ibanHolder);
  const [editIban, setEditIban] = useState(!initial.ibanMasked);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const shownPhoto = photo === undefined ? initial.photoUrl : photo?.url ?? null;

  async function onPhoto(file: File) {
    setUploading(true);
    try {
      const up = await uploadCreatorImage(file, "avatar");
      setPhoto({ url: up.url ?? "", key: up.key });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de l'envoi"); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <form className="space-y-6" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await updateCreatorProfileAction({ publicName, bio, ...(photo !== undefined ? { photo } : {}), iban: editIban ? iban : "", ibanHolder: holder });
        if (r.ok) { toast.success("Profil enregistré"); setErrors({}); setIban(""); if (r.data.ibanLast4) setEditIban(false); router.refresh(); }
        else { setErrors(r.fieldErrors ?? {}); toast.error(r.error); }
      });
    }}>
      <section className="card-soft space-y-4 p-5 sm:p-6">
        <h2 className="font-heading text-xl font-bold">Profil public</h2>
        <p className="text-sm text-ink-soft">Votre pseudo et votre présentation apparaissent sur vos tutoriels (« Une idée de … ») et sur votre page créatrice. Votre nom et votre e-mail restent privés.</p>
        <div className="flex items-center gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-full bg-ink/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {shownPhoto ? <img src={shownPhoto} alt="" className="size-full object-cover" /> : <Camera className="m-6 size-8 text-ink-muted" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? "Envoi…" : shownPhoto ? "Changer la photo" : "Ajouter une photo"}</Button>
            {shownPhoto && <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(null)}>Retirer</Button>}
            <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void onPhoto(e.target.files[0])} />
          </div>
        </div>
        <Field label="Pseudo" htmlFor="p-name" error={errors.publicName?.[0]} hint="Par exemple « Marie des Bois » ou « Atelier de Lou »"><Input id="p-name" value={publicName} onChange={(e) => setPublicName(e.target.value)} required maxLength={40} /></Field>
        <Field label="Présentation (facultatif)" htmlFor="p-bio" error={errors.bio?.[0]}><Textarea id="p-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600} placeholder="Maman de deux enfants, j'adore les bricolages nature…" /></Field>
      </section>

      <section className="card-soft space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold"><Lock className="size-5" /> Coordonnées de paiement</h2>
        <p className="text-sm text-ink-soft">Vos commissions sont versées par virement. Votre IBAN est chiffré : il n&apos;est plus jamais affiché en entier, même à vous.</p>
        {!editIban && initial.ibanMasked ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
            <div><p className="text-xs font-bold text-ink-muted">IBAN enregistré</p><p className="font-mono text-sm">{initial.ibanMasked}</p></div>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditIban(true)}>Remplacer</Button>
          </div>
        ) : (
          <Field label="IBAN" htmlFor="p-iban" error={errors.iban?.[0]} hint="Ex. FR76 3000 6000 0112 3456 7890 189"><Input id="p-iban" value={iban} onChange={(e) => setIban(e.target.value)} autoComplete="off" inputMode="text" spellCheck={false} className="font-mono uppercase" /></Field>
        )}
        <Field label="Titulaire du compte" htmlFor="p-holder" error={errors.ibanHolder?.[0]}><Input id="p-holder" value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="name" maxLength={120} /></Field>
      </section>

      <Button type="submit" size="lg" disabled={pending || uploading} className="w-full sm:w-auto"><Save className="size-5" /> {pending ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}
