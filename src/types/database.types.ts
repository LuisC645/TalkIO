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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          cached_tokens: number
          created_at: string
          error: string | null
          function_name: string
          id: number
          input_tokens: number
          latency_ms: number | null
          model: string
          output_tokens: number
          success: boolean
          tier: string
          user_id: string | null
        }
        Insert: {
          cached_tokens?: number
          created_at?: string
          error?: string | null
          function_name: string
          id?: never
          input_tokens?: number
          latency_ms?: number | null
          model: string
          output_tokens?: number
          success?: boolean
          tier: string
          user_id?: string | null
        }
        Update: {
          cached_tokens?: number
          created_at?: string
          error?: string | null
          function_name?: string
          id?: never
          input_tokens?: number
          latency_ms?: number | null
          model?: string
          output_tokens?: number
          success?: boolean
          tier?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_activity: {
        Row: {
          active_seconds: number
          exercises_done: number
          goal_met: boolean
          lessons_completed: number
          local_date: string
          reviews_done: number
          user_id: string
          xp: number
        }
        Insert: {
          active_seconds?: number
          exercises_done?: number
          goal_met?: boolean
          lessons_completed?: number
          local_date: string
          reviews_done?: number
          user_id: string
          xp?: number
        }
        Update: {
          active_seconds?: number
          exercises_done?: number
          goal_met?: boolean
          lessons_completed?: number
          local_date?: string
          reviews_done?: number
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      error_occurrences: {
        Row: {
          attempt_id: string | null
          context: string | null
          corrected_text: string
          id: string
          occurred_at: string
          pattern_id: string
          source: string
          user_id: string
          wrong_text: string
        }
        Insert: {
          attempt_id?: string | null
          context?: string | null
          corrected_text: string
          id?: string
          occurred_at?: string
          pattern_id: string
          source: string
          user_id: string
          wrong_text: string
        }
        Update: {
          attempt_id?: string | null
          context?: string | null
          corrected_text?: string
          id?: string
          occurred_at?: string
          pattern_id?: string
          source?: string
          user_id?: string
          wrong_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_occurrences_attempt_fk"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exercise_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_occurrences_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "error_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      error_patterns: {
        Row: {
          category: string
          code: string
          correct_streak: number
          created_at: string
          id: string
          last_seen_at: string | null
          mastered_at: string | null
          mastery_threshold: number
          occurrences: number
          priority: number
          rule: string
          skill: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          code: string
          correct_streak?: number
          created_at?: string
          id?: string
          last_seen_at?: string | null
          mastered_at?: string | null
          mastery_threshold?: number
          occurrences?: number
          priority?: number
          rule: string
          skill: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          code?: string
          correct_streak?: number
          created_at?: string
          id?: string
          last_seen_at?: string | null
          mastered_at?: string | null
          mastery_threshold?: number
          occurrences?: number
          priority?: number
          rule?: string
          skill?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercise_attempts: {
        Row: {
          created_at: string
          duration_ms: number | null
          exercise_id: string
          feedback: Json
          graded_by: string
          id: string
          is_correct: boolean | null
          lesson_id: string
          model: string | null
          response: Json
          round: number
          score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          exercise_id: string
          feedback?: Json
          graded_by: string
          id?: string
          is_correct?: boolean | null
          lesson_id: string
          model?: string | null
          response: Json
          round?: number
          score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          exercise_id?: string
          feedback?: Json
          graded_by?: string
          id?: string
          is_correct?: boolean | null
          lesson_id?: string
          model?: string | null
          response?: Json
          round?: number
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_attempts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_attempts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          answer_key: Json | null
          created_at: string
          grading: string
          id: string
          lesson_id: string
          payload: Json
          phase: string
          position: number
          target_pattern_id: string | null
          target_vocab_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          answer_key?: Json | null
          created_at?: string
          grading: string
          id?: string
          lesson_id: string
          payload: Json
          phase: string
          position: number
          target_pattern_id?: string | null
          target_vocab_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          answer_key?: Json | null
          created_at?: string
          grading?: string
          id?: string
          lesson_id?: string
          payload?: Json
          phase?: string
          position?: number
          target_pattern_id?: string | null
          target_vocab_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_lesson_id_user_id_fkey"
            columns: ["lesson_id", "user_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "exercises_target_pattern_id_fkey"
            columns: ["target_pattern_id"]
            isOneToOne: false
            referencedRelation: "error_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_target_vocab_id_fkey"
            columns: ["target_vocab_id"]
            isOneToOne: false
            referencedRelation: "vocab_items"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          cefr_level: Database["public"]["Enums"]["cefr_level"]
          completed_at: string | null
          content: Json
          focus_pattern_ids: string[]
          generated_at: string
          id: string
          kind: string
          meta: Json
          model: string | null
          prompt_version: string | null
          round: number
          score: number | null
          started_at: string | null
          status: string
          title: string
          topic_id: string | null
          user_id: string
          xp_earned: number
        }
        Insert: {
          cefr_level: Database["public"]["Enums"]["cefr_level"]
          completed_at?: string | null
          content?: Json
          focus_pattern_ids?: string[]
          generated_at?: string
          id?: string
          kind?: string
          meta?: Json
          model?: string | null
          prompt_version?: string | null
          round?: number
          score?: number | null
          started_at?: string | null
          status?: string
          title: string
          topic_id?: string | null
          user_id: string
          xp_earned?: number
        }
        Update: {
          cefr_level?: Database["public"]["Enums"]["cefr_level"]
          completed_at?: string | null
          content?: Json
          focus_pattern_ids?: string[]
          generated_at?: string
          id?: string
          kind?: string
          meta?: Json
          model?: string | null
          prompt_version?: string | null
          round?: number
          score?: number | null
          started_at?: string | null
          status?: string
          title?: string
          topic_id?: string | null
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      level_assessments: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          overall_cefr: Database["public"]["Enums"]["cefr_level"]
          overall_plus: boolean
          skills: Json
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          overall_cefr: Database["public"]["Enums"]["cefr_level"]
          overall_plus?: boolean
          skills?: Json
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          overall_cefr?: Database["public"]["Enums"]["cefr_level"]
          overall_plus?: boolean
          skills?: Json
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          dismissed_at: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      placement_sessions: {
        Row: {
          completed_at: string | null
          current_step: number
          id: string
          responses: Json
          result_assessment_id: string | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_step?: number
          id?: string
          responses?: Json
          result_assessment_id?: string | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_step?: number
          id?: string
          responses?: Json
          result_assessment_id?: string | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_sessions_result_assessment_id_fkey"
            columns: ["result_assessment_id"]
            isOneToOne: false
            referencedRelation: "level_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          browser_notifications: boolean
          cefr_level: Database["public"]["Enums"]["cefr_level"] | null
          cefr_plus: boolean
          created_at: string
          daily_goal_minutes: number
          daily_goal_xp: number
          display_name: string | null
          id: string
          interests: Json
          learner_context: Json
          native_language: string
          onboarding_completed: boolean
          timezone: string
          updated_at: string
          username: string | null
          weekly_report_email: boolean
        }
        Insert: {
          browser_notifications?: boolean
          cefr_level?: Database["public"]["Enums"]["cefr_level"] | null
          cefr_plus?: boolean
          created_at?: string
          daily_goal_minutes?: number
          daily_goal_xp?: number
          display_name?: string | null
          id: string
          interests?: Json
          learner_context?: Json
          native_language?: string
          onboarding_completed?: boolean
          timezone?: string
          updated_at?: string
          username?: string | null
          weekly_report_email?: boolean
        }
        Update: {
          browser_notifications?: boolean
          cefr_level?: Database["public"]["Enums"]["cefr_level"] | null
          cefr_plus?: boolean
          created_at?: string
          daily_goal_minutes?: number
          daily_goal_xp?: number
          display_name?: string | null
          id?: string
          interests?: Json
          learner_context?: Json
          native_language?: string
          onboarding_completed?: boolean
          timezone?: string
          updated_at?: string
          username?: string | null
          weekly_report_email?: boolean
        }
        Relationships: []
      }
      srs_cards: {
        Row: {
          created_at: string
          difficulty: number
          due: string
          elapsed_days: number
          id: string
          item_type: string
          lapses: number
          last_review: string | null
          learning_steps: number
          pattern_id: string | null
          reps: number
          scheduled_days: number
          stability: number
          state: number
          updated_at: string
          user_id: string
          vocab_id: string | null
        }
        Insert: {
          created_at?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          id?: string
          item_type: string
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          pattern_id?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id: string
          vocab_id?: string | null
        }
        Update: {
          created_at?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          id?: string
          item_type?: string
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          pattern_id?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id?: string
          vocab_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "srs_cards_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "error_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "srs_cards_vocab_id_fkey"
            columns: ["vocab_id"]
            isOneToOne: false
            referencedRelation: "vocab_items"
            referencedColumns: ["id"]
          },
        ]
      }
      srs_review_logs: {
        Row: {
          card_id: string
          created_at: string
          difficulty: number
          due: string
          duration_ms: number | null
          elapsed_days: number
          id: string
          last_elapsed_days: number
          learning_steps: number
          rating: number
          review: string
          scheduled_days: number
          stability: number
          state: number
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          difficulty: number
          due: string
          duration_ms?: number | null
          elapsed_days: number
          id?: string
          last_elapsed_days: number
          learning_steps: number
          rating: number
          review: string
          scheduled_days: number
          stability: number
          state: number
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          difficulty?: number
          due?: string
          duration_ms?: number | null
          elapsed_days?: number
          id?: string
          last_elapsed_days?: number
          learning_steps?: number
          rating?: number
          review?: string
          scheduled_days?: number
          stability?: number
          state?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "srs_review_logs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "srs_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          current_streak: number
          last_goal_date: string | null
          level: number
          longest_streak: number
          streak_freezes: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_goal_date?: string | null
          level?: number
          longest_streak?: number
          streak_freezes?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_goal_date?: string | null
          level?: number
          longest_streak?: number
          streak_freezes?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_topics: {
        Row: {
          last_practiced_at: string | null
          status: string
          times_practiced: number
          topic_id: string
          user_id: string
        }
        Insert: {
          last_practiced_at?: string | null
          status?: string
          times_practiced?: number
          topic_id: string
          user_id: string
        }
        Update: {
          last_practiced_at?: string | null
          status?: string
          times_practiced?: number
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      vocab_items: {
        Row: {
          created_at: string
          example: string | null
          id: string
          kind: string
          notes: string | null
          term: string
          topic_id: string | null
          translation: string | null
          user_id: string
          wrong_form: string | null
        }
        Insert: {
          created_at?: string
          example?: string | null
          id?: string
          kind: string
          notes?: string | null
          term: string
          topic_id?: string | null
          translation?: string | null
          user_id: string
          wrong_form?: string | null
        }
        Update: {
          created_at?: string
          example?: string | null
          id?: string
          kind?: string
          notes?: string | null
          term?: string
          topic_id?: string | null
          translation?: string | null
          user_id?: string
          wrong_form?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocab_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          content_md: string
          created_at: string
          email_error: string | null
          email_provider_id: string | null
          email_status: string
          id: string
          model: string | null
          sent_at: string | null
          stats: Json
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          content_md: string
          created_at?: string
          email_error?: string | null
          email_provider_id?: string | null
          email_status?: string
          id?: string
          model?: string | null
          sent_at?: string | null
          stats: Json
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          content_md?: string
          created_at?: string
          email_error?: string | null
          email_provider_id?: string | null
          email_status?: string
          id?: string
          model?: string | null
          sent_at?: string | null
          stats?: Json
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      writing_entries: {
        Row: {
          created_at: string
          feedback: Json
          id: string
          model: string | null
          prompt: string | null
          score: number | null
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback?: Json
          id?: string
          model?: string | null
          prompt?: string | null
          score?: number | null
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: Json
          id?: string
          model?: string | null
          prompt?: string | null
          score?: number | null
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: number
          local_date: string
          ref_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: never
          local_date: string
          ref_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: never
          local_date?: string
          ref_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      exercises_public: {
        Row: {
          created_at: string | null
          grading: string | null
          id: string | null
          lesson_id: string | null
          payload: Json | null
          phase: string | null
          position: number | null
          target_pattern_id: string | null
          target_vocab_id: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          grading?: string | null
          id?: string | null
          lesson_id?: string | null
          payload?: Json | null
          phase?: string | null
          position?: number | null
          target_pattern_id?: string | null
          target_vocab_id?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          grading?: string | null
          id?: string | null
          lesson_id?: string | null
          payload?: Json | null
          phase?: string | null
          position?: number | null
          target_pattern_id?: string | null
          target_vocab_id?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_lesson_id_user_id_fkey"
            columns: ["lesson_id", "user_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "exercises_target_pattern_id_fkey"
            columns: ["target_pattern_id"]
            isOneToOne: false
            referencedRelation: "error_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_target_vocab_id_fkey"
            columns: ["target_vocab_id"]
            isOneToOne: false
            referencedRelation: "vocab_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress_view: {
        Row: {
          current_streak: number | null
          daily_goal_xp: number | null
          last_goal_date: string | null
          level: number | null
          level_start_xp: number | null
          longest_streak: number | null
          next_level_xp: number | null
          streak_freezes: number | null
          today_goal_met: boolean | null
          today_xp: number | null
          total_xp: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_friend: { Args: { p_username: string }; Returns: Json }
      award_xp: {
        Args: {
          p_amount: number
          p_ref_id?: string
          p_source: string
          p_user_id: string
        }
        Returns: boolean
      }
      bump_daily_activity: {
        Args: {
          p_active_seconds?: number
          p_exercises_done?: number
          p_lessons_completed?: number
          p_local_date: string
          p_reviews_done?: number
          p_user_id: string
        }
        Returns: undefined
      }
      get_friend_requests: {
        Args: never
        Returns: {
          created_at: string
          direction: string
          display_name: string
          other_id: string
          username: string
        }[]
      }
      get_friends: {
        Args: never
        Returns: {
          active_today: boolean
          cefr: string
          current_streak: number
          display_name: string
          friend_id: string
          level: number
          username: string
        }[]
      }
      get_weekly_stats: {
        Args: { p_user_id: string; p_week_start: string }
        Returns: Json
      }
      level_for_xp: { Args: { p_xp: number }; Returns: number }
      notify_user: {
        Args: {
          p_body: string
          p_key: string
          p_kind: string
          p_link: string
          p_title: string
          p_user: string
        }
        Returns: undefined
      }
      record_pattern_result: {
        Args: { p_correct: boolean; p_pattern_id: string }
        Returns: {
          category: string
          code: string
          correct_streak: number
          created_at: string
          id: string
          last_seen_at: string | null
          mastered_at: string | null
          mastery_threshold: number
          occurrences: number
          priority: number
          rule: string
          skill: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "error_patterns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_review: {
        Args: {
          p_card: Json
          p_card_id: string
          p_duration_ms?: number
          p_log: Json
        }
        Returns: string
      }
      remove_friend: { Args: { p_other: string }; Returns: undefined }
      respond_friend_request: {
        Args: { p_accept: boolean; p_requester: string }
        Returns: undefined
      }
      retake_lesson: { Args: { p_lesson_id: string }; Returns: number }
      suggest_username: { Args: { p_base: string }; Returns: string }
      user_local_date: {
        Args: { p_at?: string; p_user_id: string }
        Returns: string
      }
      username_available: { Args: { p_username: string }; Returns: boolean }
      xp_for_level: { Args: { p_level: number }; Returns: number }
    }
    Enums: {
      cefr_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      cefr_level: ["A1", "A2", "B1", "B2", "C1", "C2"],
    },
  },
} as const
