-- Create initial super admin user
-- Password: Rasool1-Najibi2-Kheirandish3
-- This will be hashed by the application when the seed runs

INSERT OR IGNORE INTO users (
  id,
  username, 
  email,
  password_hash,
  first_name,
  last_name,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  1,
  'yasinnajibi',
  'admin@agrivex.com',
  '', -- Will be set by the application
  'Yasin',
  'Najibi',
  'superadmin',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
); 