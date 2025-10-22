import TerminalSetupPage from "@/components/terminal";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LocalePage({ params }: Props) {
  const { locale } = await params;

  if (!locale) {
    notFound();
  }

  const t = await getTranslations("welcome");

  return (
    <div>
      <TerminalSetupPage locale={locale} />
      <h1>{t("message")}</h1>
    </div>
  );
}
