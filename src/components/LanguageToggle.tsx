import { useI18n, Lang } from "../i18n";
import Segmented from "./Segmented";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <Segmented<Lang>
      label="Language"
      value={lang}
      onChange={setLang}
      options={[
        { value: "cs", label: "CS" },
        { value: "en", label: "EN" },
      ]}
    />
  );
}
