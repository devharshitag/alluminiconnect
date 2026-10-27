-- =====================================================================
-- Student Assist: University Mentorship & Guidance Platform
-- Database schema (Semester I)  |  Target: MySQL 8.0+ (InnoDB, utf8mb4)
-- Run:  mysql -u root -p < student_assist_schema.sql
-- =====================================================================

DROP DATABASE IF EXISTS student_assist;
CREATE DATABASE student_assist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE student_assist;

-- ---------------------------------------------------------------------
-- 1. UNIVERSITY STRUCTURE (multi-university ready)
-- ---------------------------------------------------------------------
CREATE TABLE universities (
  university_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150) NOT NULL UNIQUE,
  email_domain    VARCHAR(100) NOT NULL UNIQUE COMMENT 'e.g. abc.edu.in, used for email verification',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE departments (
  department_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  university_id   INT UNSIGNED NOT NULL,
  name            VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_dept (university_id, name),
  CONSTRAINT fk_dept_univ FOREIGN KEY (university_id) REFERENCES universities(university_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. USERS, PROFILES, AUTH
-- ---------------------------------------------------------------------
CREATE TABLE users (
  user_id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  university_id       INT UNSIGNED NOT NULL,
  department_id       INT UNSIGNED NULL,
  role                ENUM('student','senior','alumni','admin') NOT NULL,
  full_name           VARCHAR(120) NOT NULL,
  email               VARCHAR(190) NOT NULL UNIQUE,
  password_hash       VARCHAR(255) NOT NULL COMMENT 'bcrypt/argon2 hash, never plain text',
  enrollment_no       VARCHAR(40)  NULL,
  program             VARCHAR(80)  NULL COMMENT 'e.g. B.Tech, M.Tech, MCA',
  year_of_study       TINYINT UNSIGNED NULL,
  graduation_year     SMALLINT UNSIGNED NULL,
  email_verified_at   DATETIME NULL,
  verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  account_status      ENUM('active','suspended','deactivated') NOT NULL DEFAULT 'active',
  last_login_at       DATETIME NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enroll (university_id, enrollment_no),
  KEY idx_users_role_status (role, verification_status, account_status),
  KEY idx_users_dept (department_id),
  CONSTRAINT fk_users_univ FOREIGN KEY (university_id) REFERENCES universities(university_id),
  CONSTRAINT fk_users_dept FOREIGN KEY (department_id) REFERENCES departments(department_id),
  CONSTRAINT chk_year CHECK (year_of_study IS NULL OR year_of_study BETWEEN 1 AND 6)
) ENGINE=InnoDB;

-- Role progression: student -> senior -> alumni, history is preserved
CREATE TABLE role_history (
  history_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  old_role     ENUM('student','senior','alumni','admin') NULL,
  new_role     ENUM('student','senior','alumni','admin') NOT NULL,
  changed_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by   BIGINT UNSIGNED NULL,
  CONSTRAINT fk_rh_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_rh_by   FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE profiles (
  user_id                BIGINT UNSIGNED PRIMARY KEY,
  bio                    TEXT NULL,
  avatar_url             VARCHAR(255) NULL,
  linkedin_url           VARCHAR(255) NULL,
  current_organization   VARCHAR(150) NULL COMMENT 'alumni',
  designation            VARCHAR(120) NULL COMMENT 'alumni',
  preferred_mode         SET('chat','call','in_person') NOT NULL DEFAULT 'chat',
  -- mentor capacity controls
  is_accepting_requests  BOOLEAN NOT NULL DEFAULT TRUE,
  is_paused              BOOLEAN NOT NULL DEFAULT FALSE,
  max_active_mentees     TINYINT UNSIGNED NOT NULL DEFAULT 5,
  -- privacy controls
  show_email             BOOLEAN NOT NULL DEFAULT FALSE,
  show_linkedin          BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prof_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE email_otps (
  otp_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  purpose      ENUM('email_verification','password_reset') NOT NULL,
  otp_hash     VARCHAR(255) NOT NULL,
  expires_at   DATETIME NOT NULL,
  consumed_at  DATETIME NULL,
  attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_otp_user (user_id, purpose),
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE verification_requests (
  verification_id  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL,
  method           ENUM('email_domain','document') NOT NULL,
  document_type    ENUM('id_card','marksheet','degree_certificate') NULL,
  document_url     VARCHAR(255) NULL,
  status           ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by      BIGINT UNSIGNED NULL,
  reviewed_at      DATETIME NULL,
  remarks          VARCHAR(255) NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ver_status (status, created_at),
  CONSTRAINT fk_ver_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_ver_admin FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT chk_doc CHECK (method <> 'document' OR document_url IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. EXPERTISE & DOMAIN TAGGING
--    Top-level rows (parent_id NULL) are domains; children are finer tags.
-- ---------------------------------------------------------------------
CREATE TABLE tags (
  tag_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id      INT UNSIGNED NULL,
  name           VARCHAR(80) NOT NULL,
  slug           VARCHAR(100) NOT NULL UNIQUE,
  is_predefined  BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'FALSE = free-form tag created by a user',
  created_by     BIGINT UNSIGNED NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tag (parent_id, name),
  CONSTRAINT fk_tag_parent FOREIGN KEY (parent_id) REFERENCES tags(tag_id) ON DELETE SET NULL,
  CONSTRAINT fk_tag_user   FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE user_expertise (
  user_id      BIGINT UNSIGNED NOT NULL,
  tag_id       INT UNSIGNED NOT NULL,
  kind         ENUM('can_mentor','interested') NOT NULL,
  skill_level  ENUM('beginner','intermediate','expert') NOT NULL DEFAULT 'intermediate',
  PRIMARY KEY (user_id, tag_id, kind),
  KEY idx_exp_tag (tag_id, kind),
  CONSTRAINT fk_exp_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_exp_tag  FOREIGN KEY (tag_id)  REFERENCES tags(tag_id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. AVAILABILITY
-- ---------------------------------------------------------------------
CREATE TABLE availability_slots (
  slot_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mentor_id    BIGINT UNSIGNED NOT NULL,
  day_of_week  TINYINT UNSIGNED NOT NULL COMMENT '0=Sunday ... 6=Saturday',
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  mode         ENUM('chat','call','in_person') NOT NULL DEFAULT 'chat',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_slot_mentor (mentor_id, day_of_week),
  CONSTRAINT fk_slot_mentor FOREIGN KEY (mentor_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_slot_time CHECK (end_time > start_time),
  CONSTRAINT chk_slot_day CHECK (day_of_week BETWEEN 0 AND 6)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. PROBLEM POSTING
-- ---------------------------------------------------------------------
CREATE TABLE problems (
  problem_id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id            BIGINT UNSIGNED NOT NULL,
  title                 VARCHAR(200) NOT NULL,
  description           TEXT NOT NULL,
  category              ENUM('academic','technical','project','career') NOT NULL,
  urgency               ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  preferred_mentor_type ENUM('senior','alumni','any') NOT NULL DEFAULT 'any',
  is_anonymous          BOOLEAN NOT NULL DEFAULT FALSE,
  status                ENUM('open','in_discussion','resolved','closed') NOT NULL DEFAULT 'open',
  resolved_by           BIGINT UNSIGNED NULL,
  resolved_at           DATETIME NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_prob_status (status, category, created_at),
  KEY idx_prob_student (student_id),
  FULLTEXT KEY ft_prob (title, description),
  CONSTRAINT fk_prob_student  FOREIGN KEY (student_id)  REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_prob_resolver FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE problem_tags (
  problem_id  BIGINT UNSIGNED NOT NULL,
  tag_id      INT UNSIGNED NOT NULL,
  PRIMARY KEY (problem_id, tag_id),
  KEY idx_pt_tag (tag_id),
  CONSTRAINT fk_pt_problem FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE,
  CONSTRAINT fk_pt_tag     FOREIGN KEY (tag_id)     REFERENCES tags(tag_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Mentors offering help on an open problem
CREATE TABLE problem_offers (
  offer_id    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  problem_id  BIGINT UNSIGNED NOT NULL,
  mentor_id   BIGINT UNSIGNED NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_offer (problem_id, mentor_id),
  CONSTRAINT fk_off_problem FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE,
  CONSTRAINT fk_off_mentor  FOREIGN KEY (mentor_id)  REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. MENTORSHIP REQUESTS & SESSIONS
-- ---------------------------------------------------------------------
CREATE TABLE mentorship_requests (
  request_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        BIGINT UNSIGNED NOT NULL,
  mentor_id         BIGINT UNSIGNED NOT NULL,
  problem_id        BIGINT UNSIGNED NULL COMMENT 'set when request responds to a posted problem',
  goal              VARCHAR(255) NOT NULL,
  message           TEXT NOT NULL,
  status            ENUM('pending','accepted','declined','in_progress','completed','cancelled')
                    NOT NULL DEFAULT 'pending',
  decline_reason    VARCHAR(255) NULL,
  alternative_slot_at DATETIME NULL COMMENT 'mentor-suggested alternative time',
  credits_held      SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'optional anti-spam credit cost',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at      DATETIME NULL,
  completed_at      DATETIME NULL,
  KEY idx_req_mentor (mentor_id, status),
  KEY idx_req_student (student_id, status),
  CONSTRAINT fk_req_student FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_req_mentor  FOREIGN KEY (mentor_id)  REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_req_problem FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE SET NULL,
  CONSTRAINT chk_req_self CHECK (student_id <> mentor_id)
) ENGINE=InnoDB;

CREATE TABLE sessions (
  session_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id       BIGINT UNSIGNED NOT NULL,
  slot_id          BIGINT UNSIGNED NULL,
  scheduled_start  DATETIME NOT NULL,
  scheduled_end    DATETIME NOT NULL,
  mode             ENUM('chat','call','in_person') NOT NULL DEFAULT 'chat',
  meeting_link     VARCHAR(255) NULL,
  status           ENUM('scheduled','completed','cancelled','mentor_no_show','mentee_no_show')
                   NOT NULL DEFAULT 'scheduled',
  completed_at     DATETIME NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sess_req (request_id),
  KEY idx_sess_start (scheduled_start, status),
  CONSTRAINT fk_sess_req  FOREIGN KEY (request_id) REFERENCES mentorship_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT fk_sess_slot FOREIGN KEY (slot_id)    REFERENCES availability_slots(slot_id) ON DELETE SET NULL,
  CONSTRAINT chk_sess_time CHECK (scheduled_end > scheduled_start)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. RATINGS & FEEDBACK
--    direction mentee_to_mentor = rating + review; mentor_to_mentee = brief feedback
--    UNIQUE(session_id, direction) enforces one rating per session per side.
-- ---------------------------------------------------------------------
CREATE TABLE reviews (
  review_id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id        BIGINT UNSIGNED NOT NULL,
  reviewer_id       BIGINT UNSIGNED NOT NULL,
  reviewee_id       BIGINT UNSIGNED NOT NULL,
  direction         ENUM('mentee_to_mentor','mentor_to_mentee') NOT NULL,
  rating            TINYINT UNSIGNED NULL,
  helpfulness       TINYINT UNSIGNED NULL,
  clarity           TINYINT UNSIGNED NULL,
  responsiveness    TINYINT UNSIGNED NULL,
  comment           TEXT NULL,
  is_hidden         BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'set by admin moderation',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (session_id, direction),
  KEY idx_rev_reviewee (reviewee_id, direction, is_hidden),
  CONSTRAINT fk_rev_session  FOREIGN KEY (session_id)  REFERENCES sessions(session_id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_reviewee FOREIGN KEY (reviewee_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_rating   CHECK (rating         IS NULL OR rating         BETWEEN 1 AND 5),
  CONSTRAINT chk_help     CHECK (helpfulness    IS NULL OR helpfulness    BETWEEN 1 AND 5),
  CONSTRAINT chk_clarity  CHECK (clarity        IS NULL OR clarity        BETWEEN 1 AND 5),
  CONSTRAINT chk_respons  CHECK (responsiveness IS NULL OR responsiveness BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. CREDITS, REPUTATION, BADGES
-- ---------------------------------------------------------------------
-- Append-only ledger: balances are always auditable
CREATE TABLE credit_transactions (
  txn_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  delta       INT NOT NULL COMMENT 'positive = earned, negative = spent or penalty',
  reason      ENUM('session_completed','problem_resolved','high_rating','availability_bonus',
                   'request_spend','no_show_penalty','ignored_request_penalty','admin_adjustment') NOT NULL,
  ref_type    ENUM('session','problem','request','review','manual') NULL,
  ref_id      BIGINT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_txn_user (user_id, created_at),
  KEY idx_txn_time (created_at),
  CONSTRAINT fk_txn_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Cached aggregates for fast search, sorting and leaderboard
CREATE TABLE mentor_stats (
  user_id               BIGINT UNSIGNED PRIMARY KEY,
  total_credits         INT NOT NULL DEFAULT 0,
  sessions_completed    INT UNSIGNED NOT NULL DEFAULT 0,
  problems_resolved     INT UNSIGNED NOT NULL DEFAULT 0,
  rating_count          INT UNSIGNED NOT NULL DEFAULT 0,
  avg_rating            DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  avg_response_minutes  INT UNSIGNED NULL,
  active_mentees        INT UNSIGNED NOT NULL DEFAULT 0,
  reputation_level      ENUM('unranked','bronze','silver','gold') NOT NULL DEFAULT 'unranked',
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_stats_rank (total_credits, avg_rating),
  CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE badges (
  badge_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(50) NOT NULL UNIQUE,
  name         VARCHAR(80) NOT NULL,
  description  VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE user_badges (
  user_id     BIGINT UNSIGNED NOT NULL,
  badge_id    INT UNSIGNED NOT NULL,
  awarded_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_id),
  CONSTRAINT fk_ub_user  FOREIGN KEY (user_id)  REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_ub_badge FOREIGN KEY (badge_id) REFERENCES badges(badge_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. NOTIFICATIONS, SAFETY, AUDIT
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  notification_id  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL,
  type             VARCHAR(50) NOT NULL COMMENT 'request_received, request_accepted, verification_done, ...',
  message          VARCHAR(255) NOT NULL,
  link             VARCHAR(255) NULL,
  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reports (
  report_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id    BIGINT UNSIGNED NOT NULL,
  target_type    ENUM('user','problem','review') NOT NULL,
  target_id      BIGINT UNSIGNED NOT NULL,
  reason         VARCHAR(255) NOT NULL,
  status         ENUM('open','reviewed','actioned','dismissed') NOT NULL DEFAULT 'open',
  handled_by     BIGINT UNSIGNED NULL,
  handled_at     DATETIME NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rep_status (status, created_at),
  CONSTRAINT fk_rep_reporter FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_admin    FOREIGN KEY (handled_by)  REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE user_blocks (
  blocker_id  BIGINT UNSIGNED NOT NULL,
  blocked_id  BIGINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT fk_blk_a FOREIGN KEY (blocker_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_blk_b FOREIGN KEY (blocked_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  log_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id     BIGINT UNSIGNED NULL,
  action       VARCHAR(80) NOT NULL COMMENT 'e.g. VERIFY_USER, HIDE_REVIEW, SUSPEND_USER',
  entity_type  VARCHAR(40) NULL,
  entity_id    BIGINT UNSIGNED NULL,
  details      JSON NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_time (created_at),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. VIEWS
-- ---------------------------------------------------------------------
-- All-time leaderboard (weekly/monthly: aggregate credit_transactions by date, see query below)
CREATE VIEW v_leaderboard_alltime AS
SELECT u.user_id, u.full_name, u.role, d.name AS department,
       s.total_credits, s.avg_rating, s.sessions_completed, s.reputation_level,
       RANK() OVER (ORDER BY s.total_credits DESC, s.avg_rating DESC, s.sessions_completed DESC) AS rank_no
FROM mentor_stats s
JOIN users u ON u.user_id = s.user_id
LEFT JOIN departments d ON d.department_id = u.department_id
WHERE u.verification_status = 'verified'
  AND u.account_status = 'active'
  AND u.role IN ('senior','alumni');

-- Mentors who can currently take new requests (hard-filter base for matching)
CREATE VIEW v_available_mentors AS
SELECT u.user_id, u.full_name, u.role, u.department_id, u.year_of_study, u.graduation_year,
       s.avg_rating, s.total_credits, s.avg_response_minutes, s.active_mentees,
       p.max_active_mentees
FROM users u
JOIN profiles p ON p.user_id = u.user_id
LEFT JOIN mentor_stats s ON s.user_id = u.user_id
WHERE u.role IN ('senior','alumni')
  AND u.verification_status = 'verified'
  AND u.account_status = 'active'
  AND p.is_accepting_requests = TRUE
  AND p.is_paused = FALSE
  AND COALESCE(s.active_mentees, 0) < p.max_active_mentees;

-- ---------------------------------------------------------------------
-- 11. TRIGGERS (keep cached stats consistent)
-- ---------------------------------------------------------------------
DELIMITER $$

CREATE TRIGGER trg_credit_after_insert
AFTER INSERT ON credit_transactions
FOR EACH ROW
BEGIN
  INSERT INTO mentor_stats (user_id, total_credits)
  VALUES (NEW.user_id, NEW.delta)
  ON DUPLICATE KEY UPDATE
    total_credits = total_credits + NEW.delta,
    reputation_level = CASE
      WHEN total_credits + NEW.delta >= 500 THEN 'gold'
      WHEN total_credits + NEW.delta >= 200 THEN 'silver'
      WHEN total_credits + NEW.delta >= 50  THEN 'bronze'
      ELSE 'unranked' END;
END$$

CREATE TRIGGER trg_review_after_insert
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
  IF NEW.direction = 'mentee_to_mentor' AND NEW.rating IS NOT NULL THEN
    INSERT INTO mentor_stats (user_id, rating_count, avg_rating)
    VALUES (NEW.reviewee_id, 1, NEW.rating)
    ON DUPLICATE KEY UPDATE
      avg_rating   = ROUND((avg_rating * rating_count + NEW.rating) / (rating_count + 1), 2),
      rating_count = rating_count + 1;
  END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- 12. SEED DATA (taxonomy, badges, demo university)
-- ---------------------------------------------------------------------
INSERT INTO universities (name, email_domain) VALUES ('Demo University', 'demo.edu.in');

INSERT INTO departments (university_id, name) VALUES
 (1,'Computer Science & Engineering'),(1,'Information Technology'),
 (1,'Electronics & Communication'),(1,'Mechanical Engineering'),
 (1,'Civil Engineering'),(1,'Management Studies');

-- Domains (top level)
INSERT INTO tags (name, slug) VALUES
 ('Web Development','web-development'),('Machine Learning','machine-learning'),
 ('Data Structures & Algorithms','dsa'),('Core Subjects','core-subjects'),
 ('Placements','placements'),('Research','research'),
 ('Higher Studies','higher-studies'),('Entrepreneurship','entrepreneurship');

-- Sub-tags
INSERT INTO tags (parent_id, name, slug) VALUES
 (1,'React','react'),(1,'Node.js','nodejs'),(1,'HTML/CSS','html-css'),(1,'MySQL','mysql'),
 (2,'Deep Learning','deep-learning'),(2,'NLP','nlp'),(2,'Computer Vision','computer-vision'),
 (3,'Dynamic Programming','dynamic-programming'),(3,'Graphs','graphs'),
 (5,'Resume Review','resume-review'),(5,'Mock Interviews','mock-interviews'),
 (7,'GATE','gate'),(7,'GRE / MS Abroad','gre-ms-abroad'),(7,'MBA / CAT','mba-cat');

INSERT INTO badges (code, name, description) VALUES
 ('FIRST_SESSION','First Session','Completed first mentoring session'),
 ('TOP_RATED','Top Rated','Average rating of 4.7+ over 10 reviews'),
 ('RESPONSIVE','Quick Responder','Average response under 2 hours'),
 ('MENTOR_OF_MONTH','Mentor of the Month','Top of the monthly leaderboard');

-- =====================================================================
-- REFERENCE QUERIES
-- =====================================================================
-- Monthly leaderboard:
--   SELECT u.full_name, SUM(t.delta) AS credits
--   FROM credit_transactions t JOIN users u ON u.user_id = t.user_id
--   WHERE t.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND t.delta > 0
--   GROUP BY u.user_id ORDER BY credits DESC LIMIT 10;
--
-- Rule-based matching for a problem (hard filter + weighted score):
--   SELECT m.user_id, m.full_name,
--          COUNT(DISTINCT pt.tag_id) AS tag_matches,
--          (COUNT(DISTINCT pt.tag_id) * 10)
--          + (CASE WHEN m.department_id = :student_dept THEN 5 ELSE 0 END)
--          + (COALESCE(m.avg_rating,0) * 4)
--          - (COALESCE(m.active_mentees,0) * 2) AS score
--   FROM v_available_mentors m
--   JOIN user_expertise ue ON ue.user_id = m.user_id AND ue.kind = 'can_mentor'
--   JOIN problem_tags pt   ON pt.tag_id = ue.tag_id AND pt.problem_id = :problem_id
--   GROUP BY m.user_id
--   ORDER BY score DESC LIMIT 5;
