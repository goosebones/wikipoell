import "./globals.css";
import CategoriesMenu from "@/components/categories-menu";

export default async function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="mb-10 mx-1 mt-1">
        <CategoriesMenu />
        {/* Main content */}
        {children}
      </body>
    </html>
  );
}
