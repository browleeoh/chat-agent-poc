import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  videoId: string;
  videoPath: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoPlayer({
  videoId,
  videoPath,
  isOpen,
  onClose,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onClose();
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 1.5;
    }
  }, [videoId]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{videoPath}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full h-auto max-h-[70vh] rounded-md"
            controls
            autoPlay
            muted={false}
          >
            <source src={`/videos/${videoId}`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
}
