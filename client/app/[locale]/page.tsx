import TerminalSetupPage from "@/components/terminal";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LocalePage({ params }: Props) {
  const { locale } = await params;

  if (!locale) {
    notFound();
  }

  return (
    <div>
      <TerminalSetupPage locale={locale} />
    </div>
  );
}
