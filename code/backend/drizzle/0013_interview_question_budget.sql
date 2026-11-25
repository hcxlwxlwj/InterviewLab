ALTER TABLE interview_turns DROP CONSTRAINT IF EXISTS interview_turn_budget;
ALTER TABLE interview_turns ADD CONSTRAINT interview_turn_budget CHECK (main_question_index BETWEEN 1 AND 18 AND follow_up_index BETWEEN 0 AND 2);
