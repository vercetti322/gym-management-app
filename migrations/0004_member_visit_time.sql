-- Store each member's usual gym visit time.
ALTER TABLE member_details
ADD COLUMN visit_time TEXT
CHECK (visit_time IS NULL OR visit_time IN ('AM', 'PM'));
