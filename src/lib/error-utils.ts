import { AuthError, PostgrestError } from "@supabase/supabase-js";

// Map common error codes to user-friendly messages
const errorMessages: Record<string, string> = {
  // Auth errors
  "invalid_credentials": "Invalid email or password. Please check your credentials and try again.",
  "email_not_confirmed": "Please verify your email address before signing in.",
  "user_not_found": "No account found with this email address.",
  "email_exists": "An account with this email already exists. Try signing in instead.",
  "weak_password": "Password is too weak. Use at least 6 characters with a mix of letters and numbers.",
  "invalid_email": "Please enter a valid email address.",
  "signup_disabled": "New registrations are currently disabled.",
  "user_banned": "This account has been suspended. Please contact support.",
  "session_expired": "Your session has expired. Please sign in again.",
  
  // Database/RLS errors
  "PGRST301": "You don't have permission to access this resource.",
  "23505": "This record already exists.",
  "23503": "Cannot complete this action due to related data.",
  "42501": "You don't have permission to perform this action.",
  "PGRST116": "No data found.",
  
  // Network errors
  "FetchError": "Unable to connect. Please check your internet connection.",
  "NetworkError": "Network error. Please try again.",
  "TimeoutError": "Request timed out. Please try again.",
};

export interface ParsedError {
  title: string;
  message: string;
  code?: string;
  isRetryable: boolean;
}

export function parseError(error: unknown): ParsedError {
  // Handle null/undefined
  if (!error) {
    return {
      title: "Unknown Error",
      message: "An unexpected error occurred. Please try again.",
      isRetryable: true,
    };
  }

  // Handle Supabase Auth errors
  if (isAuthError(error)) {
    const code = error.code || error.message;
    const friendlyMessage = getErrorMessage(code, error.message);
    
    return {
      title: getErrorTitle(code),
      message: friendlyMessage,
      code,
      isRetryable: isRetryableError(code),
    };
  }

  // Handle Supabase Postgrest errors
  if (isPostgrestError(error)) {
    const code = error.code;
    const friendlyMessage = getErrorMessage(code, error.message);
    
    return {
      title: "Database Error",
      message: friendlyMessage,
      code,
      isRetryable: isRetryableError(code),
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const code = error.name;
    const friendlyMessage = getErrorMessage(code, error.message);
    
    return {
      title: "Error",
      message: friendlyMessage,
      code,
      isRetryable: isRetryableError(code),
    };
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      title: "Error",
      message: error,
      isRetryable: true,
    };
  }

  // Handle error objects with message property
  if (typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    return {
      title: "Error",
      message: getErrorMessage("", message),
      isRetryable: true,
    };
  }

  // Fallback
  return {
    title: "Unknown Error",
    message: "An unexpected error occurred. Please try again.",
    isRetryable: true,
  };
}

function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "AuthApiError"
  );
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "details" in error
  );
}

function getErrorMessage(code: string, fallbackMessage: string): string {
  // Check direct code match
  if (code && errorMessages[code]) {
    return errorMessages[code];
  }
  
  // Check if fallback message contains known error patterns
  const lowerMessage = fallbackMessage.toLowerCase();
  
  if (lowerMessage.includes("invalid login credentials")) {
    return errorMessages["invalid_credentials"];
  }
  if (lowerMessage.includes("email not confirmed")) {
    return errorMessages["email_not_confirmed"];
  }
  if (lowerMessage.includes("user already registered") || lowerMessage.includes("already exists")) {
    return errorMessages["email_exists"];
  }
  if (lowerMessage.includes("password")) {
    return errorMessages["weak_password"];
  }
  if (lowerMessage.includes("row-level security") || lowerMessage.includes("rls")) {
    return "You don't have permission to perform this action. Please ensure you're signed in.";
  }
  if (lowerMessage.includes("network") || lowerMessage.includes("fetch")) {
    return errorMessages["NetworkError"];
  }
  if (lowerMessage.includes("timeout")) {
    return errorMessages["TimeoutError"];
  }
  
  // Return cleaned up fallback
  return cleanErrorMessage(fallbackMessage);
}

function cleanErrorMessage(message: string): string {
  // Remove technical jargon and clean up the message
  let cleaned = message
    .replace(/PostgrestError:/gi, "")
    .replace(/AuthApiError:/gi, "")
    .replace(/\[object Object\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  
  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  // Ensure it ends with a period
  if (cleaned && !cleaned.endsWith(".") && !cleaned.endsWith("!") && !cleaned.endsWith("?")) {
    cleaned += ".";
  }
  
  return cleaned || "An unexpected error occurred. Please try again.";
}

function getErrorTitle(code: string): string {
  if (code.includes("credential") || code.includes("password") || code.includes("email")) {
    return "Authentication Error";
  }
  if (code.includes("permission") || code.includes("401") || code.includes("403")) {
    return "Permission Denied";
  }
  if (code.includes("network") || code.includes("fetch") || code.includes("timeout")) {
    return "Connection Error";
  }
  return "Error";
}

function isRetryableError(code: string): boolean {
  const nonRetryableCodes = [
    "invalid_credentials",
    "email_exists",
    "weak_password",
    "invalid_email",
    "user_banned",
    "23505", // Unique violation
  ];
  return !nonRetryableCodes.includes(code);
}
