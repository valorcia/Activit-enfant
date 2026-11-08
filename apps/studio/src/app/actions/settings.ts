"use server";
import { revalidatePath } from "next/cache";
import { saveAiSettings, saveStudioSettings } from "@/lib/settings";

export async function saveSettingsAction(input: unknown) {
  await saveAiSettings(input);
  revalidatePath("/settings");
}

export async function saveStudioSettingsAction(input: unknown) {
  await saveStudioSettings(input);
  revalidatePath("/", "layout");
}
