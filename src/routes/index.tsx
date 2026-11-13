import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
  head: () => ({ meta: [
    { title: "GVN Trailer — Üretim Takip" },
    { name: "description", content: "GVN Trailer üretim, makine performansı ve stok takip sistemi." },
    { property: "og:title", content: "GVN Trailer — Üretim Takip" },
    { property: "og:description", content: "Üretim, OEE ve stok yönetimi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function IndexRedirect() {
  const { loading, session, role } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/giris" replace />;
  void role;
  return <Navigate to="/panel" replace />;
}

