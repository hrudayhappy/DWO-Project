import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource-variable/google-sans-flex/opsz.css";
import "./globals.css";
import "./landing.css";

export const metadata = {
  title: "Ambidexterity Analyzer",
  description: "Diagnoses how well an organization balances exploration and exploitation, using public company documents and four organization-theory frameworks.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
