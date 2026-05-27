import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Play, Download, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { getUserPalletVideos, getSignedVideoUrl, type VideoRecord } from "@/lib/video-access";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/videos")({
  head: () => ({ meta: [{ title: "Pallet Videos — PalletPal" }] }),
  component: () => (
    <RequireAuth>
      <VideosPage />
    </RequireAuth>
  ),
});

interface VideoWithUrl extends VideoRecord {
  signedUrl?: string;
}

function VideosPage() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoWithUrl | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const userVideos = await getUserPalletVideos();

      // Generate signed URLs for each video
      const videosWithUrls = await Promise.all(
        userVideos.map(async (video) => {
          if (video.video_path) {
            const signedUrl = await getSignedVideoUrl(video.video_path);
            return { ...video, signedUrl: signedUrl || undefined };
          }
          return video;
        }),
      );

      setVideos(videosWithUrls);
    } catch (error) {
      console.error("Error loading videos:", error);
      toast.error("Failed to load videos");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (video: VideoWithUrl) => {
    if (!video.signedUrl) {
      toast.error("Video URL expired. Please refresh.");
      return;
    }

    try {
      const response = await fetch(video.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pallet-${video.upc || video.id}-${new Date().toISOString()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading video:", error);
      toast.error("Failed to download video");
    }
  };

  const filteredVideos = videos.filter(
    (v) =>
      (v.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (v.upc?.includes(searchTerm) ?? false) ||
      (v.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
  );

  if (selectedVideo) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelectedVideo(null)} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Videos
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{selectedVideo.product_name || `UPC: ${selectedVideo.upc}`}</CardTitle>
            <CardDescription>
              {selectedVideo.warehouse_name}{" "}
              {new Date(selectedVideo.captured_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedVideo.signedUrl ? (
              <video controls className="w-full rounded-lg bg-black" style={{ maxHeight: "500px" }}>
                <source src={selectedVideo.signedUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="p-8 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                Video URL expired. Please go back and try again.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">AI Count</p>
                <p className="font-semibold text-lg">{selectedVideo.ai_count ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Final Count</p>
                <p className="font-semibold text-lg">{selectedVideo.final_count ?? "—"}</p>
              </div>
            </div>

            {selectedVideo.notes && (
              <div>
                <p className="text-sm font-medium">Notes</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedVideo.notes}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {selectedVideo.signedUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(selectedVideo)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ to: `/pallets/${selectedVideo.id}` })}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Pallet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pallet Videos</h1>
        <p className="text-muted-foreground mt-2">
          Access and review videos from your pallet inventory captures.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {videos.length === 0 ? (
              <p>No pallet videos yet. Start capturing pallets to see videos here.</p>
            ) : (
              <p>No videos match your search.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <Input
              placeholder="Search by product, UPC, or warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVideos.map((video) => (
              <Card
                key={video.id}
                className="hover:border-primary/50 cursor-pointer transition"
                onClick={() => setSelectedVideo(video)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base line-clamp-2">
                        {video.product_name || `UPC: ${video.upc}`}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {video.warehouse_name}
                      </CardDescription>
                    </div>
                    <Play className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {new Date(video.captured_at).toLocaleDateString()}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted p-2 rounded">
                      <p className="text-muted-foreground">AI Count</p>
                      <p className="font-semibold">{video.ai_count ?? "—"}</p>
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <p className="text-muted-foreground">Final</p>
                      <p className="font-semibold">{video.final_count ?? "—"}</p>
                    </div>
                  </div>

                  <Badge variant="outline" className="w-full justify-center text-xs capitalize">
                    {video.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
