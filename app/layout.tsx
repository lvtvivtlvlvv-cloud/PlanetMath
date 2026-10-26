import "./globals.css";
import "katex/dist/katex.min.css";
import { ThemeProviderWrapper } from "@/components/theme-context";

export const metadata = {
  title: "PlanetMath - Школьный дневник и расписание",
  description: "Система электронного расписания занятий и школьного дневника для учеников и преподавателей",
  openGraph: {
    title: "PlanetMath - Школьный дневник и расписание",
    description: "Система электронного расписания занятий и школьного дневника для учеников и преподавателей",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning className="max-w-full overflow-x-hidden">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const mode = localStorage.getItem('planet-color-mode') === 'light' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', 'planet');
                document.documentElement.setAttribute('data-mode', mode);
                if (mode === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="relative min-h-screen w-full max-w-full overflow-x-hidden selection:bg-sky-500/30 selection:text-sky-700 dark:selection:text-cyan-200">
        {/* АМБИЕНТ-ФОН ТЕМЫ PLANET (АДАПТИРУЕТСЯ ПОД DARK / LIGHT РЕЖИМ) */}
        <div className="planet-ambient-bg fixed inset-0 pointer-events-none z-0 overflow-hidden transition-colors duration-300" />

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <div className="relative z-10 w-full max-w-full overflow-x-hidden" suppressHydrationWarning>
          <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
        </div>
      </body>
    </html>
  );
}