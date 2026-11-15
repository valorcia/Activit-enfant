/** Valeur du formulaire de proposition (partagée entre pages serveur et formulaire client). */
export interface SubmissionFormValue {
  title: string;
  ageMin: string;
  ageMax: string;
  durationMinutes: string;
  materials: string;
  steps: string[];
  tips: string;
  safetyNotes: string;
  contribution: "IDEA" | "FULL_TUTORIAL";
  exclusive: boolean;
  photos: Array<{ key: string; width?: number; height?: number; size?: number; preview: string }>;
}

export const emptySubmission = (): SubmissionFormValue => ({ title: "", ageMin: "", ageMax: "", durationMinutes: "", materials: "", steps: ["", ""], tips: "", safetyNotes: "", contribution: "IDEA", exclusive: false, photos: [] });
