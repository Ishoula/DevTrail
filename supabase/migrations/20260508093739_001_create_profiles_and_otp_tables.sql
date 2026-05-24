/*
  # Create profiles and email_otps tables

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `name` (text, user display name)
      - `avatar_url` (text, optional avatar image URL)
      - `theme` (text, default 'dark')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `email_otps`
      - `id` (uuid, primary key)
      - `email` (text, target email)
      - `code` (text, 6-digit OTP)
      - `type` (text, 'REGISTER' or 'RESET_PASSWORD')
      - `expires_at` (timestamptz, 10 min from creation)
      - `verified` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Profiles: users can read/update own profile, insert on signup
    - Email OTPs: users can insert and verify their own OTPs
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  theme text NOT NULL DEFAULT 'dark',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  type text NOT NULL CHECK (type IN ('REGISTER', 'RESET_PASSWORD')),
  expires_at timestamptz NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert OTPs"
  ON email_otps FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read OTPs for verification"
  ON email_otps FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update OTPs for verification"
  ON email_otps FOR UPDATE
  TO anon
  USING (true);

CREATE INDEX idx_email_otps_email_type ON email_otps(email, type);
