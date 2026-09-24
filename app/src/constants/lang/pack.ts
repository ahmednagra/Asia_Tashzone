import type { Translation } from "../../i18n";
import type { ErrorCodes, GamesData } from "../games";
import type { RulesText } from "../rules";
import type { HowToText } from "../howto";
import type { AtlasText } from "../atlas";

export interface LangPack {
  data: Translation<GamesData>;
  errors: Translation<ErrorCodes>;
  rules: RulesText;
  howto: HowToText;
  atlas: Translation<AtlasText>;
}
