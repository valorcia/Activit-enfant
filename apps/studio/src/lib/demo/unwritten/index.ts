/** Manuscrits de démonstration UNWRITTEN (un par collection), rédigés à la main. */
import type { EditorialFormatKey } from "@/lib/editorial/grid";
import type { ManuscriptInput } from "@/lib/editorial/manuscript";
import { BEFORE_TOO_LATE_DEMO } from "./before-too-late";
import { MOVIE_OF_MY_LIFE_DEMO } from "./movie-of-my-life";
import { SECRET_BOOK_DEMO } from "./secret-book";

export { BEFORE_TOO_LATE_DEMO, MOVIE_OF_MY_LIFE_DEMO, SECRET_BOOK_DEMO };

export const UNWRITTEN_DEMOS: { slug: string; manuscript: ManuscriptInput; format: EditorialFormatKey }[] = [
  { slug: "secret-book", manuscript: SECRET_BOOK_DEMO, format: "A5" },
  { slug: "before-too-late", manuscript: BEFORE_TOO_LATE_DEMO, format: "SQUARE" },
  { slug: "movie-of-my-life", manuscript: MOVIE_OF_MY_LIFE_DEMO, format: "PORTRAIT_3_4" },
];
