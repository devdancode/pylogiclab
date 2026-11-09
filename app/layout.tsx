import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "LógicaLab | Aprenda a pensar em código", template: "%s | LógicaLab" },
  description:
    "Uma trilha gratuita e prática de lógica de programação e Python para quem está começando do zero. Projeto de extensão em Pirassununga, SP.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#principal">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
