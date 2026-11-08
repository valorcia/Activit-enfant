"use server";
import { revalidatePath } from "next/cache";
import { createAdVideos, deleteAdVideo, sendAdVideoToShop, storeMusic, animationPromptFor } from "@/lib/video/service";
import { getVideoSettings, saveVideoSettings } from "@/lib/settings";

export type VideoActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function msg(e: unknown) {
  if (e && typeof e === "object" && "issues" in e && Array.isArray((e as { issues: unknown[] }).issues)) {
    return ((e as { issues: Array<{ message: string }> }).issues.map((i) => i.message).join(" · ")) || "Formulaire invalide";
  }
  return e instanceof Error ? e.message : String(e);
}

function revalidate(bookId?: string) {
  revalidatePath("/videos");
  revalidatePath("/jobs");
  if (bookId) revalidatePath(`/books/${bookId}`);
}

export async function createAdVideosAction(bookId: string, input: unknown): Promise<VideoActionResult<{ count: number }>> {
  try {
    const ids = await createAdVideos(bookId, input);
    revalidate(bookId);
    return { ok: true, data: { count: ids.length } };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function deleteAdVideoAction(id: string, bookId?: string): Promise<void> {
  await deleteAdVideo(id);
  revalidate(bookId);
}

export async function sendAdVideoToShopAction(id: string, bookId?: string): Promise<VideoActionResult<{ url: string }>> {
  try {
    const r = await sendAdVideoToShop(id);
    revalidate(bookId);
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function uploadMusicAction(formData: FormData): Promise<VideoActionResult<{ assetId: string; name: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier reçu" };
  if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name)) return { ok: false, error: "Format accepté : MP3, M4A, WAV ou OGG" };
  try {
    const asset = await storeMusic(file);
    if (formData.get("setDefault") === "1") {
      const s = await getVideoSettings();
      await saveVideoSettings({ ...s, runwayApiKey: "", defaultMusicAssetId: asset.id });
      revalidatePath("/settings");
    }
    return { ok: true, data: { assetId: asset.id, name: file.name } };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Prompt de mouvement recalculé (changement d'illustration ou de durée). */
export async function animationPromptAction(description: string | null, universe: string | null, durationSeconds: 5 | 10): Promise<string> {
  return animationPromptFor(description, universe ?? undefined, durationSeconds);
}

export async function saveVideoSettingsAction(input: unknown): Promise<VideoActionResult> {
  try {
    await saveVideoSettings(input);
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
