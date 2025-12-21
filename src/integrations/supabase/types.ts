export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          approver_user_id: string | null
          comment: string | null
          created_at: string
          id: string
          post_id: string
          requested_by: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          approver_user_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          post_id: string
          requested_by: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          approver_user_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          post_id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          height: number | null
          id: string
          mime: string
          original_storage_path: string
          processed_storage_path: string | null
          thumbnail_storage_path: string | null
          transcode_status: Database["public"]["Enums"]["transcode_status"]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          uploader_user_id: string
          validation_report: Json | null
          width: number | null
          workspace_id: string
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          mime: string
          original_storage_path: string
          processed_storage_path?: string | null
          thumbnail_storage_path?: string | null
          transcode_status?: Database["public"]["Enums"]["transcode_status"]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          uploader_user_id: string
          validation_report?: Json | null
          width?: number | null
          workspace_id: string
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          mime?: string
          original_storage_path?: string
          processed_storage_path?: string | null
          thumbnail_storage_path?: string | null
          transcode_status?: Database["public"]["Enums"]["transcode_status"]
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          uploader_user_id?: string
          validation_report?: Json | null
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          post_target_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
          to_email: string
          workspace_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          post_target_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject: string
          to_email: string
          workspace_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          post_target_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string
          to_email?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_target_id_fkey"
            columns: ["post_target_id"]
            isOneToOne: false
            referencedRelation: "post_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          scope: string | null
          social_account_id: string
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          social_account_id: string
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          social_account_id?: string
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_targets: {
        Row: {
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          platform: Database["public"]["Enums"]["platform_type"]
          post_id: string
          publish_attempts: number
          published_at: string | null
          remote_post_id: string | null
          social_account_id: string
          status: Database["public"]["Enums"]["post_target_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          platform: Database["public"]["Enums"]["platform_type"]
          post_id: string
          publish_attempts?: number
          published_at?: string | null
          remote_post_id?: string | null
          social_account_id: string
          status?: Database["public"]["Enums"]["post_target_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          platform?: Database["public"]["Enums"]["platform_type"]
          post_id?: string
          publish_attempts?: number
          published_at?: string | null
          remote_post_id?: string | null
          social_account_id?: string
          status?: Database["public"]["Enums"]["post_target_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_targets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_targets_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          asset_id: string | null
          body_text: string | null
          created_at: string
          created_by: string
          id: string
          link_url: string | null
          per_channel_overrides: Json | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          tags: string[] | null
          timezone: string | null
          title: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id?: string | null
          body_text?: string | null
          created_at?: string
          created_by: string
          id?: string
          link_url?: string | null
          per_channel_overrides?: Json | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[] | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string | null
          body_text?: string | null
          created_at?: string
          created_by?: string
          id?: string
          link_url?: string | null
          per_channel_overrides?: Json | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[] | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publish_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: Json | null
          max_attempts: number
          next_retry_at: string | null
          post_target_id: string
          run_at: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: Json | null
          max_attempts?: number
          next_retry_at?: string | null
          post_target_id: string
          run_at: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: Json | null
          max_attempts?: number
          next_retry_at?: string | null
          post_target_id?: string
          run_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_jobs_post_target_id_fkey"
            columns: ["post_target_id"]
            isOneToOne: false
            referencedRelation: "post_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          autopublish_capable: boolean
          avatar_url: string | null
          created_at: string
          display_name: string
          handle: string | null
          id: string
          last_connected_at: string | null
          platform: Database["public"]["Enums"]["platform_type"]
          platform_user_id: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          autopublish_capable?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name: string
          handle?: string | null
          id?: string
          last_connected_at?: string | null
          platform: Database["public"]["Enums"]["platform_type"]
          platform_user_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          autopublish_capable?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          handle?: string | null
          id?: string
          last_connected_at?: string | null
          platform?: Database["public"]["Enums"]["platform_type"]
          platform_user_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          content: string
          created_at: string
          error_message: string | null
          id: string
          link_url: string | null
          media_type: string | null
          media_url: string | null
          publish_results: Json | null
          published_at: string | null
          scheduled_at: string | null
          status: string
          target_accounts: Json
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          error_message?: string | null
          id?: string
          link_url?: string | null
          media_type?: string | null
          media_url?: string | null
          publish_results?: Json | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          target_accounts?: Json
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          error_message?: string | null
          id?: string
          link_url?: string | null
          media_type?: string | null
          media_url?: string | null
          publish_results?: Json | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          target_accounts?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_admin_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_admin_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_workspace_invitation: {
        Args: { invitation_token: string }
        Returns: Json
      }
      create_workspace_with_owner: {
        Args: { workspace_name: string; workspace_timezone?: string }
        Returns: string
      }
      get_user_workspace_ids: { Args: never; Returns: string[] }
      has_workspace_role: {
        Args: {
          required_role: Database["public"]["Enums"]["app_role"]
          ws_id: string
        }
        Returns: boolean
      }
      is_app_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_admin_or_owner: { Args: { ws_id: string }; Returns: boolean }
      is_workspace_member: { Args: { ws_id: string }; Returns: boolean }
    }
    Enums: {
      account_status: "connected" | "needs_refresh" | "disconnected" | "error"
      account_type: "page" | "profile" | "business" | "creator" | "personal"
      app_admin_role: "admin" | "superadmin"
      app_role: "owner" | "admin" | "editor" | "approver" | "viewer"
      approval_status: "pending" | "approved" | "rejected"
      asset_type: "video" | "image"
      invitation_status: "pending" | "accepted" | "expired" | "cancelled"
      job_status:
        | "queued"
        | "processing"
        | "done"
        | "failed"
        | "retry_scheduled"
      notification_status: "queued" | "sent" | "failed"
      platform_type:
        | "instagram"
        | "facebook"
        | "linkedin"
        | "x"
        | "tiktok"
        | "bluesky"
        | "threads"
        | "youtube"
      post_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "scheduled"
        | "publishing"
        | "published"
        | "failed"
        | "canceled"
      post_target_status:
        | "queued"
        | "publishing"
        | "published"
        | "needs_user_action"
        | "failed"
        | "skipped"
      transcode_status: "pending" | "processing" | "ready" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["connected", "needs_refresh", "disconnected", "error"],
      account_type: ["page", "profile", "business", "creator", "personal"],
      app_admin_role: ["admin", "superadmin"],
      app_role: ["owner", "admin", "editor", "approver", "viewer"],
      approval_status: ["pending", "approved", "rejected"],
      asset_type: ["video", "image"],
      invitation_status: ["pending", "accepted", "expired", "cancelled"],
      job_status: ["queued", "processing", "done", "failed", "retry_scheduled"],
      notification_status: ["queued", "sent", "failed"],
      platform_type: [
        "instagram",
        "facebook",
        "linkedin",
        "x",
        "tiktok",
        "bluesky",
        "threads",
        "youtube",
      ],
      post_status: [
        "draft",
        "pending_approval",
        "approved",
        "scheduled",
        "publishing",
        "published",
        "failed",
        "canceled",
      ],
      post_target_status: [
        "queued",
        "publishing",
        "published",
        "needs_user_action",
        "failed",
        "skipped",
      ],
      transcode_status: ["pending", "processing", "ready", "failed"],
    },
  },
} as const
