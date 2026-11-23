import { speakerAuth } from "../api";
import { useI18n } from "../i18n";
import PinScreen from "./PinScreen";

interface Props {
  onAuth: (pin: string) => void;
}

export default function SpeakerLogin({ onAuth }: Props) {
  const { t } = useI18n();
  return (
    <PinScreen title={t("speakerLoginTitle")} verify={speakerAuth} onAuth={onAuth} />
  );
}
