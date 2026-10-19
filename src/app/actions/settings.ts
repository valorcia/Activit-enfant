"use server";
import { revalidatePath } from "next/cache";
import { saveAiSettings } from "@/lib/settings";

export async function saveSettingsAction(input: unknown) {
  await saveAiSettings(input);
  revalidatePath("/settings");
}
