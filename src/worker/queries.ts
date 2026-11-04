export const GET_ALL_MEMBERS = `
  SELECT
    md.member_id AS id,
    md.name,
    md.phone,
    CASE
      WHEN md.photo_data IS NOT NULL THEN 1
      ELSE 0
    END AS hasPhoto,
    md.is_active AS isActive,
    md.address,
    md.profession,
    md.visit_time AS visitTime,
    mpa.plan_duration AS planMonths,
    mpa.price,
    mpa.end_date AS expiry,
    CASE
      WHEN mpa.audit_id IS NOT NULL THEN 1
      ELSE NULL
    END AS paymentDone,
    mpa.start_date AS paymentDate,
    mpa.payment_mode AS paymentMode,
    CASE
      WHEN mpa.end_date IS NOT NULL THEN
        CAST(
          julianday(mpa.end_date) -
          julianday(date('now', '+5 hours', '+30 minutes'))
          AS INTEGER
        )
      ELSE NULL
    END AS daysLeft
  FROM member_details AS md
  LEFT JOIN member_plan_audit AS mpa
    ON mpa.audit_id = (
      SELECT audit_id
      FROM member_plan_audit
      WHERE member_id = md.member_id
      ORDER BY audit_id DESC
      LIMIT 1
    )
  WHERE md.is_active = 1
  ORDER BY md.member_id ASC
`;

export const GET_A_MEMBER = `
  SELECT
    md.member_id AS id,
    md.name,
    md.phone,
    md.is_active AS isActive,
    md.address,
    md.profession,
    md.visit_time AS visitTime,
    mpa.plan_duration AS planMonths,
    mpa.price,
    mpa.end_date AS expiry,
    CASE
      WHEN mpa.audit_id IS NOT NULL THEN 1
      ELSE NULL
    END AS paymentDone,
    mpa.start_date AS paymentDate,
    mpa.payment_mode AS paymentMode,
    CASE
      WHEN mpa.end_date IS NOT NULL THEN
        CAST(
          julianday(mpa.end_date) -
          julianday(date('now', '+5 hours', '+30 minutes'))
          AS INTEGER
        )
      ELSE NULL
    END AS daysLeft
  FROM member_details AS md
  LEFT JOIN member_plan_audit AS mpa
    ON mpa.audit_id = (
      SELECT audit_id
      FROM member_plan_audit
      WHERE member_id = md.member_id
      ORDER BY audit_id DESC
      LIMIT 1
    )
  WHERE md.member_id = ?
  LIMIT 1
`;

export const MARK_INACTIVE = `
  UPDATE member_details
  SET is_active = 0
  WHERE member_id = ?;
`;

export const RENEW_MEMBER_PLAN = `
  INSERT INTO member_plan_audit (
    member_id,
    plan_duration,
    price,
    start_date,
    end_date,
    payment_mode
  ) VALUES (?, ?, ?, ?, ?, ?)
`;

export const INSERT_MEMBER = `
  INSERT INTO member_details (name, phone, address, profession, visit_time)
  VALUES (?, ?, ?, ?, ?)
`;

export const UPDATE_MEMBER_ADDRESS = `
  UPDATE member_details
  SET address = ?
  WHERE member_id = ? AND is_active = 1
`;

export const UPDATE_MEMBER_PROFESSION = `
  UPDATE member_details
  SET profession = ?
  WHERE member_id = ? AND is_active = 1
`;

export const UPDATE_MEMBER_VISIT_TIME = `
  UPDATE member_details
  SET visit_time = ?
  WHERE member_id = ? AND is_active = 1
`;

export const GET_ACTIVE_MEMBER = `
  SELECT member_id
  FROM member_details
  WHERE member_id = ? AND is_active = 1
`;

export const PHONE_IN_USE = `
  SELECT member_id
  FROM member_details
  WHERE phone = ? AND member_id != ?
  LIMIT 1
`;

export const UPDATE_MEMBER_PHONE = `
  UPDATE member_details
  SET phone = ?
  WHERE member_id = ? AND is_active = 1
`;

export const GET_LATEST_PLAN_TERM = `
  SELECT start_date AS startDate, plan_duration AS planDuration
  FROM member_plan_audit
  WHERE member_id = ?
  ORDER BY audit_id DESC
  LIMIT 1
`;

export const UPDATE_LATEST_PLAN_TERM = `
  UPDATE member_plan_audit
  SET start_date = ?, end_date = ?, plan_duration = ?
  WHERE audit_id = (
    SELECT audit_id
    FROM member_plan_audit
    WHERE member_id = ?
    ORDER BY audit_id DESC
    LIMIT 1
  )
`;

export const UPDATE_LATEST_PLAN_PRICE = `
  UPDATE member_plan_audit
  SET price = ?
  WHERE audit_id = (
    SELECT audit_id
    FROM member_plan_audit
    WHERE member_id = ?
    ORDER BY audit_id DESC
    LIMIT 1
  )
`;

export const INSERT_MEMBER_PLAN = `
  INSERT INTO member_plan_audit (
    member_id,
    plan_duration,
    price,
    start_date,
    end_date,
    payment_mode
  )
  SELECT member_id, ?, ?, ?, ?, ?
  FROM member_details
  WHERE phone = ?
`;

export const PERSIST_SESSION_TOKEN = `
  INSERT INTO sessions (id, expires_at) 
  VALUES (?, ?)
`;

export const DELETE_SESSION_TOKEN = `
  DELETE FROM sessions 
  WHERE id = ?
`;

export const GET_SESSION_TOKEN = `
  SELECT id 
  FROM sessions
  WHERE id = ? AND expires_at > ?
`;

export const SAVE_MEMBER_PHOTO = `
  UPDATE member_details
  SET photo_data = ?
  WHERE member_id = ? AND is_active = 1
`;

export const GET_MEMBER_PHOTO = `
  SELECT photo_data
  FROM member_details
  WHERE member_id = ? AND is_active = 1
`;
