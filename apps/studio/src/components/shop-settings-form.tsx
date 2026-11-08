"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { saveShopSettingsAction, testShopConnectionAction } from "@/app/actions/shop";
import { SHOP_TEMPLATES } from "@/lib/schemas/settings";
import type { ShopSettingsPublic } from "@/lib/settings";

const TEMPLATE_LABELS: Record<(typeof SHOP_TEMPLATES)[number], string> = { ADVENTURE: "Aventure / chasse au trésor", ACTIVITY: "Cahier d'activités", STORY: "Histoire / e-book", EVENT: "Kit événement", CLASSIC: "Fiche classique" };

export function ShopSettingsForm({ initial }: { initial: ShopSettingsPublic }) {
  const [s, setS] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const next = await saveShopSettingsAction({ ...s, shopApiKey: apiKey });
          setS(next);
          setApiKey("");
          setMessage({ ok: true, text: "Réglages boutique enregistrés." });
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Boutique (La Malle à Jeux)</h2>
          <p className="text-sm text-slate-600">À chaque export PDF d'un livre, sa fiche produit et sa landing page sont créées puis publiées automatiquement dans la boutique.</p>
        </div>
        <Badge variant={s.shopConfigured ? "success" : "secondary"}>{s.shopConfigured ? "Connectée" : "Non configurée"}</Badge>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <Field label="URL de la boutique" hint="Sans slash final, ex. https://activite-enfant-shop.vercel.app">
          <Input value={s.shopApiUrl} onChange={(e) => setS({ ...s, shopApiUrl: e.target.value })} placeholder="https://…" />
        </Field>
        <Field label="Clé API" hint={s.shopApiKeyPreview ? `Clé enregistrée : ${s.shopApiKeyPreview} — laisser vide pour la conserver.` : "Créée dans la boutique : Administration → API & automatisation (scopes products:write et products:publish)."}>
          <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={s.shopApiKeyPreview ? "••••••••" : "cc_…"} />
        </Field>
        <Field label="Publication" hint="En brouillon, la fiche attend une validation dans la boutique avant d'être visible.">
          <Select value={s.autoPublish ? "1" : "0"} onChange={(e) => setS({ ...s, autoPublish: e.target.value === "1" })}>
            <option value="1">Publier immédiatement après chaque export</option>
            <option value="0">Créer la fiche en brouillon (validation humaine)</option>
          </Select>
        </Field>
        <Field label="Prix par défaut (€ TTC)">
          <Input type="number" min={0} step="0.1" value={(s.defaultPriceCents / 100).toFixed(2)} onChange={(e) => setS({ ...s, defaultPriceCents: Math.round(Number(e.target.value) * 100) })} />
        </Field>
        <Field label="Catégorie par défaut (slug boutique)" hint="Ex. histoires-et-aventures, activites-educatives, chasses-au-tresor, evenements.">
          <Input value={s.defaultCategorySlug} onChange={(e) => setS({ ...s, defaultCategorySlug: e.target.value })} />
        </Field>
        <Field label="Modèle de fiche par défaut">
          <Select value={s.defaultTemplate} onChange={(e) => setS({ ...s, defaultTemplate: e.target.value as ShopSettingsPublic["defaultTemplate"] })}>
            {SHOP_TEMPLATES.map((t) => <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>)}
          </Select>
        </Field>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Button type="submit" disabled={pending}>Enregistrer</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => {
          const r = await testShopConnectionAction();
          setMessage(r.ok ? { ok: true, text: `Connexion réussie : ${r.categories} catégorie(s), ${r.collections} collection(s).` } : { ok: false, text: `Connexion impossible : ${r.error}` });
        })}>Tester la connexion</Button>
        {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
      </div>
      <p className="text-xs text-slate-500">La clé est stockée côté serveur et n'est jamais renvoyée au navigateur. Variables d'environnement de repli : SHOP_API_URL et SHOP_API_KEY.</p>
    </form>
  );
}
