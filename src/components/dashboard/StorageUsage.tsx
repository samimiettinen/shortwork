import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { HardDrive, FileVideo, FileImage, File } from "lucide-react";

interface StorageStats {
  totalBytes: number;
  fileCount: number;
  videoBytes: number;
  imageBytes: number;
  otherBytes: number;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Free tier estimate (1GB is typical for Supabase free tier)
const FREE_TIER_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB

export const StorageUsage = () => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStorageUsage = async () => {
      try {
        // Get user's workspace first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: memberships } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", session.user.id)
          .limit(1);

        if (!memberships || memberships.length === 0) return;

        const workspaceId = memberships[0].workspace_id;

        // List all files in the social-media bucket for this workspace
        const { data: files, error: listError } = await supabase.storage
          .from("social-media")
          .list(workspaceId, { limit: 1000 });

        if (listError) {
          console.error("Storage list error:", listError);
          setError("Unable to fetch storage data");
          setLoading(false);
          return;
        }

        let totalBytes = 0;
        let videoBytes = 0;
        let imageBytes = 0;
        let otherBytes = 0;

        (files || []).forEach((file) => {
          const size = file.metadata?.size || 0;
          totalBytes += size;

          const contentType = file.metadata?.mimetype || "";
          if (contentType.startsWith("video/")) {
            videoBytes += size;
          } else if (contentType.startsWith("image/")) {
            imageBytes += size;
          } else {
            otherBytes += size;
          }
        });

        setStats({
          totalBytes,
          fileCount: files?.length || 0,
          videoBytes,
          imageBytes,
          otherBytes,
        });
        setLoading(false);
      } catch (err) {
        console.error("Error fetching storage:", err);
        setError("Unable to fetch storage data");
        setLoading(false);
      }
    };

    fetchStorageUsage();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error || "No storage data available"}</p>
        </CardContent>
      </Card>
    );
  }

  const usagePercent = Math.min((stats.totalBytes / FREE_TIER_BYTES) * 100, 100);
  const remainingBytes = Math.max(FREE_TIER_BYTES - stats.totalBytes, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Storage Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">{formatBytes(stats.totalBytes)} used</span>
            <span className="text-muted-foreground">{formatBytes(remainingBytes)} remaining</span>
          </div>
          <Progress value={usagePercent} className="h-3" />
          <p className="text-xs text-muted-foreground mt-1">
            {usagePercent.toFixed(1)}% of {formatBytes(FREE_TIER_BYTES)} free tier
          </p>
        </div>

        {/* Breakdown by type */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <FileVideo className="w-4 h-4 text-info" />
            <div>
              <p className="text-xs text-muted-foreground">Videos</p>
              <p className="text-sm font-medium">{formatBytes(stats.videoBytes)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <FileImage className="w-4 h-4 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Images</p>
              <p className="text-sm font-medium">{formatBytes(stats.imageBytes)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <File className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Other</p>
              <p className="text-sm font-medium">{formatBytes(stats.otherBytes)}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {stats.fileCount} file{stats.fileCount !== 1 ? "s" : ""} in storage
        </p>
      </CardContent>
    </Card>
  );
};
