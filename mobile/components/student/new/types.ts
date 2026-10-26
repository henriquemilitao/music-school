import type { FormErrors, NewStudentForm } from '../../../lib/newStudent';

export type StepProps = {
  form: NewStudentForm;
  errors: FormErrors;
  onChange: (patch: Partial<NewStudentForm>) => void;
};

export type TeacherOption = { id: string; user: { name: string } };
