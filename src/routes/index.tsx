import { createFileRoute } from "@tanstack/react-router";
import { RemoteCameraAgent } from "@/features/remote-camera/RemoteCameraAgent";
import { CabineApp } from "@/modes/cabine/CabineApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bohemia Photo Booth — Cabine" },
      { name: "description", content: "Cabine de fotos touchscreen: guarde esse momento." },
      { property: "og:title", content: "Bohemia Photo Booth — Cabine" },
      { property: "og:description", content: "Cabine de fotos touchscreen: guarde esse momento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicBooth,
});

function PublicBooth() {
  return (
    <>
      <RemoteCameraAgent />
      <CabineApp />
    </>
  );
}
