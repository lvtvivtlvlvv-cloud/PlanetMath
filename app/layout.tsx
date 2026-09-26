import "./globals.css";
import { ThemeProviderWrapper } from "@/components/theme-context";

export const metadata = {
  title: "Школьный дневник и расписание",
  description: "Система электронного расписания занятий",
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
                const t = localStorage.getItem('app-theme') || 'base';
                document.documentElement.setAttribute('data-theme', t);
                if (t === 'clock' || t === 'garden' || t === 'standart-plus') {
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
        {/* ВОЗВРАЩЕН ГЛУБОКИЙ ТЕМНЫЙ ОБСИДИАНОВЫЙ АМБИЕНТ-ФОН */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#06080D]">
          {/* Верхняя глубокая циановая туманность */}
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[950px] rounded-full blur-[140px] opacity-20"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(34, 211, 238, 0.45) 0%, rgba(16, 185, 129, 0.2) 40%, transparent 75%)",
            }}
          />

          {/* Правая космическая лазурь */}
          <div
            className="absolute top-1/2 -right-36 h-[550px] w-[550px] rounded-full blur-[150px] opacity-15"
            style={{
              background:
                "radial-gradient(circle, rgba(14, 165, 233, 0.35) 0%, rgba(99, 102, 241, 0.15) 55%, transparent 75%)",
            }}
          />

          {/* Левое изумрудное сияние */}
          <div
            className="absolute -bottom-36 -left-36 h-[550px] w-[550px] rounded-full blur-[150px] opacity-15"
            style={{
              background:
                "radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(56, 189, 248, 0.15) 55%, transparent 75%)",
            }}
          />

          {/* Тонкая сетка для преломления в матовом стекле */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
        </div>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <div className="relative z-10">
          <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
        </div>
      </body>
    </html>
  );
}