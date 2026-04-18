import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Camera, X, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { playScanSound } from "@/lib/audio";

interface Props {
  onScan: (upc: string) => void;
}

export function BarcodeScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [active, setActive] = useState(false);
  const [scannedCode, setScannedCode] = useState<string>("");
  const [scannedFormat, setScannedFormat] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
    setScannedCode("");
    setScannedFormat("");
    setIsProcessing(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setActive(true);
    setScannedCode("");
    setScannedFormat("");
    try {
      const reader = new BrowserMultiFormatReader();
      // Configure reader for high UPC/EAN accuracy
      reader.setOptions({
        formats: [
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.ISBN_13,
          BarcodeFormat.ISBN_10,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
        ],
        tryHarder: true,
        pure: false,
      });
      readerRef.current = reader;
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        async (result, err) => {
          if (result && !isProcessing) {
            const text = result.getText();
            const format = result.getBarcodeFormat();

            // Only process UPC, EAN, ISBN, QR, and Code formats
            const validFormats = [
              "UPC_A",
              "UPC_E",
              "EAN_13",
              "EAN_8",
              "ISBN_13",
              "ISBN_10",
              "QR_CODE",
              "CODE_128",
              "CODE_39",
            ];

            if (validFormats.some((f) => format.toString().includes(f))) {
              setIsProcessing(true);
              setScannedCode(text);
              setScannedFormat(format.toString());
              await playScanSound();
              setTimeout(() => {
                stop();
                onScan(text);
              }, 500);
            }
          }
          if (err && err.name !== "NotFoundException") {
            // ignore non-fatal
          }
        },
      );
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
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg border bg-black">
            <video ref={videoRef} className="aspect-video w-full" muted playsInline />
            {/* Scanning line */}
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-destructive/80" />

            {/* Guide corners */}
            <div className="pointer-events-none absolute inset-x-8 top-1/4 h-8 w-8 border-l-2 border-t-2 border-yellow-400/70" />
            <div className="pointer-events-none absolute inset-x-8 top-1/4 right-auto h-8 w-8 border-r-2 border-t-2 border-yellow-400/70" />
            <div className="pointer-events-none absolute inset-x-8 bottom-1/4 h-8 w-8 border-l-2 border-b-2 border-yellow-400/70" />
            <div className="pointer-events-none absolute inset-x-8 bottom-1/4 right-auto h-8 w-8 border-r-2 border-b-2 border-yellow-400/70" />

            {/* Scanned code display */}
            {scannedCode && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                <CheckCircle className="h-12 w-12 text-green-400 animate-pulse" />
                <div className="text-center">
                  <p className="text-sm text-gray-300">Barcode detected</p>
                  <p className="text-lg font-mono font-bold text-green-400">{scannedCode}</p>
                  <p className="text-xs text-gray-400">{scannedFormat}</p>
                </div>
              </div>
            )}
          </div>

          {/* Scanning hint */}
          {!scannedCode && (
            <p className="text-center text-sm text-gray-500">
              Hold barcode 6-12 inches from camera, aligned with red line
            </p>
          )}

          <Button type="button" variant="outline" onClick={stop} className="w-full">
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
