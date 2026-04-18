import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onScan: (upc: string) => void;
}

export function BarcodeScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [active, setActive] = useState(false);

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setActive(true);
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result) {
          const text = result.getText();
          stop();
          onScan(text);
        }
        if (err && err.name !== "NotFoundException") {
          // ignore non-fatal
        }
      });
      controlsRef.current = controls;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Camera error");
      setActive(false);
    }
  };

  return (
    <div className="space-y-2">
      {!active ? (
        <Button type="button" onClick={start} className="w-full" size="lg">
          <Camera className="h-5 w-5" /> Scan barcode
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border bg-black">
            <video ref={videoRef} className="aspect-video w-full" muted playsInline />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-destructive/80" />
          </div>
          <Button type="button" variant="outline" onClick={stop} className="w-full">
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
