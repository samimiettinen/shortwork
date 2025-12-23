import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HardDrive, FileVideo, FileImage, File, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface StorageFile {
  name: string;
  size: number;
  type: "video" | "image" | "other";
  path: string;
  createdAt: string;
}

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

const FREE_TIER_BYTES = 1 * 1024 * 1024 * 1024;

export const StorageUsage = () => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const fetchStorageUsage = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", session.user.id)
        .limit(1);

      if (!memberships || memberships.length === 0) return;

      const wsId = memberships[0].workspace_id;
      setWorkspaceId(wsId);

      const { data: storageFiles, error: listError } = await supabase.storage
        .from("social-media")
        .list(wsId, { limit: 1000 });

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
      const fileList: StorageFile[] = [];

      (storageFiles || []).forEach((file) => {
        if (!file.name || file.name === ".emptyFolderPlaceholder") return;
        
        const size = file.metadata?.size || 0;
        totalBytes += size;

        const contentType = file.metadata?.mimetype || "";
        let fileType: "video" | "image" | "other" = "other";
        
        if (contentType.startsWith("video/")) {
          videoBytes += size;
          fileType = "video";
        } else if (contentType.startsWith("image/")) {
          imageBytes += size;
          fileType = "image";
        } else {
          otherBytes += size;
        }

        fileList.push({
          name: file.name,
          size,
          type: fileType,
          path: `${wsId}/${file.name}`,
          createdAt: file.created_at || "",
        });
      });

      // Sort by size descending
      fileList.sort((a, b) => b.size - a.size);

      setFiles(fileList);
      setStats({
        totalBytes,
        fileCount: fileList.length,
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

  useEffect(() => {
    fetchStorageUsage();
  }, []);

  const handleDelete = async (file: StorageFile) => {
    if (!workspaceId) return;
    
    setDeleting(file.path);
    try {
      const { error: deleteError } = await supabase.storage
        .from("social-media")
        .remove([file.path]);

      if (deleteError) {
        toast.error(`Failed to delete ${file.name}`);
        console.error("Delete error:", deleteError);
      } else {
        toast.success(`Deleted ${file.name}`);
        await fetchStorageUsage();
      }
    } catch (err) {
      toast.error("Failed to delete file");
      console.error("Delete error:", err);
    } finally {
      setDeleting(null);
    }
  };

  const getFileIcon = (type: "video" | "image" | "other") => {
    switch (type) {
      case "video":
        return <FileVideo className="w-4 h-4 text-info" />;
      case "image":
        return <FileImage className="w-4 h-4 text-success" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage Usage
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchStorageUsage}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
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

        {/* File list */}
        {files.length > 0 && (
          <div className="pt-2">
            <p className="text-sm font-medium mb-2">Files ({files.length})</p>
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-2 space-y-1">
                {files.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getFileIcon(file.type)}
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => handleDelete(file)}
                      disabled={deleting === file.path}
                    >
                      {deleting === file.path ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};