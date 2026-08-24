export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string;
          id: string;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          name: string;
          revoked_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          name: string;
          revoked_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          name?: string;
          revoked_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      github_connections: {
        Row: {
          access_token_encrypted: string;
          connected_at: string;
          github_user_id: number | null;
          github_username: string | null;
          id: string;
          scopes: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token_encrypted: string;
          connected_at?: string;
          github_user_id?: number | null;
          github_username?: string | null;
          id?: string;
          scopes?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token_encrypted?: string;
          connected_at?: string;
          github_user_id?: number | null;
          github_username?: string | null;
          id?: string;
          scopes?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          email_enabled: boolean;
          scan_completed: boolean;
          security_alerts: boolean;
          updated_at: string;
          user_id: string;
          vulnerability_detected: boolean;
          weekly_summary: boolean;
        };
        Insert: {
          created_at?: string;
          email_enabled?: boolean;
          scan_completed?: boolean;
          security_alerts?: boolean;
          updated_at?: string;
          user_id: string;
          vulnerability_detected?: boolean;
          weekly_summary?: boolean;
        };
        Update: {
          created_at?: string;
          email_enabled?: boolean;
          scan_completed?: boolean;
          security_alerts?: boolean;
          updated_at?: string;
          user_id?: string;
          vulnerability_detected?: boolean;
          weekly_summary?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          authorization_ack: boolean;
          authorization_ack_at: string | null;
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          github_username: string | null;
          id: string;
          job_title: string | null;
          org_id: string | null;
          updated_at: string;
        };
        Insert: {
          authorization_ack?: boolean;
          authorization_ack_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          github_username?: string | null;
          id: string;
          job_title?: string | null;
          org_id?: string | null;
          updated_at?: string;
        };
        Update: {
          authorization_ack?: boolean;
          authorization_ack_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          github_username?: string | null;
          id?: string;
          job_title?: string | null;
          org_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          format: string;
          id: string;
          repository_id: string | null;
          scan_id: string;
          security_score: number | null;
          storage_path: string | null;
          summary: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          format?: string;
          id?: string;
          repository_id?: string | null;
          scan_id: string;
          security_score?: number | null;
          storage_path?: string | null;
          summary?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          format?: string;
          id?: string;
          repository_id?: string | null;
          scan_id?: string;
          security_score?: number | null;
          storage_path?: string | null;
          summary?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_repository_id_fkey";
            columns: ["repository_id"];
            isOneToOne: false;
            referencedRelation: "repositories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "scans";
            referencedColumns: ["id"];
          },
        ];
      };
      repositories: {
        Row: {
          created_at: string;
          default_branch: string;
          enabled_categories: Json;
          excluded_paths: string[];
          full_name: string;
          github_repo_id: number | null;
          id: string;
          is_private: boolean;
          language: string | null;
          last_scan_at: string | null;
          name: string;
          owner: string;
          repo_type: Database["public"]["Enums"]["repo_type"];
          scan_depth: Database["public"]["Enums"]["scan_depth"];
          scan_mode: Database["public"]["Enums"]["scan_mode"];
          schedule_day: number | null;
          schedule_hour: number | null;
          security_score: number | null;
          status: Database["public"]["Enums"]["repo_status"];
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          default_branch?: string;
          enabled_categories?: Json;
          excluded_paths?: string[];
          full_name: string;
          github_repo_id?: number | null;
          id?: string;
          is_private?: boolean;
          language?: string | null;
          last_scan_at?: string | null;
          name: string;
          owner: string;
          repo_type?: Database["public"]["Enums"]["repo_type"];
          scan_depth?: Database["public"]["Enums"]["scan_depth"];
          scan_mode?: Database["public"]["Enums"]["scan_mode"];
          schedule_day?: number | null;
          schedule_hour?: number | null;
          security_score?: number | null;
          status?: Database["public"]["Enums"]["repo_status"];
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          default_branch?: string;
          enabled_categories?: Json;
          excluded_paths?: string[];
          full_name?: string;
          github_repo_id?: number | null;
          id?: string;
          is_private?: boolean;
          language?: string | null;
          last_scan_at?: string | null;
          name?: string;
          owner?: string;
          repo_type?: Database["public"]["Enums"]["repo_type"];
          scan_depth?: Database["public"]["Enums"]["scan_depth"];
          scan_mode?: Database["public"]["Enums"]["scan_mode"];
          schedule_day?: number | null;
          schedule_hour?: number | null;
          security_score?: number | null;
          status?: Database["public"]["Enums"]["repo_status"];
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      scan_logs: {
        Row: {
          created_at: string;
          id: string;
          level: string;
          message: string;
          scan_id: string;
          stage: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          level?: string;
          message: string;
          scan_id: string;
          stage?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          level?: string;
          message?: string;
          scan_id?: string;
          stage?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scan_logs_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "scans";
            referencedColumns: ["id"];
          },
        ];
      };
      scans: {
        Row: {
          branch: string | null;
          commit_sha: string | null;
          completed_at: string | null;
          created_at: string;
          critical_count: number;
          current_stage: string | null;
          duration_seconds: number | null;
          enabled_categories: Json;
          error_message: string | null;
          high_count: number;
          id: string;
          low_count: number;
          medium_count: number;
          profile: Database["public"]["Enums"]["scan_depth"];
          progress: number;
          repository_id: string;
          security_score: number | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["scan_status"];
          trigger: Database["public"]["Enums"]["scan_trigger"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          branch?: string | null;
          commit_sha?: string | null;
          completed_at?: string | null;
          created_at?: string;
          critical_count?: number;
          current_stage?: string | null;
          duration_seconds?: number | null;
          enabled_categories?: Json;
          error_message?: string | null;
          high_count?: number;
          id?: string;
          low_count?: number;
          medium_count?: number;
          profile?: Database["public"]["Enums"]["scan_depth"];
          progress?: number;
          repository_id: string;
          security_score?: number | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["scan_status"];
          trigger?: Database["public"]["Enums"]["scan_trigger"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          branch?: string | null;
          commit_sha?: string | null;
          completed_at?: string | null;
          created_at?: string;
          critical_count?: number;
          current_stage?: string | null;
          duration_seconds?: number | null;
          enabled_categories?: Json;
          error_message?: string | null;
          high_count?: number;
          id?: string;
          low_count?: number;
          medium_count?: number;
          profile?: Database["public"]["Enums"]["scan_depth"];
          progress?: number;
          repository_id?: string;
          security_score?: number | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["scan_status"];
          trigger?: Database["public"]["Enums"]["scan_trigger"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scans_repository_id_fkey";
            columns: ["repository_id"];
            isOneToOne: false;
            referencedRelation: "repositories";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vulnerabilities: {
        Row: {
          ai_analysis: string | null;
          category: string | null;
          created_at: string;
          cvss_score: number | null;
          cwe_id: string | null;
          description: string | null;
          detected_at: string;
          detected_by_agents: string[];
          file_path: string | null;
          fixed_at: string | null;
          github_issue_url: string | null;
          id: string;
          line_end: number | null;
          line_start: number | null;
          owasp_category: string | null;
          remediation_steps: Json;
          repository_id: string;
          sandbox_job_id: string | null;
          scan_id: string | null;
          severity: Database["public"]["Enums"]["severity_level"];
          status: Database["public"]["Enums"]["vuln_status"];
          suggested_fix_diff: string | null;
          title: string;
          updated_at: string;
          user_id: string;
          verification_evidence: string | null;
          verification_status: Database["public"]["Enums"]["verification_status"];
        };
        Insert: {
          ai_analysis?: string | null;
          category?: string | null;
          created_at?: string;
          cvss_score?: number | null;
          cwe_id?: string | null;
          description?: string | null;
          detected_at?: string;
          detected_by_agents?: string[];
          file_path?: string | null;
          fixed_at?: string | null;
          github_issue_url?: string | null;
          id?: string;
          line_end?: number | null;
          line_start?: number | null;
          owasp_category?: string | null;
          remediation_steps?: Json;
          repository_id: string;
          sandbox_job_id?: string | null;
          scan_id?: string | null;
          severity: Database["public"]["Enums"]["severity_level"];
          status?: Database["public"]["Enums"]["vuln_status"];
          suggested_fix_diff?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
          verification_evidence?: string | null;
          verification_status?: Database["public"]["Enums"]["verification_status"];
        };
        Update: {
          ai_analysis?: string | null;
          category?: string | null;
          created_at?: string;
          cvss_score?: number | null;
          cwe_id?: string | null;
          description?: string | null;
          detected_at?: string;
          detected_by_agents?: string[];
          file_path?: string | null;
          fixed_at?: string | null;
          github_issue_url?: string | null;
          id?: string;
          line_end?: number | null;
          line_start?: number | null;
          owasp_category?: string | null;
          remediation_steps?: Json;
          repository_id?: string;
          sandbox_job_id?: string | null;
          scan_id?: string | null;
          severity?: Database["public"]["Enums"]["severity_level"];
          status?: Database["public"]["Enums"]["vuln_status"];
          suggested_fix_diff?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
          verification_evidence?: string | null;
          verification_status?: Database["public"]["Enums"]["verification_status"];
        };
        Relationships: [
          {
            foreignKeyName: "vulnerabilities_repository_id_fkey";
            columns: ["repository_id"];
            isOneToOne: false;
            referencedRelation: "repositories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vulnerabilities_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "scans";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      api_keys_public: {
        Row: {
          created_at: string | null;
          id: string | null;
          key_prefix: string | null;
          last_used_at: string | null;
          name: string | null;
          revoked_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string | null;
          key_prefix?: string | null;
          last_used_at?: string | null;
          name?: string | null;
          revoked_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string | null;
          key_prefix?: string | null;
          last_used_at?: string | null;
          name?: string | null;
          revoked_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "pentester" | "developer";
      repo_status: "secure" | "vulnerable" | "testing" | "never_scanned";
      repo_type: "web_app" | "api" | "library" | "mobile" | "infra" | "microservice";
      scan_depth: "quick" | "standard" | "deep";
      scan_mode: "manual" | "weekly";
      scan_status: "queued" | "running" | "completed" | "failed" | "cancelled";
      scan_trigger: "manual" | "scheduled" | "push";
      severity_level: "critical" | "high" | "medium" | "low";
      verification_status: "unverified" | "pending" | "confirmed" | "not_exploitable" | "failed";
      vuln_status: "open" | "in_progress" | "fixed" | "false_positive";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "pentester", "developer"],
      repo_status: ["secure", "vulnerable", "testing", "never_scanned"],
      repo_type: ["web_app", "api", "library", "mobile", "infra", "microservice"],
      scan_depth: ["quick", "standard", "deep"],
      scan_mode: ["manual", "weekly"],
      scan_status: ["queued", "running", "completed", "failed", "cancelled"],
      scan_trigger: ["manual", "scheduled", "push"],
      severity_level: ["critical", "high", "medium", "low"],
      verification_status: ["unverified", "pending", "confirmed", "not_exploitable", "failed"],
      vuln_status: ["open", "in_progress", "fixed", "false_positive"],
    },
  },
} as const;
