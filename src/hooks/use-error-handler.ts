import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { parseError, ParsedError } from "@/lib/error-utils";

interface UseErrorHandlerOptions {
  showToast?: boolean;
  onError?: (error: ParsedError) => void;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { showToast = true, onError } = options;
  const { toast } = useToast();

  const handleError = useCallback(
    (error: unknown, customMessage?: string) => {
      const parsed = parseError(error);
      
      console.error("Error handled:", {
        title: parsed.title,
        message: parsed.message,
        code: parsed.code,
        originalError: error,
      });

      if (showToast) {
        toast({
          title: parsed.title,
          description: customMessage || parsed.message,
          variant: "destructive",
        });
      }

      if (onError) {
        onError(parsed);
      }

      return parsed;
    },
    [toast, showToast, onError]
  );

  const handleSuccess = useCallback(
    (message: string, title: string = "Success") => {
      toast({
        title,
        description: message,
      });
    },
    [toast]
  );

  return { handleError, handleSuccess };
}
