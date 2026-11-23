import { adminAuth } from "../api";
import { useI18n } from "../i18n";
import PinScreen from "./PinScreen";

interface Props {
  onAuth: (pin: string) => void;
}

export default function AdminLogin({ onAuth }: Props) {
  const { t } = useI18n();
  return <PinScreen title={t("loginTitle")} verify={adminAuth} onAuth={onAuth} />;
}
