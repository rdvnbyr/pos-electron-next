import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { Button } from "flowbite-react";
import { Menu } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  return {
    title:
      localeParam === "de" ? "POS Terminal Einrichtung" : "POS Terminal Setup",
    description:
      localeParam === "de"
        ? "Beschreibung für die deutsche Version"
        : "Description for the English version",
  };
}

async function MainLayout({ children, params }: LayoutProps) {
  const { locale: localeParam } = await params;

  console.log("Locale in layout:", localeParam);

  if (!localeParam) {
    // Fallback to default locale if resolution fails
  }
  return (
    <div className="app-shell">
      <header
        className="app-header"
        style={{ marginBottom: "4rem", height: "fit-content" }}
      >
        <nav className="bg-white dark:bg-gray-900 fixed w-full z-20 top-0 start-0 border-b border-gray-200 dark:border-gray-600">
          <div className="max-w-7xl flex flex-wrap items-center justify-between mx-auto p-4">
            <a
              href="https://flowbite.com/"
              className="flex items-center space-x-3 rtl:space-x-reverse"
            >
              <Image
                src="https://flowbite.com/docs/images/logo.svg"
                width={80}
                height={80}
                className="h-8"
                alt="Flowbite Logo"
              ></Image>
              <span className="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">
                Flowbite
              </span>
            </a>
            <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
              <Button size="md">Get started</Button>
              <Button
                color={"default"}
                data-collapse-toggle="navbar-sticky"
                className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                aria-controls="navbar-sticky"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
                <Menu size={20} strokeWidth={1.25} absoluteStrokeWidth />
              </Button>
            </div>
            <div
              className="items-center justify-between hidden w-full md:flex md:w-auto md:order-1"
              id="navbar-sticky"
            >
              <ul className="flex flex-col p-4 md:p-0 mt-4 font-medium border border-gray-100 rounded-lg bg-gray-50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-white dark:bg-gray-800 md:dark:bg-gray-900 dark:border-gray-700">
                <li>
                  <a
                    href="#"
                    className="block py-2 px-3 text-white bg-blue-700 rounded-sm md:bg-transparent md:text-blue-700 md:p-0 md:dark:text-blue-500"
                    aria-current="page"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="block py-2 px-3 text-gray-900 rounded-sm hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700 md:p-0 md:dark:hover:text-blue-500 dark:text-white dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent dark:border-gray-700"
                  >
                    Terminal
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}

export default MainLayout;
