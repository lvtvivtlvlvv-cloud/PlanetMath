import "./globals.css";
import { ThemeProviderWrapper } from "@/components/theme-context";

export const metadata = {
  title: "PlanetMath - Школьный дневник и расписание",
  description: "Система электронного расписания занятий и школьного дневника для учеников и преподавателей",
  openGraph: {
    title: "PlanetMath - Школьный дневник и расписание",
    description: "Система электронного расписания занятий и школьного дневника для учеников и преподавателей",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const raw = localStorage.getItem('app-theme') || 'standart';
                const t = raw === 'standart-plus' ? 'standart' : raw;
                document.documentElement.setAttribute('data-theme', t);
                if (t === 'clock' || t === 'garden' || t === 'standart' || t === 'standart-plus') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-mode', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-mode', 'light');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="relative min-h-screen overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* АМБИЕНТ-ФОН БЕЗ ТЯЖЕЛЫХ BLUR-СЛОЕВ ДЛЯ ИСКЛЮЧЕНИЯ ПЕРЕГРУЗКИ GPU НА IOS SAFARI */}
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#06080D]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 900px 480px at 50% -12%, rgba(34, 211, 238, 0.12) 0%, transparent 70%),
              radial-gradient(circle 600px at 100% 50%, rgba(14, 165, 233, 0.08) 0%, transparent 70%),
              radial-gradient(circle 600px at 0% 100%, rgba(16, 185, 129, 0.08) 0%, transparent 70%),
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: "100% 100%, 100% 100%, 100% 100%, 44px 44px, 44px 44px",
          }}
        />

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <div className="relative z-10" suppressHydrationWarning>
          <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
        </div>
      </body>
    </html>
  );
}